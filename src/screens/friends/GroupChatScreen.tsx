import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { BottomSheet } from '../../components/expenses/BottomSheet';
import { ActionButton, ToggleRow } from '../../components/account/rows';
import { MediaGalleryModal } from '../../components/chat/MediaGalleryModal';
import { PlaneGlyph } from '../../components/chat/PlaneGlyph';
import { AnimatedMessageWrap } from '../../components/chat/AnimatedMessageWrap';
import { GroupLetterCard } from '../../components/chat/GroupLetterCard';
import { STATUS_LABEL, STATUS_COLOR } from '../../components/chat/sendStatus';
import { useFriends } from '../../context/FriendsContext';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { useThrowColorMode } from '../../context/ThrowColorModeContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useMessageSendStatus } from '../../hooks/useMessageSendStatus';
import { useSendPlaneFly } from '../../hooks/useSendPlaneFly';
import { avatarSkinFor, initialsOf } from '../../utils/friendAvatar';
import type { GroupMessage, GroupPoll } from '../../types/groups';

const BACK_ICON = 'M15 5l-7 7 7 7';
const ATTACH_ICON = 'M12 5v14M5 12h14';
const PIN_ICON = 'M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z M12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z';
const IMAGE_ICON = 'M4 5h16v14H4zM4 16l4.5-4.5 4 4L15 13l5 5';
const GRID_ICON = 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z';
const POLL_ICON = 'M5 20V10M12 20V4M19 20v-7';
const CHECK_ICON = 'M5 12.5 10 17.5 19 7';
const PHONE_ICON = 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C9.5 21 3 14.5 3 6a2 2 0 0 1 2-2z';
const LEAVE_ICON = 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9';
const TRASH_ICON = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';
const EDIT_ICON = 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM14 6l3 3';
const OVERFLOW_DOTS = 'M12 5.5a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM12 10.3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM12 15.1a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z';
// Same paper-plane glyph used everywhere else Throw is a destination.
const LETTER_ICON = 'M22 2L11 13 M22 2L15 22L11 13L2 9L22 2Z';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function SheetOption({ icon, label, destructive, onPress }: { icon: string; label: string; destructive?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}>
      <View style={[styles.sheetOptionIcon, destructive && styles.sheetOptionIconDestructive]}>
        <Icon path={icon} color={destructive ? colors.danger : colors.textPrimary} size={17} strokeWidth={1.9} />
      </View>
      <Text style={[styles.sheetOptionLabel, destructive && styles.sheetOptionLabelDestructive]}>{label}</Text>
    </Pressable>
  );
}

