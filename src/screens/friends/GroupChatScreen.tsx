import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { OverflowIcon } from '../../components/icons/OverflowIcon';
import { BottomSheet } from '../../components/expenses/BottomSheet';
import { ActionButton, ToggleRow } from '../../components/account/rows';
import { useFriends } from '../../context/FriendsContext';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import type { GroupPoll } from '../../types/groups';

const ATTACH_ICON = 'M12 5v14M5 12h14';
const SEND_ICON = 'M4 12 20 4l-7 16-2.5-6.5z';
const PIN_ICON = 'M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z M12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z';
const IMAGE_ICON = 'M4 5h16v14H4zM4 16l4.5-4.5 4 4L15 13l5 5';
const POLL_ICON = 'M5 20V10M12 20V4M19 20v-7';
const CHECK_ICON = 'M5 12.5 10 17.5 19 7';
const GROUP_ICON = 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75';
const PHONE_ICON = 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C9.5 21 3 14.5 3 6a2 2 0 0 1 2-2z';
const LEAVE_ICON = 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9';
const TRASH_ICON = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';

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

/** One poll message: question, tappable options, live vote counts. */
function PollCard({ poll, myUserId, onVote }: { poll: GroupPoll; myUserId: string | undefined; onVote: (optionId: string) => void }) {
  const totalVotes = new Set(Object.values(poll.votesByUser).flat()).size;
  const myVotes = myUserId ? (poll.votesByUser[myUserId] ?? []) : [];

  return (
    <View style={styles.pollCard}>
      <View style={styles.pollHeaderRow}>
        <Icon path={POLL_ICON} color={colors.ink} size={16} strokeWidth={2} />
        <Text style={styles.pollQuestion}>{poll.question}</Text>
      </View>
      <View style={styles.pollOptions}>
        {poll.options.map((opt) => {
          const voteCount = Object.values(poll.votesByUser).filter((ids) => ids.includes(opt.id)).length;
          const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const mine = myVotes.includes(opt.id);
          return (
            <Pressable
              key={opt.id}
              onPress={() => onVote(opt.id)}
              style={styles.pollOptionRow}
              accessibilityRole="button"
              accessibilityLabel={`${opt.label}, ${voteCount} vote${voteCount === 1 ? '' : 's'}`}
            >
              <View style={styles.pollOptionBar}>
                <View style={[styles.pollOptionFill, { width: `${pct}%`, backgroundColor: mine ? colors.lime : colors.pale }]} />
                <View style={styles.pollOptionContent}>
                  <Text style={styles.pollOptionLabel} numberOfLines={1}>
                    {opt.label}
                  </Text>
                  <Text style={styles.pollOptionPct}>{pct}%</Text>
                </View>
              </View>
              {mine && <Icon path={CHECK_ICON} color={colors.ink} size={14} strokeWidth={2.4} />}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.pollMeta}>
        {totalVotes} vote{totalVotes === 1 ? '' : 's'} · {poll.allowMultiple ? 'Pick any number' : 'Pick one'}
      </Text>
    </View>
  );
}

/** The group conversation — same message kinds as a 1:1 thread, plus polls. */
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
    createGroupPoll,
    voteOnPoll,
    leaveGroup,
    deleteGroup,
    goChats,
  } = useFriends();
  const { startCall } = useCall();
  const [text, setText] = useState('');
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionA, setPollOptionA] = useState('');
  const [pollOptionB, setPollOptionB] = useState('');
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [groupActionError, setGroupActionError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [groupMessages.length]);

  if (!focusedGroup) return null;

  const memberNames = groupMemberNamesFor(focusedGroup.id);
  const isOwner = focusedGroup.ownerId === user?.id;

  const startVideoCall = () => {
    const memberIds = groupMemberIdsFor(focusedGroup.id).filter((id) => id !== user?.id);
    const participantNames: Record<string, string> = {};
    memberIds.forEach((id, i) => {
      participantNames[id] = memberNames[i] ?? 'Someone';
    });
    startCall({ kind: 'group', title: focusedGroup.name, memberIds, participantNames });
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

  const submit = () => {
    if (!text.trim()) return;
    sendGroupMessage(text);
    setText('');
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
          <View style={styles.groupAvatar}>
            <Icon path={GROUP_ICON} color={colors.lime} size={20} strokeWidth={1.8} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{focusedGroup.name}</Text>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {memberNames.length > 0 ? `You, ${memberNames.join(', ')}` : 'Just you'}
            </Text>
          </View>
          <Pressable onPress={startVideoCall} style={styles.headerIconButton} accessibilityRole="button" accessibilityLabel="Start video call">
            <Icon path={PHONE_ICON} color="#FFFFFF" size={17} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={() => setOptionsOpen(true)} style={styles.headerIconButton} accessibilityRole="button" accessibilityLabel="More options">
            <OverflowIcon size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {groupActionError && <Text style={styles.attachError}>{groupActionError}</Text>}

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {groupMessages.length === 0 ? (
            <Text style={styles.emptyNote}>No messages yet. Say hi to the group.</Text>
          ) : (
            <View style={styles.bubbleStack}>
              {groupMessages.map((m) => {
                const mine = m.senderId === user?.id;
                const poll = m.kind === 'poll' && m.pollId ? groupPolls[m.pollId] : undefined;
                return (
                  <View key={m.id} style={[styles.msgWrap, mine ? styles.msgWrapMine : styles.msgWrapTheirs]}>
                    {m.kind === 'poll' ? (
                      poll ? (
                        <PollCard poll={poll} myUserId={user?.id} onVote={(optionId) => voteOnPoll(poll.id, optionId)} />
                      ) : (
                        <View style={[styles.bubble, styles.bubbleTheirs]}>
                          <Text style={styles.bubbleText}>Loading poll…</Text>
                        </View>
                      )
                    ) : m.kind === 'image' && m.attachmentUrl ? (
                      <Image source={{ uri: m.attachmentUrl }} style={styles.imageBubble} resizeMode="cover" />
                    ) : m.kind === 'location' && m.attachmentUrl ? (
                      <Pressable
                        onPress={() => Linking.openURL(m.attachmentUrl!)}
                        style={[styles.bubble, styles.locationBubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                      >
                        <Icon path={PIN_ICON} color={mine ? colors.ink : colors.lime} size={16} strokeWidth={1.8} />
                        <Text style={[styles.locationText, mine && styles.bubbleTextMine]}>Location shared · Open in Maps</Text>
                      </Pressable>
                    ) : (
                      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.text}</Text>
                      </View>
                    )}
                    <Text style={[styles.meta, mine ? styles.metaMine : styles.metaTheirs]}>{timeLabel(m.createdAt)}</Text>
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
            <Pressable onPress={submit} style={styles.sendButton} accessibilityRole="button" accessibilityLabel="Send">
              <Icon path={SEND_ICON} color={colors.lime} size={19} strokeWidth={1.9} />
            </Pressable>
          </View>
        </View>

        <BottomSheet visible={attachOpen} onClose={() => setAttachOpen(false)}>
          <Text style={styles.sheetTitle}>Share</Text>
          <SheetOption icon={IMAGE_ICON} label="Photo" onPress={pickPhoto} />
          <SheetOption icon={PIN_ICON} label="Current location" onPress={shareLocation} />
          <SheetOption icon={POLL_ICON} label="Poll" onPress={openPollComposer} />
        </BottomSheet>

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

        <BottomSheet visible={optionsOpen} onClose={() => setOptionsOpen(false)}>
          <Text style={styles.sheetTitle}>{focusedGroup.name}</Text>
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
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
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
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.onInk60,
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
  bubbleStack: {
    marginTop: 18,
    gap: 9,
  },
  msgWrap: {
    maxWidth: '82%',
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
    backgroundColor: colors.splitDangerBg,
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
    backgroundColor: '#fff',
    borderRadius: 22,
    borderBottomLeftRadius: 7,
    padding: spacing.md,
    gap: spacing.sm,
    minWidth: 240,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 1,
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
  pollOptionPct: {
    fontFamily: fontFamily.mono500,
    fontSize: 11.5,
    color: colors.ink55,
  },
  pollMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 11,
    color: colors.textFaint,
  },
});
