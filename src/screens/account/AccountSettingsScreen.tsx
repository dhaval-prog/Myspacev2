import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, fontFamily, radius, spacing, typography } from '../../theme';
import { Icon } from '../../components/Icon';
import { BottomSheet } from '../../components/expenses/BottomSheet';
import { ActionButton, Card, InlineError, InlineNote, Row, SectionLabel, TextField } from '../../components/account/rows';
import { useAuth } from '../../context/AuthContext';
import { useSpace } from '../../context/SpaceContext';
import { supabase } from '../../lib/supabase';
import { downloadCsv, downloadJson } from '../../utils/accountExport';

const BACK_ICON = 'M15 5l-7 7 7 7';
const CAMERA_ICON = 'M4 8h3l1.5-2h7L17 8h3v11H4V8z M12 12.5a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6z';

/** One slide-up confirm sheet, reused for every "are you sure" in this screen — logout variants share this shape as-is; the two delete flows extend it with password/phrase fields of their own. */
function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <Text style={sheetStyles.title}>{title}</Text>
      <Text style={sheetStyles.body}>{message}</Text>
      <View style={sheetStyles.actions}>
        <View style={sheetStyles.actionFlex}>
          <ActionButton label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={sheetStyles.actionFlex}>
          <ActionButton label={confirmLabel} variant={destructive ? 'destructive' : 'primary'} onPress={onConfirm} />
        </View>
      </View>
    </BottomSheet>
  );
}

function strengthBarColor(barIndex: number, strength: number): string {
  if (strength < barIndex) return colors.badgeInactiveBg;
  if (strength === 1) return colors.danger;
  if (strength === 2) return colors.textMuted;
  return colors.ink;
}

interface ProfileRow {
  full_name: string | null;
  username: string | null;
  phone: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  profile_visibility: 'only_me' | 'space_members';
}

type NotificationPrefs = Record<string, { push: boolean; email: boolean; inApp: boolean }>;

const NOTIFICATION_CATEGORIES: { key: string; label: string }[] = [
  { key: 'expiring_items', label: 'Expiring items' },
  { key: 'item_reminders', label: 'Item reminders' },
  { key: 'budget_alerts', label: 'Budget alerts' },
  { key: 'budget_reset', label: 'Budget reset reminders' },
  { key: 'split_activity', label: 'Split expense activity' },
  { key: 'payment_activity', label: 'UPI payment activity' },
  { key: 'invitations', label: 'New invitations' },
  { key: 'shared_space_activity', label: 'Shared space activity' },
];

const UPI_ID_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/;
const CHANNELS: { key: 'push' | 'email' | 'inApp'; label: string }[] = [
  { key: 'push', label: 'Push' },
  { key: 'email', label: 'Email' },
  { key: 'inApp', label: 'In-app' },
];

function defaultPrefs(): NotificationPrefs {
  const prefs: NotificationPrefs = {};
  for (const c of NOTIFICATION_CATEGORIES) prefs[c.key] = { push: true, email: true, inApp: true };
  return prefs;
}

function mergePrefs(stored: Partial<NotificationPrefs> | null | undefined): NotificationPrefs {
  const base = defaultPrefs();
  if (!stored) return base;
  for (const c of NOTIFICATION_CATEGORIES) {
    const s = stored[c.key];
    if (s) base[c.key] = { push: s.push ?? true, email: s.email ?? true, inApp: s.inApp ?? true };
  }
  return base;
}

interface SharedGroup {
  id: string;
  name: string;
  rid: string;
  isOwner: boolean;
  whoCanAdd: 'anyone' | 'owner';
  memberCount: number;
}

interface SharedCard {
  id: string;
  label: string;
  rid: string;
  isOwner: boolean;
  memberCount: number;
}

function initials(fullName?: string | null, email?: string | null): string {
  const name = fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  }
  const local = email?.split('@')[0]?.trim();
  return local ? local.slice(0, 2).toUpperCase() : '••';
}

const IDENTITY_LABELS: Record<string, string> = {
  email: 'Email & password',
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
};

interface AccountSettingsScreenProps {
  onBack: () => void;
}

/**
 * Full account settings: profile, security, notifications, shared spaces,
 * data & privacy, and a visually-separated danger zone at the bottom.
 * Reachable from Home, Expenses, and Split alike, so it uses a neutral
 * (lime/pale/ink) treatment rather than any one section's own theme.
 */
