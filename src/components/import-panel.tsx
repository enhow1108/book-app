import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { confirmDestructive, showMessage } from '@/components/dialogs';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { toDayKey } from '@/data/dates';
import { pickCsvFiles, saveCsv } from '@/data/file-io';
import { exportCsv, planImport, type ImportPlan } from '@/data/importer';
import { useStore } from '@/data/store';

/** Import reading records from CSV files (such as an export from 小花生), export them, and undo past imports. */
export function ImportPanel() {
  const { state, imports, applyImport, undoImport } = useStore();
  const [plan, setPlan] = useState<ImportPlan>();
  const [busy, setBusy] = useState(false);

  async function onPick() {
    try {
      setBusy(true);
      const files = await pickCsvFiles();
      if (files.length) setPlan(planImport(files, state));
    } catch (e) {
      showMessage('讀不到檔案', String(e));
    } finally {
      setBusy(false);
    }
  }

  function onConfirm() {
    if (!plan) return;
    applyImport(plan);
    setPlan(undefined);
    const { reads, newBooks, updatedBooks } = plan.summary;
    showMessage(
      '匯入好了',
      [reads ? `加入 ${reads} 次閱讀、${newBooks} 本新書。` : '', updatedBooks ? `更新了 ${updatedBooks} 本書的資料。` : '']
        .filter(Boolean)
        .join('\n')
    );
  }

  async function onExport() {
    try {
      await saveCsv(`小書蟲閱讀紀錄_${toDayKey(new Date())}.csv`, exportCsv(state));
    } catch (e) {
      showMessage('匯出失敗', String(e));
    }
  }

  const s = plan?.summary;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">匯入 / 匯出</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        CSV 檔，每次閱讀一列，至少要有「日期、孩子、書名」欄。小花生的「閱讀明細.csv」可以直接匯入，兩個孩子的檔案可以一起選，共讀的紀錄只會算一次。
      </ThemedText>
      <View style={styles.row}>
        <Button title={busy ? '讀取中…' : '匯入 CSV'} onPress={onPick} disabled={busy} />
        <Button title="匯出 CSV" onPress={onExport} disabled={state.logs.length === 0} />
      </View>

      {plan && s ? (
        <ThemedView style={styles.preview}>
          <ThemedText type="smallBold">{plan.record.fileNames.join('、')}</ThemedText>
          <ThemedText type="small">
            {s.reads > 0
              ? `會加入 ${s.reads} 次閱讀（${s.firstDate} ～ ${s.lastDate}）`
              : '沒有新的閱讀紀錄可以加入。'}
          </ThemedText>
          {s.perChild.length ? (
            <ThemedText type="small">{s.perChild.map((c) => `${c.name} ${c.reads} 次`).join(' · ')}</ThemedText>
          ) : null}
          <ThemedText type="small">
            新書 {s.newBooks} 本 · 書架上已有 {s.matchedBooks} 本
          </ThemedText>
          {s.updatedBooks > 0 ? (
            <ThemedText type="small">
              {`會補上 ${s.updatedBooks} 本書的資料`}
              {s.filledIsbn > 0 ? `，其中 ${s.filledIsbn} 本補上 ISBN（之後會用 ISBN 找封面）` : ''}
            </ThemedText>
          ) : null}
          {s.newChildNames.length ? (
            <ThemedText type="small">會新增孩子：{s.newChildNames.join('、')}</ThemedText>
          ) : null}
          {s.duplicateReads > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              略過 {s.duplicateReads} 次重複的閱讀（已經在 App 裡，或在兩個檔案裡都有）。
            </ThemedText>
          ) : null}
          {plan.problems.length ? (
            <ThemedText type="small" themeColor="textSecondary">
              {`有 ${plan.problems.length} 列沒辦法匯入：\n`}
              {plan.problems
                .slice(0, 5)
                .map((p) => `${p.file}${p.line ? ` 第 ${p.line} 列` : ''}：${p.message}`)
                .join('\n')}
              {plan.problems.length > 5 ? '\n…' : ''}
            </ThemedText>
          ) : null}
          <View style={styles.row}>
            <Button title="確認匯入" onPress={onConfirm} disabled={s.reads === 0 && s.updatedBooks === 0} />
            <Button title="取消" onPress={() => setPlan(undefined)} />
          </View>
        </ThemedView>
      ) : null}

      {imports.map((r) => (
        <View key={r.id} style={styles.importRow}>
          <View style={styles.grow}>
            <ThemedText type="small" numberOfLines={1}>
              {r.fileNames.join('、')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {`${r.at.slice(0, 10)} 匯入 · ${r.logs} 筆紀錄 · ${r.books} 本新書`}
            </ThemedText>
          </View>
          <Button
            title="復原"
            onPress={() =>
              confirmDestructive('復原這次匯入？', '這次匯入的閱讀紀錄和新書都會刪除。', '復原', () => undoImport(r.id))
            }
          />
        </View>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  preview: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.one },
  importRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
});
