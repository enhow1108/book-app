import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { showMessage } from '@/components/dialogs';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { backupJson, planRestore, type RestorePlan } from '@/data/backup';
import { toDayKey } from '@/data/dates';
import { pickFiles, saveFile } from '@/data/file-io';
import { useStore } from '@/data/store';

/** A full backup of everything in the app as one file, and restoring from it. */
export function BackupPanel() {
  const { state, restoreBackup } = useStore();
  const [plan, setPlan] = useState<RestorePlan>();
  const [busy, setBusy] = useState(false);

  async function onBackup() {
    try {
      await saveFile(`小書蟲備份_${toDayKey(new Date())}.json`, backupJson(state), 'json');
    } catch (e) {
      showMessage('備份失敗', String(e));
    }
  }

  async function onPick() {
    try {
      setBusy(true);
      const [file] = await pickFiles('json', false);
      if (file) setPlan(planRestore(file.text, state));
    } catch (e) {
      showMessage('沒辦法還原', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onConfirm() {
    if (!plan) return;
    restoreBackup(plan);
    setPlan(undefined);
    showMessage('還原好了', `加回 ${plan.added.logs} 次閱讀紀錄、${plan.added.books} 本書。`);
  }

  const a = plan?.added;
  const nothing = a && !a.children && !a.books && !a.shelf && !a.logs && !a.imports;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">完整備份</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        把孩子、書架（含封面照片和在讀/讀完了/想讀）和所有閱讀紀錄存成一個檔案，可以從分享選單存到 Google 雲端硬碟。還原只會加回 App 裡沒有的資料，不會刪掉或改掉現在的紀錄。
      </ThemedText>
      <View style={styles.row}>
        <Button title="匯出備份檔" onPress={onBackup} />
        <Button title={busy ? '讀取中…' : '從備份還原'} onPress={onPick} disabled={busy} />
      </View>

      {plan && a ? (
        <ThemedView style={styles.preview}>
          <ThemedText type="smallBold">{`備份時間：${plan.exportedAt.slice(0, 16).replace('T', ' ')}`}</ThemedText>
          <ThemedText type="small">
            {nothing
              ? '備份裡的資料 App 都已經有了，不用還原。'
              : `會加回 ${a.logs} 次閱讀紀錄、${a.books} 本書、${a.shelf} 筆書架狀態${a.children ? `、${a.children} 個孩子` : ''}。`}
          </ThemedText>
          <View style={styles.row}>
            <Button title="確認還原" onPress={onConfirm} disabled={nothing} />
            <Button title="取消" onPress={() => setPlan(undefined)} />
          </View>
        </ThemedView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  preview: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.one },
});
