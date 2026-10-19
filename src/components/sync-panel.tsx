import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import * as cloud from '@/sync/cloud';
import { useSync, type SyncStatus } from '@/sync/sync-provider';

const STATUS: Record<SyncStatus, string> = {
  off: '',
  linking: '正在找你的家庭…',
  syncing: '同步中…',
  synced: '已同步',
  error: '同步暫停，會自動再試',
};

/** Sign-in and the family the parents share their children's records with. */
export function SyncPanel() {
  const sync = useSync();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage(undefined);
    try {
      await action();
    } catch (e) {
      setMessage(cloud.describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!sync.configured) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">家庭共用</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          雲端同步還沒設定好，目前資料只存在這台裝置。
        </ThemedText>
      </ThemedView>
    );
  }

  if (sync.user === undefined) return null;

  const note = message ?? sync.error;

  if (!sync.user) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">家庭共用</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          登入後，爸爸媽媽可以共用同一份孩子的書架和閱讀紀錄。不登入也可以照常使用。
        </ThemedText>
        {cloud.googleSignInAvailable ? (
          <Button title="用 Google 登入" disabled={busy} onPress={() => run(cloud.signInWithGoogle)} />
        ) : null}
        <Field
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Field placeholder="密碼（至少 6 個字）" secureTextEntry value={password} onChangeText={setPassword} />
        <View style={styles.actions}>
          <Button
            title="忘記密碼"
            disabled={busy || !email.trim()}
            onPress={() =>
              run(async () => {
                await cloud.resetPassword(email.trim());
                setMessage('已寄出重設密碼的信，請到信箱收信。');
              })
            }
          />
          <Button
            title="註冊"
            disabled={busy || !email.trim() || !password}
            onPress={() => run(() => cloud.signUpWithEmail(email.trim(), password))}
          />
          <Button
            title="登入"
            disabled={busy || !email.trim() || !password}
            onPress={() => run(() => cloud.signInWithEmail(email.trim(), password))}
          />
        </View>
        {note ? <ThemedText type="small">{note}</ThemedText> : null}
      </ThemedView>
    );
  }

  const account = (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.grow} numberOfLines={1}>
        已登入：{sync.user.email ?? '帳號'}
      </ThemedText>
      <Button title="登出" disabled={busy} onPress={() => run(sync.signOut)} />
    </View>
  );

  if (!sync.familyId) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">家庭共用</ThemedText>
        {sync.status === 'linking' ? (
          <ThemedText type="small" themeColor="textSecondary">
            {STATUS.linking}
          </ThemedText>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              第一位家長按「建立家庭」，會拿到一組邀請碼；另一位家長登入後輸入邀請碼加入。這台裝置上原有的資料會一起放進家庭。
            </ThemedText>
            <Button title="建立家庭" disabled={busy} onPress={() => run(sync.createFamily)} />
            <View style={styles.row}>
              <Field
                placeholder="邀請碼"
                autoCapitalize="characters"
                value={invite}
                onChangeText={setInvite}
                style={styles.grow}
              />
              <Button
                title="加入"
                disabled={busy || cloud.normalizeCode(invite).length < 6}
                onPress={() => run(() => sync.joinFamily(invite))}
              />
            </View>
          </>
        )}
        {note ? <ThemedText type="small">{note}</ThemedText> : null}
        {account}
      </ThemedView>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">家庭共用</ThemedText>
      {sync.code ? (
        <ThemedText type="small" themeColor="textSecondary">
          邀請碼 <ThemedText type="smallBold">{sync.code}</ThemedText>，給另一位家長登入後輸入。
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {STATUS[sync.status]}
        {sync.pending ? `，還有 ${sync.pending} 筆要上傳` : ''}
      </ThemedText>
      {note ? <ThemedText type="small">{note}</ThemedText> : null}
      {account}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  grow: { flex: 1 },
});
