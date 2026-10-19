import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ImportFile } from './importer';

/** Lets the parent pick one or more CSV files and returns their text. */
export async function pickCsvFiles(): Promise<ImportFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
    multiple: true,
  });
  if (result.canceled) return [];
  return Promise.all(result.assets.map(async (a) => ({ name: a.name, text: await new File(a.uri).text() })));
}

/** Saves a CSV and opens the share sheet, so it can go to Files, AirDrop or email. */
export async function saveCsv(name: string, text: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
}
