import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { BottomSheet } from '../../components/expenses/BottomSheet';
import { ActionButton } from '../../components/account/rows';
import { useFriends } from '../../context/FriendsContext';
import { useAuth } from '../../context/AuthContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const SEND_ICON = 'M4 12h14M12 6l6 6-6 6';
const MORE_ICON = 'M12 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 19.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z';
const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7';
const ATTACH_ICON = 'M12 6v12M6 12h12';
const PIN_ICON = 'M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z M12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z';
const IMAGE_ICON = 'M4 5h16v14H4zM4 16l4.5-4.5 4 4L15 13l5 5';
const TRASH_ICON = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';
const PERSON_X_ICON = 'M4 19c0-3.3 2.7-6 6-6s6 2.7 6 6M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 8l4 4M21 8l-4 4';

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
  const { focusedFriend, messages, sendMessage, sendPhoto, sendLocation, goChats, removeFriend, clearChat, isOnline } = useFriends();
  const [text, setText] = useState('');
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
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

  const showFriendsChip = isToday(focusedFriend.acceptedAt);

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

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goChats} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color="#fff" size={19} strokeWidth={2} />
        </Pressable>
        <FriendAvatar userId={focusedFriend.userId} name={focusedFriend.name} size={44} online={isOnline(focusedFriend.userId)} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{focusedFriend.name}</Text>
        </View>
        <Pressable onPress={() => setOptionsOpen(true)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="More options">
          <Icon path={MORE_ICON} color="rgba(255,255,255,.6)" size={19} strokeWidth={1.8} />
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {showFriendsChip && (
          <View style={styles.systemChip}>
            <Icon path={CHECK_ICON} color={colors.textMuted} size={12} strokeWidth={2.4} />
            <Text style={styles.systemChipText}>You're friends since today</Text>
          </View>
        )}
        {messages.length === 0 ? (
          <Text style={styles.emptyNote}>No messages yet. Say hi.</Text>
        ) : (
          messages.map((m) => {
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
                <Text style={styles.meta}>
                  {timeLabel(m.createdAt)}
                  {mine ? '  ✓✓' : ''}
                </Text>
              </View>
            );
          })
        )}
        {sendingAttachment && (
          <View style={[styles.msgWrap, styles.msgWrapMine]}>
            <View style={[styles.bubble, styles.bubbleMine, styles.sendingBubble]}>
              <ActivityIndicator size="small" color={colors.ink} />
            </View>
          </View>
        )}
      </ScrollView>

      {attachError && <Text style={styles.attachError}>{attachError}</Text>}

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable onPress={() => setAttachOpen(true)} style={styles.attachButton} accessibilityRole="button" accessibilityLabel="Share a photo or your location">
          <Icon path={ATTACH_ICON} color={colors.ink} size={19} strokeWidth={2} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={`Message ${focusedFriend.name.split(' ')[0]}…`}
          placeholderTextColor={colors.placeholder}
          style={[styles.input, noOutline]}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable onPress={submit} style={styles.sendButton} accessibilityRole="button" accessibilityLabel="Send">
          <Icon path={SEND_ICON} color={colors.lime} size={19} strokeWidth={2} />
        </Pressable>
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
      </BottomSheet>

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
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pale,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: 22,
    paddingBottom: spacing.lg,
    backgroundColor: colors.ink,
    borderBottomLeftRadius: radius.organic - 4,
    borderBottomRightRadius: radius.organic - 4,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 16.5,
    color: '#fff',
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: 9,
  },
  systemChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(22,33,12,0.06)',
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginBottom: 4,
  },
  systemChipText: {
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyNote: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  msgWrap: {
    maxWidth: '78%',
    gap: 4,
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
    paddingHorizontal: 16,
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
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    color: 'rgba(22,33,12,0.5)',
  },
  attachError: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 4,
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    color: colors.danger,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.ms,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 1,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 20,
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    color: colors.textPrimary,
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 22,
    elevation: 1,
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
