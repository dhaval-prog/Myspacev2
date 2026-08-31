import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { useFriends } from '../../context/FriendsContext';
import { useAuth } from '../../context/AuthContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const SEND_ICON = 'M4 12h14M12 6l6 6-6 6';
const MORE_ICON = 'M12 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 19.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z';
const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

/** The unlocked 1:1 conversation (6p-7) — messages, with the accept moment marked inline. */
export function ChatThreadScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { focusedFriend, messages, sendMessage, goChats, removeFriend } = useFriends();
  const [text, setText] = useState('');
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

  const confirmRemove = () => {
    Alert.alert('Remove friend', `Remove ${focusedFriend.name}? This deletes your chat history too.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFriend(focusedFriend.connectionId) },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goChats} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color="#fff" size={19} strokeWidth={2} />
        </Pressable>
        <FriendAvatar userId={focusedFriend.userId} name={focusedFriend.name} size={44} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{focusedFriend.name}</Text>
        </View>
        <Pressable onPress={confirmRemove} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="More options">
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
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.text}</Text>
                </View>
                <Text style={styles.meta}>
                  {timeLabel(m.createdAt)}
                  {mine ? '  ✓✓' : ''}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
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
  meta: {
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    color: 'rgba(22,33,12,0.5)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.ms,
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
});
