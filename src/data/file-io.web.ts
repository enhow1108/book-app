import * as DocumentPicker from 'expo-document-picker';

import type { ImportFile } from './importer';

/** Lets the parent pick one or more CSV files and returns their text. Must be called straight from a button press. */
export async function pickCsvFiles(): Promise<ImportFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['.csv', 'text/csv'], multiple: true, base64: false });
  if (result.canceled) return [];
  return Promise.all(
    result.assets.map(async (a) => ({ name: a.name, text: a.file ? await a.file.text() : await (await fetch(a.uri)).text() }))
  );
}

/** Downloads a CSV file. */
export async function saveCsv(name: string, text: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
