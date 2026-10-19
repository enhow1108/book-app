// Everything that talks to Firebase is in this file (plus the config and the sign-in persistence),
// so the cloud can be swapped (for example for Supabase) without touching the rest of the app.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth';
import {
  addDoc,
  connectFirestoreEmulator,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { Platform } from 'react-native';

import type { Changes } from '@/data/database-types';

import { persistence } from './auth-persistence';
import { firebaseConfig } from './firebase-config';

export type CloudUser = { uid: string; email: string | null };

/** A batch of changes one device sent. `at` orders them; it is opaque outside this file. */
export type Op = { id: string; at: string; device: string; changes: Changes };

let services: { app: FirebaseApp; auth: Auth; db: Firestore } | undefined;

// For trying sync without a real project: `firebase emulators:start --only auth,firestore`, then start the app
// with EXPO_PUBLIC_FIREBASE_EMULATOR=localhost.
const emulator = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR;
const config = emulator ? { projectId: 'demo-book-app', apiKey: 'demo', authDomain: emulator } : firebaseConfig;

export const cloudConfigured = config !== null;

function cloud() {
  if (!config) throw new Error('Firebase is not configured');
  if (!services) {
    const app = initializeApp(config);
    services = {
      app,
      auth: initializeAuth(app, { persistence }),
      db: initializeFirestore(app, {
        ignoreUndefinedProperties: true,
        // React Native has no streaming fetch, so Firestore has to poll there.
        ...(Platform.OS === 'web' ? {} : { experimentalForceLongPolling: true }),
      }),
    };
    if (emulator) {
      connectAuthEmulator(services.auth, `http://${emulator}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(services.db, emulator, 8080);
    }
  }
  return services;
}

// --- Sign-in ---

export function watchUser(callback: (user: CloudUser | null) => void): () => void {
  return onAuthStateChanged(cloud().auth, (u) => callback(u ? { uid: u.uid, email: u.email } : null));
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(cloud().auth, email, password);
}

export async function signUpWithEmail(email: string, password: string) {
  await createUserWithEmailAndPassword(cloud().auth, email, password);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(cloud().auth, email);
}

/** Google sign-in opens a popup, so for now it is only offered on the web. */
export const googleSignInAvailable = Platform.OS === 'web';

export async function signInWithGoogle() {
  await signInWithPopup(cloud().auth, new GoogleAuthProvider(), browserPopupRedirectResolver);
}

export async function signOut() {
  await firebaseSignOut(cloud().auth);
}

/** Firebase's error codes, in words a parent understands. */
export function describeError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Email 格式不對。',
    'auth/missing-password': '請輸入密碼。',
    'auth/weak-password': '密碼至少要 6 個字。',
    'auth/email-already-in-use': '這個 Email 已經註冊過了，請直接登入。',
    'auth/invalid-credential': 'Email 或密碼不對。',
    'auth/wrong-password': 'Email 或密碼不對。',
    'auth/user-not-found': '找不到這個帳號，請先註冊。',
    'auth/too-many-requests': '試太多次了，請稍後再試。',
    'auth/network-request-failed': '連不上網路。',
    'auth/popup-closed-by-user': '登入視窗被關掉了。',
    'auth/popup-blocked': '瀏覽器擋住了登入視窗，請允許彈出視窗後再試。',
    'auth/unauthorized-domain': '這個網址還沒加到 Firebase 的授權網域。',
    'auth/operation-not-allowed': 'Firebase 還沒啟用這種登入方式。',
    'permission-denied': '沒有權限，可能是 Firestore 規則還沒發布。',
    unavailable: '連不上雲端，請檢查網路。',
  };
  return messages[code] ?? `發生錯誤：${code || (e as Error)?.message || e}`;
}

// --- Families ---

// No 0/O, 1/I/L, so a code read aloud or copied by hand comes out right.
const CODE_LETTERS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function newCode() {
  return Array.from({ length: 6 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
}

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');

/** The family this person already belongs to, if any. */
export async function findFamily(uid: string): Promise<string | undefined> {
  const { db } = cloud();
  const found = await getDocs(query(collection(db, 'families'), where('members', 'array-contains', uid)));
  return found.docs[0]?.id;
}

export async function createFamily(uid: string): Promise<string> {
  const { db } = cloud();
  const family = doc(collection(db, 'families'));
  let code = newCode();
  while ((await getDoc(doc(db, 'invites', code))).exists()) code = newCode();
  await setDoc(family, { members: [uid], code, createdBy: uid, createdAt: serverTimestamp() });
  await setDoc(doc(db, 'invites', code), { familyId: family.id });
  return family.id;
}

/** Adds this person to the family with the invite code; undefined if no family has that code. */
export async function joinFamily(uid: string, code: string): Promise<string | undefined> {
  const { db } = cloud();
  const invite = await getDoc(doc(db, 'invites', normalizeCode(code)));
  if (!invite.exists()) return undefined;
  const familyId = invite.data().familyId as string;
  await updateDoc(doc(db, 'families', familyId), { members: arrayUnion(uid), joinCode: normalizeCode(code) });
  return familyId;
}

export async function familyCode(familyId: string): Promise<string | undefined> {
  const family = await getDoc(doc(cloud().db, 'families', familyId));
  return family.data()?.code as string | undefined;
}

// --- Changes ---

const encodeAt = (t: Timestamp) => `${t.seconds}.${t.nanoseconds}`;

function decodeAt(at: string) {
  const [seconds, nanos] = at.split('.').map(Number);
  return new Timestamp(seconds, nanos);
}

function toOp(d: QueryDocumentSnapshot): Op | undefined {
  const data = d.data();
  // A batch this device just sent has no server time until the server confirms it.
  if (!(data.at instanceof Timestamp)) return undefined;
  return { id: d.id, at: encodeAt(data.at), device: data.device, changes: JSON.parse(data.changes) };
}

function opsQuery(familyId: string, after?: string) {
  const ops = collection(cloud().db, 'families', familyId, 'ops');
  return after ? query(ops, where('at', '>', decodeAt(after)), orderBy('at')) : query(ops, orderBy('at'));
}

/** Every batch the family has sent, oldest first; for a device joining the family. */
export async function fetchOps(familyId: string): Promise<Op[]> {
  const found = await getDocs(opsQuery(familyId));
  return found.docs.map(toOp).filter((op): op is Op => !!op);
}

/** Calls back with batches sent after `after`, oldest first, now and as they arrive. */
export function watchOps(
  familyId: string,
  after: string | undefined,
  onOps: (ops: Op[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return onSnapshot(
    opsQuery(familyId, after),
    (snapshot) => {
      const ops = snapshot
        .docChanges()
        .filter((c) => c.type === 'added' || c.type === 'modified')
        .map((c) => toOp(c.doc))
        .filter((op): op is Op => !!op);
      if (ops.length) onOps(ops);
    },
    onError,
  );
}

/** Firestore documents hold at most 1 MiB; batches stay well under it. */
export const MAX_OP_BYTES = 700_000;

export async function sendOp(familyId: string, uid: string, device: string, changes: Changes) {
  const { db } = cloud();
  await addDoc(collection(db, 'families', familyId, 'ops'), {
    at: serverTimestamp(),
    by: uid,
    device,
    changes: JSON.stringify(changes),
  });
}
