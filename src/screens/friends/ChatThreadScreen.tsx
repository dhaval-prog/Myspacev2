import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { MemberAvatar } from '../../components/split/MemberAvatar';
import { useFriends } from '../../context/FriendsContext';
import { useAuth } from '../../context/AuthContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const SEND_ICON = 'M4 12h14M12 6l6 6-6 6';

const GRADIENT_PROPS = {
  colors: colors.friendsGradient as [string, string, ...string[]],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** A direct-message thread with one friend. */
export function ChatThreadScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { focusedFriend, messages, sendMessage, goChats } = useFriends();
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

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goChats} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.friendsInk} size={19} strokeWidth={2} />
        </Pressable>
        <MemberAvatar userId={focusedFriend.userId} name={focusedFriend.name} size={36} />
        <Text style={styles.headerTitle}>{focusedFriend.name}</Text>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {messages.length === 0 ? (
          <Text style={styles.emptyNote}>No messages yet. Say hi.</Text>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <View key={m.id} style={[styles.msgWrap, mine ? styles.msgWrapMine : styles.msgWrapTheirs]}>
                {mine ? (
                  <LinearGradient {...GRADIENT_PROPS} style={[styles.bubble, styles.bubbleMine]}>
                    <Text style={[styles.bubbleText, styles.bubbleTextMine]}>{m.text}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.bubble, styles.bubbleTheirs]}>
                    <Text style={styles.bubbleText}>{m.text}</Text>
                  </View>
                )}
                <Text style={styles.meta}>{timeLabel(m.createdAt)}</Text>
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
          placeholderTextColor={colors.friendsInkFaint45}
          style={[styles.input, noOutline]}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable onPress={submit} style={styles.sendButtonShape} accessibilityRole="button" accessibilityLabel="Send">
          <LinearGradient {...GRADIENT_PROPS} style={styles.sendButtonFill}>
            <Icon path={SEND_ICON} color="#fff" size={19} strokeWidth={2} />
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.friendsBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.friendsInkFaint08,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.friendsSurface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.friendsInk,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  headerTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 17,
    letterSpacing: -0.2,
    color: colors.friendsInk,
  },
  scroll: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.ms,
  },
  emptyNote: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: colors.friendsInkFaint45,
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
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  bubbleMine: {
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: colors.friendsSurface,
    borderBottomLeftRadius: 6,
    shadowColor: colors.friendsInk,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  bubbleText: {
    fontFamily: fontFamily.sans400,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.friendsInk,
  },
  bubbleTextMine: {
    color: '#fff',
  },
  meta: {
    fontFamily: fontFamily.sans400,
    fontSize: 11,
    color: colors.friendsInkFaint45,
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
    backgroundColor: colors.friendsSurface,
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 18,
    fontFamily: fontFamily.sans400,
    fontSize: 14.5,
    color: colors.friendsInk,
    shadowColor: colors.friendsInk,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  sendButtonShape: {
    width: 46,
    height: 46,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.friendsAccent,
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 3,
  },
  sendButtonFill: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
