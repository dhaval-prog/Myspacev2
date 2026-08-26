import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { useSplit } from '../../context/SplitContext';
import { useAuth } from '../../context/AuthContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const PLUS_ICON = 'M12 6v12M6 12h12';
const SEND_ICON = 'M4 12h14M12 6l6 6-6 6';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** The split's group chat — persisted messages, live via Supabase Realtime. */
export function SplitChatScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { focusedGroup, chatFor, sendChat, nameFor, goDashboard, goAdd } = useSplit();
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  if (!focusedGroup) return null;
  const messages = chatFor(focusedGroup.id);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const submit = () => {
    if (!text.trim()) return;
    sendChat(text);
    setText('');
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goDashboard} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.splitInk} size={19} strokeWidth={2} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Chat</Text>
          <Text style={styles.headerMeta}>{focusedGroup.name}</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {messages.length === 0 ? (
          <Text style={styles.emptyNote}>No messages yet. Say hi.</Text>
        ) : (
          messages.map((m) => {
            const mine = m.userId === user?.id;
            return (
              <View key={m.id} style={[styles.msgWrap, mine ? styles.msgWrapMine : styles.msgWrapTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.text}</Text>
                </View>
                <Text style={styles.meta}>
                  {mine ? 'You' : nameFor(m.userId)} · {timeLabel(m.createdAt)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable onPress={goAdd} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add expense">
          <Icon path={PLUS_ICON} color={colors.splitAccent} size={20} strokeWidth={2} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message the split…"
          placeholderTextColor={colors.splitInkFaint45}
          style={[styles.input, noOutline]}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable onPress={submit} style={styles.sendButton} accessibilityRole="button" accessibilityLabel="Send">
          <Icon path={SEND_ICON} color="#fff" size={19} strokeWidth={2} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.splitBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.splitInkFaint07,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.splitSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    letterSpacing: -0.2,
    color: colors.splitInk,
  },
  headerMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint45,
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
    color: colors.splitInkFaint45,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bubbleMine: {
    backgroundColor: colors.splitInk,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: colors.splitSurface,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    fontFamily: fontFamily.sans500,
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.splitInk,
  },
  bubbleTextMine: {
    color: '#fff',
  },
  meta: {
    fontFamily: fontFamily.sans400,
    fontSize: 11,
    color: colors.splitInkFaint45,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.ms,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.splitSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.splitSurface,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontFamily: fontFamily.sans400,
    fontSize: 14.5,
    color: colors.splitInk,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.splitAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
