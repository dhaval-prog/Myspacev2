import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { OverflowIcon } from '../../components/icons/OverflowIcon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { BottomSheet } from '../../components/expenses/BottomSheet';
import { ActionButton } from '../../components/account/rows';
import { MediaGalleryModal } from '../../components/chat/MediaGalleryModal';
import { useFriends } from '../../context/FriendsContext';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { useThrowColorMode } from '../../context/ThrowColorModeContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const CHECK_ICON = 'M5 12.5 10 17.5 19 7';
const BACK_ICON = 'M15 5l-7 7 7 7';
const ATTACH_ICON = 'M12 5v14M5 12h14';
const PHONE_ICON = 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C9.5 21 3 14.5 3 6a2 2 0 0 1 2-2z';
const PIN_ICON = 'M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z M12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z';
const IMAGE_ICON = 'M4 5h16v14H4zM4 16l4.5-4.5 4 4L15 13l5 5';
const GRID_ICON = 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z';
const TRASH_ICON = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';
const PERSON_X_ICON = 'M4 19c0-3.3 2.7-6 6-6s6 2.7 6 6M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 8l4 4M21 8l-4 4';
const PLANE_BODY = 'M4 30 L60 8 L38 58 L30 36 Z';
const PLANE_WING = 'M30 36 L60 8 L22 40 Z';

// The handoff's own msIn bubble-entrance curve — a deliberate overshoot, distinct from the app's
// global "quiet, never bouncy" EASE (same convention LetterCardV3's EASE_RISE already uses).
const EASE_BUBBLE_IN = Easing.bezier(0.3, 1.3, 0.5, 1);
// The handoff's own msFly send-plane curve.
const EASE_FLY = Easing.bezier(0.4, 0, 0.6, 1);

type SendStatus = 'thrown' | 'landed' | 'read';

const STATUS_LABEL: Record<SendStatus, string> = { thrown: 'Thrown', landed: 'Landed', read: 'Read' };
const STATUS_COLOR: Record<'day' | 'night', Record<SendStatus, string>> = {
  day: { thrown: 'rgba(22,33,12,0.5)', landed: 'rgba(22,33,12,0.72)', read: '#5C7A2E' },
  night: { thrown: 'rgba(237,253,255,0.45)', landed: 'rgba(237,253,255,0.72)', read: colors.lime },
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

/** The two-tone paper-plane glyph used for the send button and the status ticks — per the
 * handoff's own rule, status ticks are plane glyphs, never checkmarks. */
function PlaneGlyph({ size, bodyFill, wingFill }: { size: number; bodyFill: string; wingFill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d={PLANE_BODY} fill={bodyFill} />
      {wingFill && <Path d={PLANE_WING} fill={wingFill} />}
    </Svg>
  );
}

/** Wraps one message bubble with the handoff's msIn entrance (opacity + translateY + scale,
 * overshoot ease). Keyed by message id in the parent `.map()`, so React only mounts (and
 * therefore only animates) genuinely new messages — existing ones never replay it on re-render. */
function AnimatedMessageWrap({ children, style, reduceMotion }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; reduceMotion: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: reduceMotion ? 0 : 350, easing: EASE_BUBBLE_IN, useNativeDriver: true }).start();
  }, []);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
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

/** The unlocked 1:1 conversation (MySpace Chats Throw handoff) — day/night themed, with the
 * paper-plane send flow (fly animation + client-side Thrown/Landed/Read status) and the accept
 * moment marked inline. */
