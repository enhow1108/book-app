import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ImportFile } from './importer';

export type FileKind = 'csv' | 'json';

const PICK_TYPES: Record<FileKind, string[]> = {
  csv: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
  json: ['application/json', 'text/plain', 'application/octet-stream'],
};
const SHARE_TYPES: Record<FileKind, { mimeType: string; UTI: string }> = {
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
  json: { mimeType: 'application/json', UTI: 'public.json' },
};

/** Lets the parent pick one or more files of the given kind and returns their text. */
export async function pickFiles(kind: FileKind, multiple = true): Promise<ImportFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: PICK_TYPES[kind], multiple });
  if (result.canceled) return [];
  return Promise.all(result.assets.map(async (a) => ({ name: a.name, text: await new File(a.uri).text() })));
}

/** Saves a file and opens the share sheet, so it can go to Files, Google Drive, AirDrop or email. */
export async function saveFile(name: string, text: string, kind: FileKind): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  await Sharing.shareAsync(file.uri, SHARE_TYPES[kind]);
}
