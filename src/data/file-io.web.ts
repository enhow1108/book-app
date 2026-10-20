import * as DocumentPicker from 'expo-document-picker';

import type { ImportFile } from './importer';

export type FileKind = 'csv' | 'json';

const PICK_TYPES: Record<FileKind, string[]> = { csv: ['.csv', 'text/csv'], json: ['.json', 'application/json'] };
const MIME: Record<FileKind, string> = { csv: 'text/csv;charset=utf-8', json: 'application/json;charset=utf-8' };

/** Lets the parent pick one or more files of the given kind and returns their text. Must be called straight from a button press. */
export async function pickFiles(kind: FileKind, multiple = true): Promise<ImportFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: PICK_TYPES[kind], multiple, base64: false });
  if (result.canceled) return [];
  return Promise.all(
    result.assets.map(async (a) => ({ name: a.name, text: a.file ? await a.file.text() : await (await fetch(a.uri)).text() }))
  );
}

/** Downloads a file. */
export async function saveFile(name: string, text: string, kind: FileKind): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: MIME[kind] }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
