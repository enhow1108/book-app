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

/**
 * Opens the share sheet where the browser can share files (phones, Safari), so the file can go straight to
 * Google Drive or Files; elsewhere downloads it. Must be called straight from a button press.
 */
export async function saveFile(name: string, text: string, kind: FileKind): Promise<void> {
  const blob = new Blob([text], { type: MIME[kind] });
  const file = new File([blob], name, { type: MIME[kind].split(';')[0] });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      // Closing the share sheet isn't an error; anything else falls back to downloading.
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