/** A small stack of member-colored circles for the header — up to the first 3 other members. */
function StackedAvatars({ memberIds, memberNameById, isDay }: { memberIds: string[]; memberNameById: Record<string, string>; isDay: boolean }) {
  const shown = memberIds.slice(0, 3);
  const borderColor = isDay ? colors.ink : '#121B0B';
  return (
    <View style={styles.stackedAvatars}>
      {shown.map((id, i) => {
        const skin = avatarSkinFor(id);
        return (
          <View key={id} style={[styles.stackedAvatar, { backgroundColor: skin.bg, borderColor, marginLeft: i === 0 ? 0 : -10 }]}>
            <Text style={[styles.stackedAvatarText, { color: skin.fg }]}>{initialsOf(memberNameById[id] ?? '??')}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** One poll message: question, tappable options, live vote counts. A 'rename' poll is the same card, just locked once resolved (its outcome shows up as its own activity message right after it). */
function PollCard({ poll, myUserId, isDay, onVote }: { poll: GroupPoll; myUserId: string | undefined; isDay: boolean; onVote: (optionId: string) => void }) {
  const totalVotes = Object.values(poll.votesByUser).filter((ids) => ids.length > 0).length;
  const myVotes = myUserId ? (poll.votesByUser[myUserId] ?? []) : [];
  const isRename = poll.purpose === 'rename';
  const locked = isRename && poll.resolved;

  return (
    <View style={[styles.pollCard, isDay ? styles.pollCardDay : styles.pollCardNight, locked && styles.pollCardLocked]}>
      {isRename && (
        <View style={styles.renamePollBadgeRow}>
          <Icon path={EDIT_ICON} color={isDay ? colors.ink55 : 'rgba(237,253,255,0.55)'} size={12} strokeWidth={2} />
          <Text style={[styles.renamePollBadge, !isDay && styles.renamePollBadgeNight]}>{locked ? 'Rename request · closed' : 'Rename request'}</Text>
        </View>
      )}
      <View style={styles.pollHeaderRow}>
        <Icon path={POLL_ICON} color={isDay ? colors.ink : colors.pale} size={16} strokeWidth={2} />
        <Text style={[styles.pollQuestion, !isDay && styles.pollQuestionNight]}>{poll.question}</Text>
      </View>
      <View style={styles.pollOptions}>
        {poll.options.map((opt) => {
          const voteCount = Object.values(poll.votesByUser).filter((ids) => ids.includes(opt.id)).length;
          const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const mine = myVotes.includes(opt.id);
          return (
            <Pressable
              key={opt.id}
              onPress={() => !locked && onVote(opt.id)}
              disabled={locked}
              style={styles.pollOptionRow}
              accessibilityRole="button"
              accessibilityLabel={`${opt.label}, ${voteCount} vote${voteCount === 1 ? '' : 's'}`}
            >
              <View style={[styles.pollOptionBar, !isDay && styles.pollOptionBarNight]}>
                <View style={[styles.pollOptionFill, { width: `${pct}%`, backgroundColor: mine ? colors.lime : isDay ? colors.pale : 'rgba(237,253,255,0.18)' }]} />
                <View style={styles.pollOptionContent}>
                  <Text style={[styles.pollOptionLabel, !isDay && styles.pollOptionLabelNight]} numberOfLines={1}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.pollOptionPct, !isDay && styles.pollOptionPctNight]}>{pct}%</Text>
                </View>
              </View>
              {mine && <Icon path={CHECK_ICON} color={isDay ? colors.ink : colors.lime} size={14} strokeWidth={2.4} />}
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.pollMeta, !isDay && styles.pollMetaNight]}>
        {totalVotes} vote{totalVotes === 1 ? '' : 's'} · {isRename ? 'Majority decides · auto-resolves in an hour' : poll.allowMultiple ? 'Pick any number' : 'Pick one'}
      </Text>
    </View>
  );
}

/** The group conversation (MySpace Chats Throw handoff) — day/night themed, same message kinds as
 * a 1:1 thread plus polls and the airmail letter card, with per-sender name/avatar on incoming
 * messages (shown once per consecutive run from that sender, not on every bubble). */
export function GroupChatScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    focusedGroup,
    groupMemberIdsFor,
    groupMemberNamesFor,
    groupMessages,
    groupPolls,
    sendGroupMessage,
    sendGroupPhoto,
    sendGroupLocation,
    sendGroupLetter,
    createGroupPoll,
    voteOnPoll,
    proposeGroupRename,
    leaveGroup,
    deleteGroup,
    goChats,
  } = useFriends();
  const { startCall } = useCall();
  const { isDay } = useThrowColorMode();
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState('');
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionA, setPollOptionA] = useState('');
  const [pollOptionB, setPollOptionB] = useState('');
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterTitle, setLetterTitle] = useState('');
  const [letterPlace, setLetterPlace] = useState('');
  const [letterSubmitting, setLetterSubmitting] = useState(false);
  const [letterError, setLetterError] = useState<string | null>(null);
  const [letterDetail, setLetterDetail] = useState<GroupMessage | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [groupActionError, setGroupActionError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { statusFor } = useMessageSendStatus(groupMessages, user?.id, reduceMotion);
  const { flying, flyThePlane, flyStyle } = useSendPlaneFly(reduceMotion);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [groupMessages.length]);

  if (!focusedGroup) return null;

  const memberNames = groupMemberNamesFor(focusedGroup.id);
  const isOwner = focusedGroup.ownerId === user?.id;

  const mediaItems = groupMessages
    .filter((m) => m.kind === 'image' && m.attachmentUrl)
    .map((m) => ({ id: m.id, url: m.attachmentUrl!, senderId: m.senderId }))
    .reverse();
  const otherMemberIds = groupMemberIdsFor(focusedGroup.id).filter((id) => id !== user?.id);
  const memberNameById: Record<string, string> = {};
  otherMemberIds.forEach((id, i) => {
    memberNameById[id] = memberNames[i] ?? 'Someone';
  });
  const mediaSenderNameFor = (senderId: string) => (senderId === user?.id ? 'You' : (memberNameById[senderId] ?? 'Someone'));
  const senderNameFor = (senderId: string) => (senderId === user?.id ? 'You' : (memberNameById[senderId] ?? 'Someone'));

  const startVideoCall = () => {
    const memberIds = groupMemberIdsFor(focusedGroup.id).filter((id) => id !== user?.id);
    const participantNames: Record<string, string> = {};
    memberIds.forEach((id, i) => {
      participantNames[id] = memberNames[i] ?? 'Someone';
    });
    startCall({ kind: 'group', title: focusedGroup.name, memberIds, participantNames, contextId: focusedGroup.id });
  };

  const doLeaveGroup = async () => {
    setConfirmLeaveOpen(false);
    setGroupActionError(null);
    const { error } = await leaveGroup(focusedGroup.id);
    if (error) setGroupActionError(error);
  };

  const doDeleteGroup = async () => {
    setConfirmDeleteOpen(false);
    setGroupActionError(null);
    const { error } = await deleteGroup(focusedGroup.id);
    if (error) setGroupActionError(error);
  };

  const openRename = () => {
    setOptionsOpen(false);
    setRenameName(focusedGroup.name);
    setRenameError(null);
    setRenameOpen(true);
  };

  const submitRename = async () => {
    setRenameSubmitting(true);
    setRenameError(null);
    const result = await proposeGroupRename(renameName);
    setRenameSubmitting(false);
    if (result.error) setRenameError(result.error);
    else setRenameOpen(false);
  };

  const submit = () => {
    if (!text.trim()) return;
    sendGroupMessage(text);
    setText('');
    flyThePlane();
  };

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
    const { error } = await sendGroupPhoto(result.assets[0].uri);
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
      const { error } = await sendGroupLocation(position.coords.latitude, position.coords.longitude);
      if (error) setAttachError(error);
    } catch {
      setAttachError('Could not get your location.');
    } finally {
      setSendingAttachment(false);
    }
  };

  const openPollComposer = () => {
    setAttachOpen(false);
    setPollQuestion('');
    setPollOptionA('');
    setPollOptionB('');
    setPollAllowMultiple(false);
    setPollError(null);
    setPollOpen(true);
  };

  const submitPoll = async () => {
    setPollSubmitting(true);
    setPollError(null);
    const result = await createGroupPoll(pollQuestion, [pollOptionA, pollOptionB], pollAllowMultiple);
    setPollSubmitting(false);
    if (result.error) setPollError(result.error);
    else setPollOpen(false);
  };

  const openLetterComposer = () => {
    setAttachOpen(false);
    setLetterTitle('');
    setLetterPlace('');
    setLetterError(null);
    setLetterOpen(true);
  };

  const submitLetter = async () => {
    setLetterSubmitting(true);
    setLetterError(null);
    const result = await sendGroupLetter(letterTitle, letterPlace);
    setLetterSubmitting(false);
    if (result.error) setLetterError(result.error);
    else setLetterOpen(false);
  };

  const statusColor = STATUS_COLOR[isDay ? 'day' : 'night'];
  const headerAvatarIds = groupMemberIdsFor(focusedGroup.id).filter((id) => id !== user?.id);

  return (
    <LinearGradient
      colors={(isDay ? colors.friendsChatCanvas : colors.chatsNightCanvas) as [string, string, ...string[]]}
      locations={(isDay ? colors.friendsChatCanvasStops : colors.chatsNightCanvasStops) as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, isDay ? styles.headerDay : styles.headerNight, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={goChats} style={[styles.headerIconButton, !isDay && styles.headerIconButtonNight]} accessibilityRole="button" accessibilityLabel="Back">
            <Icon path={BACK_ICON} color={isDay ? '#fff' : colors.pale} size={18} strokeWidth={2} />
          </Pressable>
          <StackedAvatars memberIds={headerAvatarIds} memberNameById={memberNameById} isDay={isDay} />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, !isDay && styles.headerTitleNight]}>{focusedGroup.name}</Text>
            <Text style={[styles.headerMeta, !isDay && styles.headerMetaNight]} numberOfLines={1}>
              {memberNames.length > 0 ? `You, ${memberNames.join(', ')}` : 'Just you'}
            </Text>
          </View>
          <Pressable onPress={startVideoCall} style={[styles.headerIconButton, !isDay && styles.headerIconButtonNight]} accessibilityRole="button" accessibilityLabel="Start video call">
            <Icon path={PHONE_ICON} color={isDay ? '#FFFFFF' : colors.pale} size={17} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={() => setOptionsOpen(true)} style={[styles.headerIconButton, !isDay && styles.headerIconButtonNight]} accessibilityRole="button" accessibilityLabel="More options">
            <Icon path={OVERFLOW_DOTS} color={isDay ? '#FFFFFF' : colors.pale} size={18} strokeWidth={1.8} />
          </Pressable>
        </View>

        {groupActionError && <Text style={styles.attachError}>{groupActionError}</Text>}

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {groupMessages.length === 0 ? (
            <Text style={[styles.emptyNote, !isDay && styles.emptyNoteNight]}>No messages yet. Say hi to the group.</Text>
          ) : (
            <View style={styles.bubbleStack}>
              {groupMessages.map((m, i) => {
                if (m.kind === 'system') {
                  return (
                    <AnimatedMessageWrap key={m.id} reduceMotion={reduceMotion} style={[styles.systemChip, !isDay && styles.systemChipNight]}>
                      <Text style={[styles.systemChipText, !isDay && styles.systemChipTextNight]}>{m.text}</Text>
                    </AnimatedMessageWrap>
                  );
                }

                const mine = m.senderId === user?.id;
                const prevMsg = groupMessages[i - 1];
                const nextMsg = groupMessages[i + 1];
                const showName = !mine && (!prevMsg || prevMsg.kind === 'system' || prevMsg.senderId !== m.senderId);
                const showAvatar = !mine && (!nextMsg || nextMsg.kind === 'system' || nextMsg.senderId !== m.senderId);
                const skin = avatarSkinFor(m.senderId);

                if (m.kind === 'letter') {
                  return (
                    <AnimatedMessageWrap key={m.id} reduceMotion={reduceMotion} style={styles.letterWrap}>
                      <View style={styles.letterRow}>
                        <View style={[styles.smallAvatar, { backgroundColor: skin.bg }]}>
                          <Text style={[styles.smallAvatarText, { color: skin.fg }]}>{initialsOf(senderNameFor(m.senderId))}</Text>
                        </View>
                        <View style={styles.letterCol}>
                          <Text style={[styles.senderName, { color: skin.bg }]}>{mine ? 'You' : senderNameFor(m.senderId)} threw a letter</Text>
                          <GroupLetterCard
                            title={m.text}
                            place={m.attachmentUrl}
                            groupName={focusedGroup.name}
                            timeLabel={timeLabel(m.createdAt)}
                            onBreakSeal={() => setLetterDetail(m)}
                          />
                        </View>
                      </View>
                    </AnimatedMessageWrap>
                  );
                }

                const poll = m.kind === 'poll' && m.pollId ? groupPolls[m.pollId] : undefined;
                const status = statusFor(m.id, m.senderId);
                return (
                  <AnimatedMessageWrap key={m.id} reduceMotion={reduceMotion} style={[styles.msgWrap, mine ? styles.msgWrapMine : styles.msgWrapTheirs]}>
                    <View style={[styles.senderRow, mine && styles.senderRowMine]}>
                      {!mine && (
                        <View style={styles.avatarSlot}>
                          {showAvatar && (
                            <View style={[styles.smallAvatar, { backgroundColor: skin.bg }]}>
                              <Text style={[styles.smallAvatarText, { color: skin.fg }]}>{initialsOf(senderNameFor(m.senderId))}</Text>
                            </View>
                          )}
                        </View>
                      )}
                      <View style={styles.bubbleCol}>
                        {showName && <Text style={[styles.senderName, { color: skin.bg }]}>{senderNameFor(m.senderId)}</Text>}
                        {m.kind === 'poll' ? (
                          poll ? (
                            <PollCard poll={poll} myUserId={user?.id} isDay={isDay} onVote={(optionId) => voteOnPoll(poll.id, optionId)} />
                          ) : (
                            <View style={[styles.bubble, isDay ? styles.bubbleTheirsDay : styles.bubbleTheirsNight]}>
                              <Text style={isDay ? styles.bubbleTextDay : styles.bubbleTextNight}>Loading poll…</Text>
                            </View>
                          )
                        ) : m.kind === 'image' && m.attachmentUrl ? (
                          <Image source={{ uri: m.attachmentUrl }} style={styles.imageBubble} resizeMode="cover" />
                        ) : m.kind === 'location' && m.attachmentUrl ? (
                          <Pressable
                            onPress={() => Linking.openURL(m.attachmentUrl!)}
                            style={[styles.bubble, styles.locationBubble, mine ? styles.bubbleMine : isDay ? styles.bubbleTheirsDay : styles.bubbleTheirsNight]}
                          >
                            <Icon path={PIN_ICON} color={mine ? colors.ink : colors.lime} size={16} strokeWidth={1.8} />
                            <Text style={[styles.locationText, mine ? styles.bubbleTextMine : isDay ? styles.bubbleTextDay : styles.bubbleTextNight]}>Location shared · Open in Maps</Text>
                          </Pressable>
                        ) : (
                          <View style={[styles.bubble, mine ? styles.bubbleMine : isDay ? styles.bubbleTheirsDay : styles.bubbleTheirsNight]}>
                            <Text style={mine ? styles.bubbleTextMine : isDay ? styles.bubbleTextDay : styles.bubbleTextNight}>{m.text}</Text>
                          </View>
                        )}
                        {mine && status ? (
                          <View style={styles.metaRow}>
                            <Text style={[styles.meta, { color: isDay ? colors.ink50 : 'rgba(237,253,255,0.45)' }]}>{timeLabel(m.createdAt)} ·</Text>
                            <PlaneGlyph size={11} bodyFill={statusColor[status]} />
                            <Text style={[styles.statusText, { color: statusColor[status] }]}>{STATUS_LABEL[status]}</Text>
                          </View>
                        ) : (
                          <Text style={[styles.meta, isDay ? styles.metaTheirsDay : styles.metaTheirsNight]}>{timeLabel(m.createdAt)}</Text>
                        )}
                      </View>
                    </View>
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
            </View>
          )}
        </ScrollView>

        {attachError && <Text style={styles.attachError}>{attachError}</Text>}

        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {isDay ? (
            <View style={styles.composerDay}>
              <Pressable onPress={() => setAttachOpen(true)} style={styles.attachButton} accessibilityRole="button" accessibilityLabel="Share a photo, location, or poll">
                <Icon path={ATTACH_ICON} color={colors.textMuted} size={21} strokeWidth={1.8} />
              </Pressable>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={`Message ${focusedGroup.name}…`}
                placeholderTextColor={colors.textDisabled}
                style={[styles.input, noOutline]}
                onSubmitEditing={submit}
                returnKeyType="send"
              />
              <Pressable onPress={submit} style={styles.sendButtonDay} accessibilityRole="button" accessibilityLabel="Send">
                <PlaneGlyph size={19} bodyFill={colors.lime} wingFill="#8FB52E" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.composerNight}>
              <Pressable onPress={() => setAttachOpen(true)} style={styles.attachButton} accessibilityRole="button" accessibilityLabel="Share a photo, location, or poll">
                <Icon path={ATTACH_ICON} color="rgba(237,253,255,0.6)" size={21} strokeWidth={1.8} />
              </Pressable>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={`Message ${focusedGroup.name}…`}
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
            <Animated.View pointerEvents="none" style={[styles.flyingPlane, flyStyle]}>
              <PlaneGlyph size={26} bodyFill={colors.lime} wingFill="#8FB52E" />
            </Animated.View>
          )}
        </View>

        <BottomSheet visible={attachOpen} onClose={() => setAttachOpen(false)}>
          <Text style={styles.sheetTitle}>Share</Text>
          <SheetOption icon={IMAGE_ICON} label="Photo" onPress={pickPhoto} />
          <SheetOption icon={PIN_ICON} label="Current location" onPress={shareLocation} />
          <SheetOption icon={POLL_ICON} label="Poll" onPress={openPollComposer} />
          <SheetOption icon={LETTER_ICON} label="Throw a letter" onPress={openLetterComposer} />
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
          bannerCaption={focusedGroup.name}
          items={mediaItems}
          senderNameFor={mediaSenderNameFor}
        />

        <BottomSheet visible={pollOpen} onClose={() => setPollOpen(false)}>
          <Text style={styles.sheetTitle}>New poll</Text>
          <View style={styles.pollForm}>
            <TextInput
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholder="Ask a question"
              placeholderTextColor={colors.textFaint}
              style={[styles.pollInput, noOutline]}
              accessibilityLabel="Poll question"
            />
            <TextInput
              value={pollOptionA}
              onChangeText={setPollOptionA}
              placeholder="Option 1"
              placeholderTextColor={colors.textFaint}
              style={[styles.pollInput, noOutline]}
              accessibilityLabel="Poll option 1"
            />
            <TextInput
              value={pollOptionB}
              onChangeText={setPollOptionB}
              placeholder="Option 2"
              placeholderTextColor={colors.textFaint}
              style={[styles.pollInput, noOutline]}
              accessibilityLabel="Poll option 2"
            />
            <ToggleRow label="Allow multiple answers" value={pollAllowMultiple} onValueChange={setPollAllowMultiple} last />
            {pollError && <Text style={styles.attachError}>{pollError}</Text>}
            <Pressable
              onPress={submitPoll}
              disabled={pollSubmitting}
              style={[styles.pollSubmit, pollSubmitting && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Create poll"
            >
              <Text style={styles.pollSubmitLabel}>{pollSubmitting ? 'Creating…' : 'Create poll'}</Text>
            </Pressable>
          </View>
        </BottomSheet>

        <BottomSheet visible={letterOpen} onClose={() => setLetterOpen(false)}>
          <Text style={styles.sheetTitle}>Throw a letter</Text>
          <Text style={styles.sheetBody}>A short line for the card's title, and an optional place tag for its postmark (e.g. "GOA").</Text>
          <View style={styles.pollForm}>
            <TextInput
              value={letterTitle}
              onChangeText={setLetterTitle}
              placeholder="Beach day!!"
              placeholderTextColor={colors.textFaint}
              style={[styles.pollInput, noOutline]}
              maxLength={60}
              accessibilityLabel="Letter title"
            />
            <TextInput
              value={letterPlace}
              onChangeText={setLetterPlace}
              placeholder="Place tag (optional)"
              placeholderTextColor={colors.textFaint}
              style={[styles.pollInput, noOutline]}
              maxLength={8}
              autoCapitalize="characters"
              accessibilityLabel="Place tag"
            />
            {letterError && <Text style={styles.attachError}>{letterError}</Text>}
            <Pressable
              onPress={submitLetter}
              disabled={letterSubmitting}
              style={[styles.pollSubmit, letterSubmitting && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Throw it"
            >
              <Text style={styles.pollSubmitLabel}>{letterSubmitting ? 'Throwing…' : 'Throw it'}</Text>
            </Pressable>
          </View>
        </BottomSheet>

        <BottomSheet visible={!!letterDetail} onClose={() => setLetterDetail(null)}>
          {letterDetail && (
            <View style={styles.letterDetail}>
              <Text style={styles.letterDetailKicker}>PAR AVION · FROM {senderNameFor(letterDetail.senderId).toUpperCase()}</Text>
              <Text style={styles.letterDetailTitle}>{letterDetail.text}</Text>
              {letterDetail.attachmentUrl && <Text style={styles.letterDetailPlace}>{letterDetail.attachmentUrl}</Text>}
              <Text style={styles.letterDetailTime}>Thrown {timeLabel(letterDetail.createdAt)}</Text>
              <ActionButton label="Close" variant="secondary" onPress={() => setLetterDetail(null)} />
            </View>
          )}
        </BottomSheet>

        <BottomSheet visible={optionsOpen} onClose={() => setOptionsOpen(false)}>
          <Text style={styles.sheetTitle}>{focusedGroup.name}</Text>
          <SheetOption icon={EDIT_ICON} label="Rename group" onPress={openRename} />
          {isOwner ? (
            <SheetOption
              icon={TRASH_ICON}
              label="Delete group"
              destructive
              onPress={() => {
                setOptionsOpen(false);
                setConfirmDeleteOpen(true);
              }}
            />
          ) : (
            <SheetOption
              icon={LEAVE_ICON}
              label="Leave group"
              onPress={() => {
                setOptionsOpen(false);
                setConfirmLeaveOpen(true);
              }}
            />
          )}
        </BottomSheet>

        <BottomSheet visible={confirmLeaveOpen} onClose={() => setConfirmLeaveOpen(false)}>
          <Text style={styles.sheetTitle}>Leave group</Text>
          <Text style={styles.sheetBody}>Leave {focusedGroup.name}? You'll stop seeing new messages unless someone adds you back.</Text>
          <View style={styles.sheetActions}>
            <View style={styles.sheetActionFlex}>
              <ActionButton label="Cancel" variant="secondary" onPress={() => setConfirmLeaveOpen(false)} />
            </View>
            <View style={styles.sheetActionFlex}>
              <ActionButton label="Leave" variant="destructive" onPress={doLeaveGroup} />
            </View>
          </View>
        </BottomSheet>

        <BottomSheet visible={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
          <Text style={styles.sheetTitle}>Delete group</Text>
          <Text style={styles.sheetBody}>Delete {focusedGroup.name} for everyone? This removes all messages and polls too — it can't be undone.</Text>
          <View style={styles.sheetActions}>
            <View style={styles.sheetActionFlex}>
              <ActionButton label="Cancel" variant="secondary" onPress={() => setConfirmDeleteOpen(false)} />
            </View>
            <View style={styles.sheetActionFlex}>
              <ActionButton label="Delete" variant="destructive" onPress={doDeleteGroup} />
            </View>
          </View>
        </BottomSheet>

        <BottomSheet visible={renameOpen} onClose={() => setRenameOpen(false)}>
          <Text style={styles.sheetTitle}>Rename group</Text>
          <Text style={styles.sheetBody}>
            Everyone gets a Yes/No poll to confirm it. It renames as soon as a majority agrees, or automatically in an hour if no one votes.
          </Text>
          <View style={styles.pollForm}>
            <TextInput
              value={renameName}
              onChangeText={setRenameName}
              placeholder="New group name"
              placeholderTextColor={colors.textFaint}
              style={[styles.pollInput, noOutline]}
              accessibilityLabel="New group name"
            />
            {renameError && <Text style={styles.attachError}>{renameError}</Text>}
            <Pressable
              onPress={submitRename}
              disabled={renameSubmitting}
              style={[styles.pollSubmit, renameSubmitting && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Propose rename"
            >
              <Text style={styles.pollSubmitLabel}>{renameSubmitting ? 'Starting…' : 'Start rename poll'}</Text>
            </Pressable>
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
    gap: 11,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerDay: {
    backgroundColor: colors.ink,
  },
  headerNight: {
    backgroundColor: 'rgba(237,253,255,0.05)',
    borderBottomWidth: 1,
    borderColor: 'rgba(237,253,255,0.08)',
  },
  stackedAvatars: {
    flexDirection: 'row',
  },
  stackedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedAvatarText: {
    fontFamily: fontFamily.sans700,
    fontSize: 10.5,
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
  headerTitleNight: {
    color: colors.pale,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButtonNight: {
    backgroundColor: 'rgba(237,253,255,0.1)',
  },
  headerMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.onInk60,
  },
  headerMetaNight: {
    color: 'rgba(237,253,255,0.55)',
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: spacing.md,
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
    textAlign: 'center',
  },
  systemChipTextNight: {
    color: 'rgba(237,253,255,0.6)',
  },
  bubbleStack: {
    marginTop: 18,
    gap: 9,
  },
  msgWrap: {
    maxWidth: '86%',
  },
  msgWrapMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgWrapTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  senderRowMine: {
    flexDirection: 'column',
  },
  avatarSlot: {
    width: 28,
    alignItems: 'center',
  },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: {
    fontFamily: fontFamily.sans700,
    fontSize: 10,
  },
  bubbleCol: {
    gap: 4,
    minWidth: 0,
  },
  senderName: {
    fontFamily: fontFamily.sans600,
    fontSize: 12,
    paddingLeft: 6,
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
    backgroundColor: '#fff',
    borderBottomLeftRadius: 7,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 1,
  },
  bubbleTheirsNight: {
    backgroundColor: 'rgba(237,253,255,0.09)',
    borderBottomLeftRadius: 7,
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
  locationText: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
  },
  meta: {
    marginTop: 2,
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
  },
  metaTheirsDay: {
    color: colors.textDisabled,
  },
  metaTheirsNight: {
    color: 'rgba(237,253,255,0.4)',
  },
  metaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusText: {
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
  letterWrap: {
    alignSelf: 'flex-start',
    maxWidth: '86%',
  },
  letterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  letterCol: {
    gap: 4,
    flex: 1,
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
  composerDay: {
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
  sheetOptionLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sheetOptionIconDestructive: {
    backgroundColor: colors.dangerBg,
  },
  sheetOptionLabelDestructive: {
    color: colors.danger,
  },
  sheetBody: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sheetActionFlex: {
    flex: 1,
  },
  pollForm: {
    gap: spacing.ms,
  },
  pollInput: {
    backgroundColor: colors.pale,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    color: colors.textPrimary,
  },
  pollSubmit: {
    borderRadius: radius.md - 6,
    backgroundColor: colors.ink,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pollSubmitLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.lime,
  },
  pollCard: {
    borderRadius: 22,
    borderBottomLeftRadius: 7,
    padding: spacing.md,
    gap: spacing.sm,
    minWidth: 240,
  },
  pollCardDay: {
    backgroundColor: '#fff',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 1,
  },
  pollCardNight: {
    backgroundColor: 'rgba(237,253,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(237,253,255,0.07)',
  },
  pollCardLocked: {
    opacity: 0.7,
  },
  renamePollBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  renamePollBadge: {
    fontFamily: fontFamily.sans600,
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.ink55,
  },
  renamePollBadgeNight: {
    color: 'rgba(237,253,255,0.55)',
  },
  pollHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pollQuestion: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  pollQuestionNight: {
    color: colors.pale,
  },
  pollOptions: {
    gap: spacing.xs,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pollOptionBar: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.pale,
    overflow: 'hidden',
  },
  pollOptionBarNight: {
    backgroundColor: 'rgba(237,253,255,0.06)',
  },
  pollOptionFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 12,
  },
  pollOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: spacing.ms,
    gap: spacing.xs,
  },
  pollOptionLabel: {
    flex: 1,
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.textPrimary,
  },
  pollOptionLabelNight: {
    color: colors.pale,
  },
  pollOptionPct: {
    fontFamily: fontFamily.mono500,
    fontSize: 11.5,
    color: colors.ink55,
  },
  pollOptionPctNight: {
    color: 'rgba(237,253,255,0.55)',
  },
  pollMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 11,
    color: colors.textFaint,
  },
  pollMetaNight: {
    color: 'rgba(237,253,255,0.4)',
  },
  letterDetail: {
    gap: spacing.ms,
    paddingTop: spacing.xs,
  },
  letterDetailKicker: {
    fontFamily: fontFamily.mono500,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textFaint,
  },
  letterDetailTitle: {
    fontFamily: 'Caveat_700Bold',
    fontSize: 36,
    lineHeight: 38,
    color: '#2346C8',
  },
  letterDetailPlace: {
    fontFamily: fontFamily.mono500,
    fontSize: 12,
    color: colors.textSecondary,
  },
  letterDetailTime: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});
