import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { OverflowIcon } from '../../components/icons/OverflowIcon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { BottomSheet } from '../../components/expenses/BottomSheet';
import { ActionButton } from '../../components/account/rows';
import { MediaGalleryModal } from '../../components/chat/MediaGalleryModal';
import { useFriends } from '../../context/FriendsContext';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';

const CHECK_ICON = 'M5 12.5 10 17.5 19 7';
const ATTACH_ICON = 'M12 5v14M5 12h14';
const PHONE_ICON = 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C9.5 21 3 14.5 3 6a2 2 0 0 1 2-2z';
const SEND_ICON = 'M4 12 20 4l-7 16-2.5-6.5z';
const PIN_ICON = 'M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z M12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z';
const IMAGE_ICON = 'M4 5h16v14H4zM4 16l4.5-4.5 4 4L15 13l5 5';
const GRID_ICON = 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z';
const TRASH_ICON = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';
const PERSON_X_ICON = 'M4 19c0-3.3 2.7-6 6-6s6 2.7 6 6M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 8l4 4M21 8l-4 4';
const HEADER_AVATAR_COLOR = { bg: colors.lime, fg: colors.ink };

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

/** One tappable row inside a bottom-sheet menu. */
function SheetOption({
  icon,
  label,
  destructive,
  onPress,
}: {
  icon: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}>
      <View style={[styles.sheetOptionIcon, destructive && styles.sheetOptionIconDestructive]}>
        <Icon path={icon} color={destructive ? colors.danger : colors.textPrimary} size={17} strokeWidth={1.9} />
      </View>
      <Text style={[styles.sheetOptionLabel, destructive && styles.sheetOptionLabelDestructive]}>{label}</Text>
    </Pressable>
  );
}