export function ChatThreadScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { focusedFriend, messages, sendMessage, sendPhoto, sendLocation, goChats, removeFriend, clearChat, isOnline, isTyping, notifyTyping } = useFriends();
  const { startCall } = useCall();
  const { isDay } = useThrowColorMode();
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState('');
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [statusByMsgId, setStatusByMsgId] = useState<Record<string, SendStatus>>({});
  const scrollRef = useRef<ScrollView>(null);

  const [flying, setFlying] = useState(false);
  const flyProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  // Arms the Thrown → Landed → Read presentation-layer status for a message I just sent (never
  // for history loaded on open — the recency check keeps old messages a static "Read" via
  // statusFor's own fallback below, instead of replaying the animation on every screen open).
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.senderId !== user?.id || last.id in statusByMsgId) return;
    if (Date.now() - new Date(last.createdAt).getTime() > 5000) return;
    setStatusByMsgId((m) => ({ ...m, [last.id]: 'thrown' }));
    const landedMs = reduceMotion ? 300 : 1300;
    const readMs = reduceMotion ? 600 : 2300;
    const t1 = setTimeout(() => setStatusByMsgId((m) => ({ ...m, [last.id]: 'landed' })), landedMs);
    const t2 = setTimeout(() => setStatusByMsgId((m) => ({ ...m, [last.id]: 'read' })), readMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  if (!focusedFriend) return null;

  const statusFor = (messageId: string, senderId: string): SendStatus | null => (senderId === user?.id ? (statusByMsgId[messageId] ?? 'read') : null);

  const flyThePlane = () => {
    if (reduceMotion) return;
    flyProgress.setValue(0);
    setFlying(true);
    Animated.timing(flyProgress, { toValue: 1, duration: 900, easing: EASE_FLY, useNativeDriver: true }).start(() => setFlying(false));
  };

  const submit = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
    flyThePlane();
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

  const statusColor = STATUS_COLOR[isDay ? 'day' : 'night'];
  const online = isOnline(focusedFriend.userId);

  const flyTranslateX = flyProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -150] });
  const flyTranslateY = flyProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -420] });
  const flyRotate = flyProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-28deg'] });
  const flyScale = flyProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });
  const flyOpacity = flyProgress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });

  return (
    <LinearGradient
      colors={(isDay ? colors.friendsChatCanvas : colors.chatsNightCanvas) as [string, string, ...string[]]}
      locations={(isDay ? colors.friendsChatCanvasStops : colors.chatsNightCanvasStops) as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {isDay ? (
        <GlassSurface tint="dark" tintColor="rgba(22,33,12,0.6)" style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={goChats} style={styles.headerIconBtnDay} accessibilityRole="button" accessibilityLabel="Back">
            <Icon path={BACK_ICON} color="#fff" size={19} strokeWidth={2} />
          </Pressable>
          <FriendAvatar userId={focusedFriend.userId} name={focusedFriend.name} size={44} avatarUrl={focusedFriend.avatarUrl} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitleDay}>{focusedFriend.name}</Text>
            {online && (
              <View style={styles.presenceRow}>
                <View style={styles.presenceDot} />
                <Text style={styles.presenceTextDay}>Active now</Text>
              </View>
            )}
          </View>
          <Pressable onPress={startVideoCall} style={styles.headerIconBtnDay} accessibilityRole="button" accessibilityLabel="Start video call">
            <Icon path={PHONE_ICON} color="#FFFFFF" size={18} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={() => setOptionsOpen(true)} style={styles.headerIconBtnDay} accessibilityRole="button" accessibilityLabel="More options">
            <OverflowIcon size={19} color="#FFFFFF" />
          </Pressable>
        </GlassSurface>
      ) : (
        <View style={[styles.headerNight, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={goChats} style={styles.headerIconBtnNight} accessibilityRole="button" accessibilityLabel="Back">
            <Icon path={BACK_ICON} color={colors.pale} size={19} strokeWidth={2} />
          </Pressable>
          <FriendAvatar userId={focusedFriend.userId} name={focusedFriend.name} size={44} avatarUrl={focusedFriend.avatarUrl} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitleNight}>{focusedFriend.name}</Text>
            {online && <Text style={styles.presenceTextNight}>Active now</Text>}
          </View>
          <Pressable onPress={startVideoCall} style={styles.headerIconBtnNight} accessibilityRole="button" accessibilityLabel="Start video call">
            <Icon path={PHONE_ICON} color={colors.pale} size={18} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={() => setOptionsOpen(true)} style={styles.headerIconBtnNight} accessibilityRole="button" accessibilityLabel="More options">
            <Svg width={17} height={17} viewBox="0 0 64 64">
              <Path d={PLANE_BODY} fill="none" stroke={colors.lime} strokeWidth={5} strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>
      )}

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {showFriendsChip && (
          <View style={[styles.systemChip, !isDay && styles.systemChipNight]}>
            <Icon path={CHECK_ICON} color={isDay ? colors.ink55 : colors.pale} size={14} strokeWidth={2.2} />
            <Text style={[styles.systemChipText, !isDay && styles.systemChipTextNight]}>You're friends since today</Text>
          </View>
        )}
        {messages.length === 0 ? (
          <Text style={[styles.emptyNote, !isDay && styles.emptyNoteNight]}>No messages yet. Say hi.</Text>
        ) : (
        <View style={styles.bubbleStack}>
          {messages.map((m) => {
            if (m.kind === 'system') {
              return (
                <AnimatedMessageWrap key={m.id} reduceMotion={reduceMotion} style={[styles.systemChip, !isDay && styles.systemChipNight]}>
                  <Text style={[styles.systemChipText, !isDay && styles.systemChipTextNight]}>{m.text}</Text>
                </AnimatedMessageWrap>
              );
            }
            const mine = m.senderId === user?.id;
            const status = statusFor(m.id, m.senderId);
            return (
              <AnimatedMessageWrap key={m.id} reduceMotion={reduceMotion} style={[styles.msgWrap, mine ? styles.msgWrapMine : styles.msgWrapTheirs]}>
                {m.kind === 'image' && m.attachmentUrl ? (
                  <Image source={{ uri: m.attachmentUrl }} style={styles.imageBubble} resizeMode="cover" />
                ) : m.kind === 'location' && m.attachmentUrl ? (
                  <Pressable
                    onPress={() => Linking.openURL(m.attachmentUrl!)}
                    style={[styles.bubble, styles.locationBubble, mine ? styles.bubbleMine : isDay ? styles.bubbleTheirsDay : styles.bubbleTheirsNight]}
                  >
                    <View style={styles.locationIcon}>
                      <Icon path={PIN_ICON} color={mine ? colors.ink : colors.lime} size={16} strokeWidth={1.8} />
                    </View>
                    <Text style={[styles.locationText, mine ? styles.bubbleTextMine : isDay ? styles.bubbleTextDay : styles.bubbleTextNight]}>Location shared · Open in Maps</Text>
                  </Pressable>
                ) : mine ? (
                  <View style={[styles.bubble, styles.bubbleMine]}>
                    <Text style={styles.bubbleTextMine}>{m.text}</Text>
                  </View>
                ) : isDay ? (
                  <GlassSurface tint="light" tintColor="rgba(255,255,255,0.6)" style={[styles.bubble, styles.bubbleTheirsDay]}>
                    <Text style={styles.bubbleTextDay}>{m.text}</Text>
                  </GlassSurface>
                ) : (
                  <View style={[styles.bubble, styles.bubbleTheirsNight]}>
                    <Text style={styles.bubbleTextNight}>{m.text}</Text>
                  </View>
                )}
                {mine && status ? (
                  <View style={styles.metaRow}>
                    <Text style={[styles.meta, styles.metaMine, { color: isDay ? colors.ink50 : 'rgba(237,253,255,0.45)' }]}>{timeLabel(m.createdAt)} ·</Text>
                    <PlaneGlyph size={11} bodyFill={statusColor[status]} />
                    <Text style={[styles.statusText, { color: statusColor[status] }]}>{STATUS_LABEL[status]}</Text>
                  </View>
                ) : (
                  <Text style={[styles.meta, isDay ? styles.metaTheirsDay : styles.metaTheirsNight]}>{timeLabel(m.createdAt)}</Text>
                )}
              </AnimatedMessageWrap>
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
              {isDay ? (
                <GlassSurface tint="light" tintColor="rgba(255,255,255,0.6)" style={styles.typingBubble}>
                  <TypingDots color={colors.ink} reduceMotion={reduceMotion} />
                </GlassSurface>
              ) : (
                <View style={[styles.typingBubble, styles.typingBubbleNight]}>
                  <TypingDots color={colors.pale} reduceMotion={reduceMotion} />
                </View>
              )}
            </View>
          )}
        </View>
        )}
      </ScrollView>

      {attachError && <Text style={styles.attachError}>{attachError}</Text>}

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {isDay ? (
          <GlassSurface tint="light" tintColor="rgba(255,255,255,0.65)" style={styles.composer}>
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
            <Pressable onPress={submit} style={styles.sendButtonDay} accessibilityRole="button" accessibilityLabel="Send">
              <PlaneGlyph size={19} bodyFill={colors.lime} wingFill="#8FB52E" />
            </Pressable>
          </GlassSurface>
        ) : (
          <View style={styles.composerNight}>
            <Pressable onPress={() => setAttachOpen(true)} style={styles.attachButton} accessibilityRole="button" accessibilityLabel="Share a photo or your location">
              <Icon path={ATTACH_ICON} color="rgba(237,253,255,0.6)" size={21} strokeWidth={1.8} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={changeText}
              placeholder={`Message ${focusedFriend.name.split(' ')[0]}…`}
              placeholderTextColor="rgba(237,253,255,0.4)"
              style={[styles.input, styles.inputNight, noOutline]}
              onSubmitEditing={submit}
              returnKeyType="send"
            />
            <Pressable onPress={submit} style={styles.sendButtonNight} accessibilityRole="button" accessibilityLabel="Send">
              <PlaneGlyph size={20} bodyFill={colors.ink} wingFill="#3B5222" />
            </Pressable>
          </View>
        )}
        {flying && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.flyingPlane,
              {
                opacity: flyOpacity,
                transform: [{ translateX: flyTranslateX }, { translateY: flyTranslateY }, { rotate: flyRotate }, { scale: flyScale }],
              },
            ]}
          >
            <PlaneGlyph size={26} bodyFill={colors.lime} wingFill="#8FB52E" />
          </Animated.View>
        )}
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

/** The handoff's msDot bounce — each dot rises -3px and brightens on a staggered 1s loop. */
function TypingDots({ color, reduceMotion }: { color: string; reduceMotion: boolean }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion]);

  return (
    <>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              backgroundColor: color,
              opacity: reduceMotion ? 0.6 : v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ translateY: reduceMotion ? 0 : v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
            },
          ]}
        />
      ))}
    </>
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
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: colors.lime,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
  },
  headerNight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: 'rgba(237,253,255,0.05)',
    borderBottomWidth: 1,
    borderColor: 'rgba(237,253,255,0.08)',
  },
  headerIconBtnDay: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.onInkBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnNight: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(237,253,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitleDay: {
    fontFamily: fontFamily.sans600,
    fontSize: 16.5,
    color: '#fff',
  },
  headerTitleNight: {
    fontFamily: fontFamily.sans600,
    fontSize: 16.5,
    color: colors.pale,
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
  presenceTextDay: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.onInk60,
  },
  presenceTextNight: {
    marginTop: 2,
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: 'rgba(237,253,255,0.55)',
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
  systemChipNight: {
    backgroundColor: 'rgba(237,253,255,0.06)',
  },
  systemChipText: {
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    color: colors.ink55,
  },
  systemChipTextNight: {
    color: 'rgba(237,253,255,0.6)',
  },
  emptyNote: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  emptyNoteNight: {
    color: 'rgba(237,253,255,0.5)',
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
  bubbleTheirsDay: {
    borderBottomLeftRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 1,
  },
  bubbleTheirsNight: {
    borderBottomLeftRadius: 7,
    backgroundColor: 'rgba(237,253,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(237,253,255,0.07)',
  },
  bubbleTextDay: {
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  bubbleTextNight: {
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    lineHeight: 21,
    color: colors.pale,
  },
  bubbleTextMine: {
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    lineHeight: 21,
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
  },
  meta: {
    marginTop: 6,
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
  },
  metaTheirsDay: {
    color: colors.textDisabled,
  },
  metaTheirsNight: {
    color: 'rgba(237,253,255,0.4)',
  },
  metaMine: {
    marginTop: 0,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusText: {
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 22,
    borderBottomLeftRadius: 7,
    paddingVertical: 15,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 1,
  },
  typingBubbleNight: {
    backgroundColor: 'rgba(237,253,255,0.09)',
    borderColor: 'rgba(237,253,255,0.07)',
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  attachError: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 4,
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    color: colors.danger,
  },
  inputRow: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.ms,
    position: 'relative',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingVertical: 9,
    paddingRight: 9,
    paddingLeft: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 22,
    elevation: 1,
  },
  composerNight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingVertical: 8,
    paddingRight: 8,
    paddingLeft: 18,
    backgroundColor: 'rgba(237,253,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(237,253,255,0.1)',
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
  inputNight: {
    color: colors.pale,
  },
  sendButtonDay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonNight: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.lime,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 2,
  },
  flyingPlane: {
    position: 'absolute',
    right: 48,
    top: 2,
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
    backgroundColor: colors.dangerBg,
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