export function AccountSettingsScreen({ onBack }: AccountSettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { user, signOut, updatePassword, updateProfileName } = useAuth();
  const { items } = useSpace();
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);

  // --- Profile ---
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // --- Security ---
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [pwShow, setPwShow] = useState(false);
  const [logoutOthersConfirm, setLogoutOthersConfirm] = useState(false);
  const [logoutAllConfirm, setLogoutAllConfirm] = useState(false);

  // --- Payments (UPI) ---
  const [upiId, setUpiId] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);
  const [upiSaving, setUpiSaving] = useState(false);
  const [upiVerifying, setUpiVerifying] = useState(false);
  const [upiError, setUpiError] = useState<string | null>(null);
  const [upiSaved, setUpiSaved] = useState(false);

  // --- Notifications ---
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs());

  // --- Shared spaces ---
  const [sharedGroups, setSharedGroups] = useState<SharedGroup[]>([]);
  const [sharedCards, setSharedCards] = useState<SharedCard[]>([]);

  // --- Data & privacy ---
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'only_me' | 'space_members'>('space_members');
  const [visibilitySaving, setVisibilitySaving] = useState(false);

  // --- Danger zone ---
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [deleteDataModal, setDeleteDataModal] = useState(false);
  const [deleteDataPassword, setDeleteDataPassword] = useState('');
  const [deleteDataPhrase, setDeleteDataPhrase] = useState('');
  const [deleteDataSaving, setDeleteDataSaving] = useState(false);
  const [deleteDataError, setDeleteDataError] = useState<string | null>(null);
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountPhrase, setDeleteAccountPhrase] = useState('');
  const [deleteAccountSaving, setDeleteAccountSaving] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLoading(false);
      return;
    }
    (async () => {
      const [profileRes, settingsRes, groupsRes, cardsRes, paymentProfileRes] = await Promise.all([
        supabase.from('profiles').select('full_name,username,phone,date_of_birth,avatar_url,profile_visibility').eq('id', userId).maybeSingle(),
        supabase.from('user_settings').select('notification_prefs').eq('user_id', userId).maybeSingle(),
        supabase.from('split_groups').select('id,name,rid,owner_id,who_can_add'),
        supabase.from('budget_cards').select('id,label,rid,owner_id'),
        supabase.from('user_payment_profiles').select('upi_id,upi_verified').eq('user_id', userId).maybeSingle(),
      ]);
      if (cancelled) return;

      const paymentProfile = paymentProfileRes.data as { upi_id: string | null; upi_verified: boolean } | null;
      if (paymentProfile) {
        setUpiId(paymentProfile.upi_id ?? '');
        setUpiVerified(paymentProfile.upi_verified);
      }

      const p = profileRes.data as ProfileRow | null;
      if (p) {
        setProfile(p);
        setFullName(p.full_name ?? '');
        setUsername(p.username ?? '');
        setPhone(p.phone ?? '');
        setDob(p.date_of_birth ?? '');
        setVisibility(p.profile_visibility ?? 'space_members');
      }
      setPrefs(mergePrefs((settingsRes.data?.notification_prefs as Partial<NotificationPrefs>) ?? null));

      const groups = (groupsRes.data as { id: string; name: string; rid: string; owner_id: string; who_can_add: 'anyone' | 'owner' }[] | null) ?? [];
      const cards = (cardsRes.data as { id: string; label: string; rid: string; owner_id: string }[] | null) ?? [];

      const [membersRes, cardMembersRes] = await Promise.all([
        groups.length ? supabase.from('split_members').select('group_id').in('group_id', groups.map((g) => g.id)) : Promise.resolve({ data: [] as { group_id: string }[] }),
        cards.length ? supabase.from('card_members').select('card_id').in('card_id', cards.map((c) => c.id)) : Promise.resolve({ data: [] as { card_id: string }[] }),
      ]);
      if (cancelled) return;

      const memberRows = (membersRes.data as { group_id: string }[] | null) ?? [];
      const cardMemberRows = (cardMembersRes.data as { card_id: string }[] | null) ?? [];

      setSharedGroups(
        groups.map((g) => ({
          id: g.id,
          name: g.name,
          rid: g.rid,
          isOwner: g.owner_id === userId,
          whoCanAdd: g.who_can_add,
          // +1 for the owner, who isn't a row in split_members.
          memberCount: memberRows.filter((m) => m.group_id === g.id).length + 1,
        })),
      );
      setSharedCards(
        cards.map((c) => ({
          id: c.id,
          label: c.label,
          rid: c.rid,
          isOwner: c.owner_id === userId,
          memberCount: cardMemberRows.filter((m) => m.card_id === c.id).length + 1,
        })),
      );

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveProfile = async () => {
    if (!userId) return;
    setProfileSaving(true);
    setProfileError(null);

    const dobTrim = dob.trim();
    if (dobTrim && !/^\d{4}-\d{2}-\d{2}$/.test(dobTrim)) {
      setProfileError('Date of birth must be in YYYY-MM-DD format.');
      setProfileSaving(false);
      return;
    }
    const usernameTrim = username.trim().toLowerCase();
    if (usernameTrim && !/^[a-z0-9_]{3,20}$/.test(usernameTrim)) {
      setProfileError('Username must be 3–20 characters: letters, numbers, underscores.');
      setProfileSaving(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        username: usernameTrim || null,
        phone: phone.trim() || null,
        date_of_birth: dobTrim || null,
      })
      .eq('id', userId);

    if (error) {
      setProfileError(error.code === '23505' ? 'That username is already taken.' : error.message);
      setProfileSaving(false);
      return;
    }

    await updateProfileName(fullName.trim());
    setProfile((p) => (p ? { ...p, full_name: fullName.trim(), username: usernameTrim, phone: phone.trim(), date_of_birth: dobTrim } : p));
    setProfileSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const pickAvatar = async () => {
    if (!userId) return;
    setAvatarError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarError('Photo library permission was denied.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets || !result.assets[0]) return;

    setAvatarUploading(true);
    try {
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const ext = (asset.uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: profErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
      if (profErr) throw profErr;
      setProfile((p) => (p ? { ...p, avatar_url: publicUrl } : p));
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'Could not update your photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const openPasswordSheet = () => {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(false);
    setPwShow(false);
    setPasswordSheetOpen(true);
  };

  const changePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError('Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords don’t match.');
      return;
    }
    setPasswordSaving(true);
    const { error } = await updatePassword(newPassword);
    setPasswordSaving(false);
    if (error) {
      setPasswordError(error);
      return;
    }
    setPasswordSuccess(true);
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => {
      setPasswordSuccess(false);
      setPasswordSheetOpen(false);
    }, 1200);
  };

  const saveUpiId = async () => {
    if (!userId) return;
    const trimmed = upiId.trim();
    setUpiError(null);
    if (!trimmed) {
      setUpiError('Enter a UPI ID.');
      return;
    }
    if (!UPI_ID_PATTERN.test(trimmed)) {
      setUpiError('That doesn’t look like a valid UPI ID (e.g. name@bank).');
      return;
    }
    setUpiSaving(true);
    // Changing the UPI ID always resets verification — a new ID needs to be re-verified.
    const { error } = await supabase
      .from('user_payment_profiles')
      .upsert({ user_id: userId, upi_id: trimmed, upi_verified: false }, { onConflict: 'user_id' });
    setUpiSaving(false);
    if (error) {
      setUpiError(error.message);
      return;
    }
    setUpiId(trimmed);
    setUpiVerified(false);
    setUpiSaved(true);
    setTimeout(() => setUpiSaved(false), 2000);
  };

  const verifyUpiId = async () => {
    setUpiError(null);
    setUpiVerifying(true);
    const { error } = await supabase.rpc('verify_own_upi_id');
    setUpiVerifying(false);
    if (error) {
      setUpiError(error.message);
      return;
    }
    setUpiVerified(true);
  };

  const togglePref = (categoryKey: string, channel: 'push' | 'email' | 'inApp') => {
    if (!userId) return;
    setPrefs((prev) => {
      const next = { ...prev, [categoryKey]: { ...prev[categoryKey], [channel]: !prev[categoryKey][channel] } };
      supabase
        .from('user_settings')
        .upsert({ user_id: userId, notification_prefs: next }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) console.warn('[account] failed to save notification prefs:', error.message);
        });
      return next;
    });
  };

  const toggleWhoCanAdd = (groupId: string, anyoneCanAdd: boolean) => {
    const next: 'anyone' | 'owner' = anyoneCanAdd ? 'anyone' : 'owner';
    setSharedGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, whoCanAdd: next } : g)));
    supabase
      .from('split_groups')
      .update({ who_can_add: next })
      .eq('id', groupId)
      .then(({ error }) => {
        if (error) console.warn('[account] failed to update who_can_add:', error.message);
      });
  };

  const saveVisibility = (next: 'only_me' | 'space_members') => {
    if (!userId || next === visibility) return;
    setVisibility(next);
    setVisibilitySaving(true);
    supabase
      .from('profiles')
      .update({ profile_visibility: next })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.warn('[account] failed to update visibility:', error.message);
        setVisibilitySaving(false);
      });
  };

  const exportInventory = () => {
    setExportingKey('inventory');
    downloadCsv('myspace-inventory.csv', items.map((it) => ({ name: it.name, category: it.category, room: it.room, expiry: it.expiry || '' })));
    setExportingKey(null);
  };

  const exportBudgets = async () => {
    setExportingKey('budgets');
    try {
      const cardIds = sharedCards.map((c) => c.id);
      const rows = cardIds.length ? ((await supabase.from('card_expenses').select('card_id,title,amount,category,spent_on').in('card_id', cardIds)).data as Record<string, unknown>[] | null) ?? [] : [];
      const cardById = new Map(sharedCards.map((c) => [c.id, c.label]));
      downloadCsv(
        'myspace-budgets.csv',
        rows.map((e) => ({ card: cardById.get(e.card_id as string) ?? '', title: e.title, amount: e.amount, category: e.category, date: e.spent_on })),
      );
    } finally {
      setExportingKey(null);
    }
  };

  const exportExpenseHistory = async () => {
    setExportingKey('expenses');
    try {
      const groupIds = sharedGroups.map((g) => g.id);
      const rows = groupIds.length ? ((await supabase.from('split_expenses').select('group_id,title,amount,category,paid_by,created_at').in('group_id', groupIds)).data as Record<string, unknown>[] | null) ?? [] : [];
      const groupById = new Map(sharedGroups.map((g) => [g.id, g.name]));
      downloadCsv(
        'myspace-split-expenses.csv',
        rows.map((e) => ({ split: groupById.get(e.group_id as string) ?? '', title: e.title, amount: e.amount, category: e.category, paidBy: e.paid_by, date: e.created_at })),
      );
    } finally {
      setExportingKey(null);
    }
  };

  const downloadAllData = async () => {
    setExportingKey('all');
    try {
      const cardIds = sharedCards.map((c) => c.id);
      const groupIds = sharedGroups.map((g) => g.id);
      const [cardExpensesRes, splitExpensesRes, settlementsRes] = await Promise.all([
        cardIds.length ? supabase.from('card_expenses').select('*').in('card_id', cardIds) : Promise.resolve({ data: [] as unknown[] }),
        groupIds.length ? supabase.from('split_expenses').select('*').in('group_id', groupIds) : Promise.resolve({ data: [] as unknown[] }),
        groupIds.length ? supabase.from('split_settlements').select('*').in('group_id', groupIds) : Promise.resolve({ data: [] as unknown[] }),
      ]);
      downloadJson('myspace-my-data.json', {
        exportedAt: new Date().toISOString(),
        profile,
        email: user?.email,
        items,
        budgetCards: sharedCards,
        cardExpenses: cardExpensesRes.data ?? [],
        splitGroups: sharedGroups,
        splitExpenses: splitExpensesRes.data ?? [],
        splitSettlements: settlementsRes.data ?? [],
      });
    } finally {
      setExportingKey(null);
    }
  };

  const runDangerAction = async (
    password: string,
    setError: (e: string | null) => void,
    setSaving: (v: boolean) => void,
    rpcName: 'delete_own_data' | 'delete_own_account',
    onSuccess: () => void,
  ) => {
    if (!user?.email) return;
    setError(null);
    setSaving(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (authError) {
      setError('Incorrect password.');
      setSaving(false);
      return;
    }
    const { error } = await supabase.rpc(rpcName);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSuccess();
  };

  const confirmDeleteData = () =>
    runDangerAction(deleteDataPassword, setDeleteDataError, setDeleteDataSaving, 'delete_own_data', () => {
      setDeleteDataModal(false);
      setDeleteDataPassword('');
      setDeleteDataPhrase('');
      if (typeof window !== 'undefined') window.location.reload();
    });

  const confirmDeleteAccount = () =>
    runDangerAction(deleteAccountPassword, setDeleteAccountError, setDeleteAccountSaving, 'delete_own_account', () => {
      signOut('local');
    });

  const identities = Array.from(new Set((user?.identities ?? []).map((i) => i.provider)));

  const pwLen = newPassword.length;
  const passwordStrength = pwLen === 0 ? 0 : pwLen < 8 ? 1 : /[0-9]/.test(newPassword) && /[^a-zA-Z0-9]/.test(newPassword) ? 3 : 2;
  const passwordStrengthLabel = ['', 'Too short', 'Okay', 'Strong'][passwordStrength];

  if (loading) {
    return (
      <View style={[styles.screen, styles.loadingWrap]}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.lime} />
      <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.heroTopRow}>
          <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
            <Icon path={BACK_ICON} color={colors.textPrimary} size={17} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.heroTitle}>Account settings</Text>
          <View style={styles.backButton} />
        </View>

        <Pressable onPress={pickAvatar} accessibilityRole="button" accessibilityLabel="Change profile photo" style={styles.avatarWrap}>
          {profile?.avatar_url ? (
            <View style={styles.avatarImageWrap}>
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            </View>
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{initials(fullName, user?.email)}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            {avatarUploading ? <ActivityIndicator size="small" color={colors.ink} /> : <Icon path={CAMERA_ICON} color={colors.ink} size={13} strokeWidth={2} />}
          </View>
        </Pressable>
        <Text style={styles.profileName}>{fullName || 'Add your name'}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
        <InlineError>{avatarError}</InlineError>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.huge }]}>
        <SectionLabel>Profile</SectionLabel>
        <Card>
          <TextField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" autoCapitalize="words" />
          <TextField label="Username / MySpace ID" value={username} onChangeText={setUsername} placeholder="username" />
          <TextField label="Email address" value={user?.email ?? ''} editable={false} />
          <TextField label="Phone number (optional)" value={phone} onChangeText={setPhone} placeholder="+91 …" keyboardType="phone-pad" />
          <TextField label="Date of birth (optional)" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" />
          <View style={styles.saveRow}>
            <InlineError>{profileError}</InlineError>
            <ActionButton
              label={profileSaved ? 'Saved ✓' : 'Save changes'}
              variant={profileSaved ? 'success' : 'primary'}
              onPress={saveProfile}
              loading={profileSaving}
            />
          </View>
        </Card>

        {/* Security & Login */}
        <SectionLabel>Security & login</SectionLabel>
        <Card>
          <Row label="Change password" onPress={openPasswordSheet} />
          {identities.length > 0 ? (
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>Connected login methods</Text>
              <View style={styles.identityChips}>
                {identities.map((p) => (
                  <View key={p} style={styles.identityChip}>
                    <Text style={styles.identityChipText}>{IDENTITY_LABELS[p] ?? p}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <Row label="Biometric login" sublabel="Face ID / Touch ID / Fingerprint" badge="Coming soon" />
          <Row label="Two-factor authentication" badge="Coming soon" />
          <Row label="Active devices" badge="Coming soon" />
          <Row label="Log out of other devices" sublabel="Keeps you signed in here" onPress={() => setLogoutOthersConfirm(true)} />
          <Row label="Log out of all devices" sublabel="Including this one" destructive onPress={() => setLogoutAllConfirm(true)} last />
        </Card>

        {/* Payments */}
        <SectionLabel>Payments</SectionLabel>
        <Card>
          <View style={styles.upiHeaderRow}>
            <Text style={styles.subHeading}>UPI ID</Text>
            {upiVerified ? (
              <View style={styles.upiVerifiedBadge}>
                <Text style={styles.upiVerifiedBadgeText}>Verified ✓</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.emptyText}>Save your UPI ID so split members can pay you directly.</Text>
          <TextField
            label="UPI ID"
            value={upiId}
            onChangeText={(v) => {
              setUpiId(v);
              setUpiSaved(false);
            }}
            placeholder="yourname@bank"
            autoCapitalize="none"
          />
          <InlineError>{upiError}</InlineError>
          {upiSaved && !upiVerified ? <InlineNote>Saved — verify it below so others can pay you.</InlineNote> : null}
          <View style={[sheetStyles.actions, styles.upiActions]}>
            <View style={sheetStyles.actionFlex}>
              <ActionButton label="Save UPI ID" variant="secondary" onPress={saveUpiId} loading={upiSaving} />
            </View>
            <View style={sheetStyles.actionFlex}>
              <ActionButton
                label={upiVerified ? 'Verified ✓' : 'Verify UPI ID'}
                variant={upiVerified ? 'success' : 'primary'}
                onPress={verifyUpiId}
                loading={upiVerifying}
                disabled={upiVerified || !upiId.trim()}
              />
            </View>
          </View>
          <InlineNote>
            Verifying confirms your UPI ID is well-formed and ready to receive payments — it isn't a bank confirmation that this ID
            belongs to you, so double-check it's correct.
          </InlineNote>
        </Card>

        {/* Notifications */}
        <SectionLabel>Notifications</SectionLabel>
        <Card>
          <View style={styles.notifLegend}>
            <Text style={styles.notifLegendText}>P · Push   E · Email   I · In-app</Text>
          </View>
          {NOTIFICATION_CATEGORIES.map((c, i) => (
            <View key={c.key} style={[styles.notifRow, i !== NOTIFICATION_CATEGORIES.length - 1 && styles.notifRowDivider]}>
              <Text style={styles.notifLabel}>{c.label}</Text>
              <View style={styles.notifChips}>
                {CHANNELS.map((ch) => {
                  const active = prefs[c.key]?.[ch.key] ?? true;
                  return (
                    <Pressable
                      key={ch.key}
                      onPress={() => togglePref(c.key, ch.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.label} — ${ch.label}`}
                      style={[styles.notifChip, active && styles.notifChipActive]}
                    >
                      <Text style={[styles.notifChipText, active && styles.notifChipTextActive]}>{ch.label[0]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </Card>

        {/* Shared Spaces & Invitations */}
        <SectionLabel>Shared spaces & invitations</SectionLabel>
        <Card>
          <Text style={styles.subHeading}>Split groups</Text>
          {sharedGroups.length === 0 ? (
            <Text style={styles.emptyText}>No splits yet.</Text>
          ) : (
            sharedGroups.map((g) => (
              <View key={g.id} style={styles.spaceItem}>
                <View style={styles.spaceItemHeader}>
                  <Text style={styles.spaceItemTitle} numberOfLines={1}>
                    {g.name}
                  </Text>
                  <View style={[styles.rolePill, g.isOwner && styles.rolePillOwner]}>
                    <Text style={[styles.rolePillText, g.isOwner && styles.rolePillTextOwner]}>{g.isOwner ? 'Owner' : 'Member'}</Text>
                  </View>
                </View>
                <Text style={styles.spaceItemMeta}>
                  {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'} · Invite code {g.rid}
                </Text>
                {g.isOwner ? (
                  <View style={styles.spacePermRow}>
                    <Text style={styles.spacePermLabel}>Anyone can add expenses</Text>
                    <Switch
                      value={g.whoCanAdd === 'anyone'}
                      onValueChange={(v) => toggleWhoCanAdd(g.id, v)}
                      trackColor={{ false: colors.badgeInactiveBg, true: colors.ink }}
                      thumbColor={colors.white}
                    />
                  </View>
                ) : null}
              </View>
            ))
          )}

          <Text style={[styles.subHeading, styles.subHeadingSpaced]}>Budget cards</Text>
          {sharedCards.length === 0 ? (
            <Text style={styles.emptyText}>No budget cards yet.</Text>
          ) : (
            sharedCards.map((c) => (
              <View key={c.id} style={styles.spaceItem}>
                <View style={styles.spaceItemHeader}>
                  <Text style={styles.spaceItemTitle} numberOfLines={1}>
                    {c.label}
                  </Text>
                  <View style={[styles.rolePill, c.isOwner && styles.rolePillOwner]}>
                    <Text style={[styles.rolePillText, c.isOwner && styles.rolePillTextOwner]}>{c.isOwner ? 'Owner' : 'Member'}</Text>
                  </View>
                </View>
                <Text style={styles.spaceItemMeta}>
                  {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'} · Invite code {c.rid}
                </Text>
              </View>
            ))
          )}
          <InlineNote>
            Finer-grained edit / delete / invite permissions per member are coming soon — for now, whoever owns a space controls it.
          </InlineNote>
        </Card>

        {/* Data & Privacy */}
        <SectionLabel>Data & privacy</SectionLabel>
        <Card>
          <Row label="Download my data" sublabel="Everything below, as one JSON file" value={exportingKey === 'all' ? 'Preparing…' : undefined} onPress={downloadAllData} />
          <Row label="Export inventory" sublabel="Items, CSV" value={exportingKey === 'inventory' ? 'Preparing…' : undefined} onPress={exportInventory} />
          <Row label="Export budgets" sublabel="Budget card spending, CSV" value={exportingKey === 'budgets' ? 'Preparing…' : undefined} onPress={exportBudgets} />
          <Row label="Export expense history" sublabel="Split expenses, CSV" value={exportingKey === 'expenses' ? 'Preparing…' : undefined} onPress={exportExpenseHistory} />
          <Row
            label="Data usage"
            value={`${items.length} items · ${sharedCards.length} cards · ${sharedGroups.length} splits`}
            last
          />
        </Card>
        <Card style={styles.cardSpaced}>
          <Text style={styles.subHeading}>Profile visibility</Text>
          <Text style={styles.emptyText}>Who can see your profile on spaces you share.</Text>
          <View style={styles.segmented}>
            <Pressable
              onPress={() => saveVisibility('only_me')}
              style={[styles.segment, visibility === 'only_me' && styles.segmentActive]}
              accessibilityRole="button"
              accessibilityLabel="Only me"
            >
              <Text style={[styles.segmentText, visibility === 'only_me' && styles.segmentTextActive]}>Only me</Text>
            </Pressable>
            <Pressable
              onPress={() => saveVisibility('space_members')}
              style={[styles.segment, visibility === 'space_members' && styles.segmentActive]}
              accessibilityRole="button"
              accessibilityLabel="People in my shared spaces"
            >
              <Text style={[styles.segmentText, visibility === 'space_members' && styles.segmentTextActive]}>People in my spaces</Text>
            </Pressable>
          </View>
          {visibilitySaving ? <InlineNote>Saving…</InlineNote> : null}
        </Card>

        {/* Danger Zone */}
        <SectionLabel>Danger zone</SectionLabel>
        <Card style={styles.dangerCard}>
          <Row label="Log out" onPress={() => setLogoutConfirm(true)} />
          <Row label="Delete all my data" sublabel="Items, budgets, splits — keeps your account" destructive onPress={() => setDeleteDataModal(true)} />
          <Row label="Delete MySpace account" sublabel="Permanently removes everything" destructive onPress={() => setDeleteAccountModal(true)} last />
        </Card>
      </ScrollView>

      {/* Change password */}
      <BottomSheet visible={passwordSheetOpen} onClose={() => setPasswordSheetOpen(false)}>
        <View style={sheetStyles.titleRow}>
          <Text style={[sheetStyles.title, sheetStyles.titleFlex]}>Change password</Text>
          <Pressable onPress={() => setPwShow((v) => !v)} accessibilityRole="button" accessibilityLabel={pwShow ? 'Hide password' : 'Show password'}>
            <Text style={sheetStyles.showToggle}>{pwShow ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>
        <TextField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry={!pwShow} placeholder="At least 8 characters" />
        {newPassword.length > 0 ? (
          <View style={sheetStyles.strengthRow}>
            <View style={sheetStyles.strengthBars}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={[sheetStyles.strengthBar, { backgroundColor: strengthBarColor(i, passwordStrength) }]} />
              ))}
            </View>
            <Text style={sheetStyles.strengthLabel}>{passwordStrengthLabel}</Text>
          </View>
        ) : null}
        <TextField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!pwShow} placeholder="Repeat password" />
        <InlineError>{passwordError}</InlineError>
        {passwordSuccess ? <InlineNote>Password updated.</InlineNote> : null}
        <View style={sheetStyles.actions}>
          <View style={sheetStyles.actionFlex}>
            <ActionButton label="Cancel" variant="secondary" onPress={() => setPasswordSheetOpen(false)} />
          </View>
          <View style={sheetStyles.actionFlex}>
            <ActionButton label="Update" onPress={changePassword} loading={passwordSaving} />
          </View>
        </View>
      </BottomSheet>

      <ConfirmSheet
        visible={logoutOthersConfirm}
        title="Log out of other devices"
        message="You'll stay signed in here, but every other device will need to sign in again."
        confirmLabel="Log out others"
        destructive
        onCancel={() => setLogoutOthersConfirm(false)}
        onConfirm={() => {
          setLogoutOthersConfirm(false);
          signOut('others');
        }}
      />
      <ConfirmSheet
        visible={logoutAllConfirm}
        title="Log out of all devices"
        message="This signs you out here too — you'll need to log in again."
        confirmLabel="Log out everywhere"
        destructive
        onCancel={() => setLogoutAllConfirm(false)}
        onConfirm={() => {
          setLogoutAllConfirm(false);
          signOut('global');
        }}
      />
      <ConfirmSheet
        visible={logoutConfirm}
        title="Log out"
        message="Log out of MySpace?"
        confirmLabel="Log out"
        destructive
        onCancel={() => setLogoutConfirm(false)}
        onConfirm={() => {
          setLogoutConfirm(false);
          signOut('local');
        }}
      />

      {/* Delete all data */}
      <BottomSheet visible={deleteDataModal} onClose={() => setDeleteDataModal(false)}>
        <Text style={sheetStyles.title}>Delete all my data</Text>
        <Text style={sheetStyles.body}>
          This permanently deletes every item, budget card, and split you own — for everyone they're shared with. Your
          account itself stays active. This can't be undone.
        </Text>
        <TextField label="Password" value={deleteDataPassword} onChangeText={setDeleteDataPassword} secureTextEntry placeholder="Confirm your password" />
        <TextField label='Type "DELETE" to confirm' value={deleteDataPhrase} onChangeText={setDeleteDataPhrase} placeholder="DELETE" autoCapitalize="none" />
        <InlineError>{deleteDataError}</InlineError>
        <View style={sheetStyles.actions}>
          <View style={sheetStyles.actionFlex}>
            <ActionButton label="Cancel" variant="secondary" onPress={() => setDeleteDataModal(false)} />
          </View>
          <View style={sheetStyles.actionFlex}>
            <ActionButton
              label="Delete data"
              variant="destructive"
              disabled={deleteDataPhrase !== 'DELETE' || !deleteDataPassword}
              loading={deleteDataSaving}
              onPress={confirmDeleteData}
            />
          </View>
        </View>
      </BottomSheet>

      {/* Delete account */}
      <BottomSheet visible={deleteAccountModal} onClose={() => setDeleteAccountModal(false)}>
        <Text style={sheetStyles.title}>Delete MySpace account</Text>
        <Text style={sheetStyles.body}>
          This will permanently remove your spaces, items, budgets, and associated data, and delete your account. This can't be
          undone.
        </Text>
        <TextField label="Password" value={deleteAccountPassword} onChangeText={setDeleteAccountPassword} secureTextEntry placeholder="Confirm your password" />
        <TextField
          label='Type "DELETE MY ACCOUNT" to confirm'
          value={deleteAccountPhrase}
          onChangeText={setDeleteAccountPhrase}
          placeholder="DELETE MY ACCOUNT"
          autoCapitalize="none"
        />
        <InlineError>{deleteAccountError}</InlineError>
        <View style={sheetStyles.actions}>
          <View style={sheetStyles.actionFlex}>
            <ActionButton label="Cancel" variant="secondary" onPress={() => setDeleteAccountModal(false)} />
          </View>
          <View style={sheetStyles.actionFlex}>
            <ActionButton
              label="Delete account"
              variant="destructive"
              disabled={deleteAccountPhrase !== 'DELETE MY ACCOUNT' || !deleteAccountPassword}
              loading={deleteAccountSaving}
              onPress={confirmDeleteAccount}
            />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.lime,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  heroTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(22,33,12,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 17,
    color: colors.textPrimary,
  },
  body: {
    flex: 1,
    backgroundColor: colors.pale,
    borderTopLeftRadius: radius.organic,
  },
  scroll: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    gap: spacing.ms,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: spacing.xs,
  },
  avatarImageWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: 'hidden',
    backgroundColor: colors.badgeInactiveBg,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontFamily: fontFamily.sans700,
    fontSize: 26,
    color: colors.lime,
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.lime,
  },
  profileName: {
    fontFamily: fontFamily.sans700,
    fontSize: 20,
    color: colors.textPrimary,
  },
  profileEmail: {
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  cardSpaced: {
    marginTop: spacing.xs,
  },
  saveRow: {
    gap: spacing.xs,
    paddingTop: spacing.ms,
    paddingBottom: spacing.sm,
  },
  identityRow: {
    paddingVertical: 14,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  identityLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  identityChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  identityChip: {
    backgroundColor: colors.pressWash,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  identityChipText: {
    fontFamily: fontFamily.sans600,
    fontSize: 12,
    color: colors.textPrimary,
  },
  notifLegend: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    marginBottom: 4,
  },
  notifLegendText: {
    fontFamily: fontFamily.mono500,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: colors.textFaint,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.ms,
    paddingVertical: 12,
  },
  notifRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  notifLabel: {
    flex: 1,
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.textPrimary,
  },
  notifChips: {
    flexDirection: 'row',
    gap: 6,
  },
  notifChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.badgeInactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifChipActive: {
    backgroundColor: colors.ink,
  },
  notifChipText: {
    fontFamily: fontFamily.sans700,
    fontSize: 11,
    color: colors.badgeInactiveFg,
  },
  notifChipTextActive: {
    color: colors.lime,
  },
  subHeading: {
    fontFamily: fontFamily.sans700,
    fontSize: 13.5,
    color: colors.textPrimary,
    paddingTop: spacing.xs,
  },
  upiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upiVerifiedBadge: {
    backgroundColor: colors.lime,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  upiVerifiedBadgeText: {
    fontFamily: fontFamily.sans600,
    fontSize: 10.5,
    color: colors.ink,
  },
  upiActions: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  subHeadingSpaced: {
    marginTop: spacing.ms,
    paddingTop: spacing.ms,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  emptyText: {
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    color: colors.textFaint,
    paddingVertical: 6,
  },
  spaceItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 4,
  },
  spaceItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  spaceItemTitle: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.textPrimary,
  },
  rolePill: {
    backgroundColor: colors.badgeInactiveBg,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  rolePillOwner: {
    backgroundColor: colors.lime,
  },
  rolePillText: {
    fontFamily: fontFamily.sans600,
    fontSize: 10,
    color: colors.badgeInactiveFg,
  },
  rolePillTextOwner: {
    color: colors.ink,
  },
  spaceItemMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.textFaint,
  },
  spacePermRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  spacePermLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.pressWash,
    borderRadius: radius.pill,
    padding: 4,
    marginTop: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.ink,
  },
  segmentText: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.lime,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: 'rgba(211,50,67,0.25)',
    marginBottom: spacing.xxl,
  },
});

const sheetStyles = StyleSheet.create({
  title: {
    ...typography.detailTitle,
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  titleFlex: {
    flex: 1,
    marginBottom: 0,
  },
  showToggle: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -4,
    marginBottom: spacing.xs,
  },
  strengthBars: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
  strengthLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 11,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionFlex: {
    flex: 1,
  },
});