/** The unlocked 1:1 conversation (6p-7) — messages, with the accept moment marked inline. */
export function ChatThreadScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { focusedFriend, messages, sendMessage, sendPhoto, sendLocation, goChats, removeFriend, clearChat, isOnline, isTyping, notifyTyping } = useFriends();
  const { startCall } = useCall();
  const [text, setText] = useState('');
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  if (!focusedFriend) return null;

  const submit = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  const changeText = (next: string) => {
    setText(next);
    if (next.trim()) notifyTyping(focusedFriend.connectionId);
  };

  const theirTyping = isTyping(focusedFriend.connectionId);

  const showFriendsChip = isToday(focusedFriend.acceptedAt);

  const mediaItems = messages
    .filter((m) => m.kind === 'image' && m.attachmentUrl)
    .map((m) => ({ id: m.id, url: m.attachmentUrl!, senderId: m.senderId }))
    .reverse();
  const mediaSenderNameFor = (senderId: string) => (senderId === user?.id ? 'You' : focusedFriend.name);

  const pickPhoto = async () => {
    setAttachOpen(false);
    setAttachError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAttachError('Photo library access is needed to share a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7, allowsEditing: true });
    if (result.canceled || !result.assets[0]) return;

    setSendingAttachment(true);
    const { error } = await sendPhoto(result.assets[0].uri);
    setSendingAttachment(false);
    if (error) setAttachError(error);
  };

  const shareLocation = async () => {
    setAttachOpen(false);
    setAttachError(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setAttachError('Location access is needed to share where you are.');
      return;
    }
    setSendingAttachment(true);
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { error } = await sendLocation(position.coords.latitude, position.coords.longitude);
      if (error) setAttachError(error);
    } catch {
      setAttachError('Could not get your location.');
    } finally {
      setSendingAttachment(false);
    }
  };

  const doClearChat = () => {
    setConfirmClearOpen(false);
    clearChat(focusedFriend.connectionId);
  };

  const doRemoveFriend = () => {
    setConfirmRemoveOpen(false);
    removeFriend(focusedFriend.connectionId);
  };

  const startVideoCall = () => {
    startCall({
      kind: 'dm',
      title: focusedFriend.name,
      memberIds: [focusedFriend.userId],
      participantNames: { [focusedFriend.userId]: focusedFriend.name },
      contextId: focusedFriend.connectionId,
    });
  };

  return (
    <LinearGradient
      colors={colors.friendsChatCanvas as [string, string, ...string[]]}
      locations={colors.friendsChatCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <FriendAvatar userId={focusedFriend.userId} name={focusedFriend.name} size={44} colorOverride={HEADER_AVATAR_COLOR} avatarUrl={focusedFriend.avatarUrl} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{focusedFriend.name}</Text>
          {isOnline(focusedFriend.userId) && (
            <View style={styles.presenceRow}>
              <View style={styles.presenceDot} />
              <Text style={styles.presenceText}>Active now</Text>
            </View>
          )}
        </View>
        <Pressable onPress={startVideoCall} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Start video call">
          <Icon path={PHONE_ICON} color="#FFFFFF" size={18} strokeWidth={1.8} />
        </Pressable>
        <Pressable onPress={() => setOptionsOpen(true)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="More options">
          <OverflowIcon size={19} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {showFriendsChip && (
          <View style={styles.systemChip}>
            <Icon path={CHECK_ICON} color={colors.ink55} size={14} strokeWidth={2.2} />
            <Text style={styles.systemChipText}>You're friends since today</Text>
          </View>
        )}
        {messages.length === 0 ? (
          <Text style={styles.emptyNote}>No messages yet. Say hi.</Text>
        ) : (
        <View style={styles.bubbleStack}>
          {messages.map((m) => {
            if (m.kind === 'system') {
              return (
                <View key={m.id} style={styles.systemChip}>
                  <Text style={styles.systemChipText}>{m.text}</Text>
                </View>
              );
            }
            const mine = m.senderId === user?.id;
            return (
              <View key={m.id} style={[styles.msgWrap, mine ? styles.msgWrapMine : styles.msgWrapTheirs]}>
                {m.kind === 'image' && m.attachmentUrl ? (
                  <Image source={{ uri: m.attachmentUrl }} style={styles.imageBubble} resizeMode="cover" />
                ) : m.kind === 'location' && m.attachmentUrl ? (
                  <Pressable
                    onPress={() => Linking.openURL(m.attachmentUrl!)}
                    style={[styles.bubble, styles.locationBubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                  >
                    <View style={styles.locationIcon}>
                      <Icon path={PIN_ICON} color={mine ? colors.ink : colors.lime} size={16} strokeWidth={1.8} />
                    </View>
                    <Text style={[styles.locationText, mine && styles.bubbleTextMine]}>Location shared · Open in Maps</Text>
                  </Pressable>
                ) : (
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.text}</Text>
                  </View>
                )}
                <Text style={[styles.meta, mine ? styles.metaMine : styles.metaTheirs]}>
                  {timeLabel(m.createdAt)}
                  {mine ? '  ✓✓' : ''}
                </Text>
              </View>
            );
          })}
          {sendingAttachment && (
            <View style={[styles.msgWrap, styles.msgWrapMine]}>
              <View style={[styles.bubble, styles.bubbleMine, styles.sendingBubble]}>
                <ActivityIndicator size="small" color={colors.ink} />
              </View>
            </View>
          )}
          {theirTyping && (
            <View style={[styles.msgWrap, styles.msgWrapTheirs]}>
              <View style={styles.typingBubble}>
                <View style={[styles.typingDot, styles.typingDot1]} />
                <View style={[styles.typingDot, styles.typingDot2]} />
                <View style={[styles.typingDot, styles.typingDot3]} />
              </View>
            </View>
          )}
        </View>
        )}
      </ScrollView>

      {attachError && <Text style={styles.attachError}>{attachError}</Text>}

      <View style={styles.bottomBackRow}>
        <Pressable onPress={goChats} style={styles.pinnedIconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.pinnedBackArrow}>←</Text>
        </Pressable>
      </View>

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.composer}>
          <Pressable onPress={() => setAttachOpen(true)} style={styles.attachButton} accessibilityRole="button" accessibilityLabel="Share a photo or your location">
            <Icon path={ATTACH_ICON} color={colors.textMuted} size={21} strokeWidth={1.8} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={changeText}
            placeholder={`Message ${focusedFriend.name.split(' ')[0]}…`}
            placeholderTextColor={colors.textDisabled}
            style={[styles.input, noOutline]}
            onSubmitEditing={submit}
            returnKeyType="send"
          />
          <Pressable onPress={submit} style={styles.sendButton} accessibilityRole="button" accessibilityLabel="Send">
            <Icon path={SEND_ICON} color={colors.lime} size={19} strokeWidth={1.9} />
          </Pressable>
        </View>
      </View>

      <BottomSheet visible={optionsOpen} onClose={() => setOptionsOpen(false)}>
        <Text style={styles.sheetTitle}>{focusedFriend.name}</Text>
        <SheetOption icon={TRASH_ICON} label="Delete chat" onPress={() => { setOptionsOpen(false); setConfirmClearOpen(true); }} />
        <SheetOption
          icon={PERSON_X_ICON}
          label="Remove friend"
          destructive
          onPress={() => { setOptionsOpen(false); setConfirmRemoveOpen(true); }}
        />
      </BottomSheet>

      <BottomSheet visible={attachOpen} onClose={() => setAttachOpen(false)}>
        <Text style={styles.sheetTitle}>Share</Text>
        <SheetOption icon={IMAGE_ICON} label="Photo" onPress={pickPhoto} />
        <SheetOption icon={PIN_ICON} label="Current location" onPress={shareLocation} />
        <SheetOption
          icon={GRID_ICON}
          label="Media"
          onPress={() => {
            setAttachOpen(false);
            setMediaOpen(true);
          }}
        />
      </BottomSheet>

      <MediaGalleryModal
        visible={mediaOpen}
        onClose={() => setMediaOpen(false)}
        title="Media"
        bannerCaption={focusedFriend.name}
        items={mediaItems}
        senderNameFor={mediaSenderNameFor}
      />

      <BottomSheet visible={confirmClearOpen} onClose={() => setConfirmClearOpen(false)}>
        <Text style={styles.sheetTitle}>Delete chat</Text>
        <Text style={styles.sheetBody}>Delete every message with {focusedFriend.name}? This can't be undone.</Text>
        <View style={styles.sheetActions}>
          <View style={styles.sheetActionFlex}>
            <ActionButton label="Cancel" variant="secondary" onPress={() => setConfirmClearOpen(false)} />
          </View>
          <View style={styles.sheetActionFlex}>
            <ActionButton label="Delete chat" variant="destructive" onPress={doClearChat} />
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={confirmRemoveOpen} onClose={() => setConfirmRemoveOpen(false)}>
        <Text style={styles.sheetTitle}>Remove friend</Text>
        <Text style={styles.sheetBody}>Remove {focusedFriend.name}? This deletes your chat history too.</Text>
        <View style={styles.sheetActions}>
          <View style={styles.sheetActionFlex}>
            <ActionButton label="Cancel" variant="secondary" onPress={() => setConfirmRemoveOpen(false)} />
          </View>
          <View style={styles.sheetActionFlex}>
            <ActionButton label="Remove" variant="destructive" onPress={doRemoveFriend} />
          </View>
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 22,
    paddingBottom: 18,
    backgroundColor: colors.ink,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.onInkBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 19,
    color: '#FFFFFF',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 16.5,
    color: '#fff',
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  presenceDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.onlineDotOnInk,
  },
  presenceText: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.onInk60,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: spacing.md,
  },
  systemChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.ink06,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  systemChipText: {
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    color: colors.ink55,
  },
  emptyNote: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  bubbleStack: {
    marginTop: 18,
    gap: 9,
  },
  msgWrap: {
    maxWidth: '78%',
  },
  msgWrapMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgWrapTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingVertical: 13,
    paddingHorizontal: 17,
    borderRadius: 22,
  },
  bubbleMine: {
    backgroundColor: colors.lime,
    borderBottomRightRadius: 7,
    shadowColor: '#7AA82C',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  bubbleTheirs: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 7,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 1,
  },
  bubbleText: {
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  bubbleTextMine: {
    color: colors.ink,
  },
  sendingBubble: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  imageBubble: {
    width: 220,
    height: 220,
    borderRadius: 20,
    backgroundColor: colors.badgeInactiveBg,
  },
  locationBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 6,
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
  },
  metaTheirs: {
    color: colors.textDisabled,
  },
  metaMine: {
    color: colors.ink50,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: 22,
    borderBottomLeftRadius: 7,
    paddingVertical: 15,
    paddingHorizontal: 17,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 1,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.ink,
  },
  typingDot1: {
    opacity: 0.3,
  },
  typingDot2: {
    opacity: 0.45,
  },
  typingDot3: {
    opacity: 0.6,
  },
  attachError: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 4,
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    color: colors.danger,
  },
  bottomBackRow: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.ms,
  },
  pinnedIconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 2,
  },
  pinnedBackArrow: {
    fontSize: 19,
    color: colors.textPrimary,
  },
  inputRow: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.ms,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 9,
    paddingRight: 9,
    paddingLeft: 20,
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 22,
    elevation: 1,
  },
  attachButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sheetBody: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingVertical: 13,
  },
  sheetOptionPressed: {
    opacity: 0.6,
  },
  sheetOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.pressWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionIconDestructive: {
    backgroundColor: colors.splitDangerBg,
  },
  sheetOptionLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sheetOptionLabelDestructive: {
    color: colors.danger,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sheetActionFlex: {
    flex: 1,
  },
});
