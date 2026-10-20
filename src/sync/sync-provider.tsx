import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { TABLES, type Changes, type Row, type Table } from '@/data/database-types';
import { newId, type State } from '@/data/library';
import { useStore } from '@/data/store';

import * as cloud from './cloud';

// The app always reads and writes the database on the device. Once a parent signs in and joins a family,
// every change made here is also sent to the family's cloud copy, and changes the other parent makes come back.
// Changes not yet sent (the "outbox") are kept in the database too, so nothing is lost while offline.

export type SyncStatus = 'off' | 'linking' | 'syncing' | 'synced' | 'error';

type Sync = {
  configured: boolean;
  /** undefined while the saved sign-in is being restored. */
  user: cloud.CloudUser | null | undefined;
  familyId?: string;
  code?: string;
  status: SyncStatus;
  /** Records changed on this device that the cloud doesn't have yet. */
  pending: number;
  error?: string;
  createFamily: () => Promise<void>;
  joinFamily: (code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const SyncContext = createContext<Sync | null>(null);

const STATE_KEY: Record<Table, keyof State> = {
  children: 'children',
  books: 'books',
  shelf: 'shelf',
  logs: 'logs',
  imports: 'imports',
};

const keyOf = (table: Table, id: string) => `${table}/${id}`;

function splitKey(key: string): [Table, string] {
  const slash = key.indexOf('/');
  return [key.slice(0, slash) as Table, key.slice(slash + 1)];
}

function changedKeys(changes: Changes): string[] {
  return TABLES.flatMap((t) => [
    ...(changes.put[t] ?? []).map((r) => keyOf(t, r.id)),
    ...(changes.remove[t] ?? []).map((id) => keyOf(t, id)),
  ]);
}

const encoder = new TextEncoder();

/** Splits records into batches small enough for one cloud document each. */
export function batches(state: State, keys: string[]): Changes[] {
  const rows = new Map<Table, Map<string, Row>>();
  for (const t of TABLES) rows.set(t, new Map((state[STATE_KEY[t]] as Row[]).map((r) => [r.id, r])));
  const out: Changes[] = [];
  let current: Changes = { put: {}, remove: {} };
  let size = 0;
  for (const key of keys) {
    const [table, id] = splitKey(key);
    const row = rows.get(table)?.get(id);
    const bytes = encoder.encode(row ? JSON.stringify(row) : id).length + 8;
    if (size + bytes > cloud.MAX_OP_BYTES && size > 0) {
      out.push(current);
      current = { put: {}, remove: {} };
      size = 0;
    }
    if (row) (current.put[table] ??= []).push(row);
    else (current.remove[table] ??= []).push(id);
    size += bytes;
  }
  if (size > 0) out.push(current);
  return out;
}

/** Folds batches into one set of changes, later batches winning; leaves out records this device has unsent changes to. */
export function merge(ops: cloud.Op[], skip: Map<string, number>): Changes | null {
  const latest = new Map<string, Row | null>();
  for (const op of ops) {
    for (const t of TABLES) {
      for (const r of op.changes.put[t] ?? []) latest.set(keyOf(t, r.id), r);
      for (const id of op.changes.remove[t] ?? []) latest.set(keyOf(t, id), null);
    }
  }
  const changes: Changes = { put: {}, remove: {} };
  let any = false;
  for (const [key, row] of latest) {
    if (skip.has(key)) continue;
    const [table, id] = splitKey(key);
    if (row) (changes.put[table] ??= []).push(row);
    else (changes.remove[table] ??= []).push(id);
    any = true;
  }
  return any ? changes : null;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const { loaded, syncMeta } = store;
  const [user, setUser] = useState<cloud.CloudUser | null | undefined>(cloud.cloudConfigured ? undefined : null);
  const [familyId, setFamilyId] = useState<string>();
  const [code, setCode] = useState<string>();
  const [status, setStatus] = useState<SyncStatus>('off');
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string>();

  // The latest store, for code running outside a render (callbacks from the cloud and timers).
  const storeRef = useRef(store);
  storeRef.current = store;
  // `${table}/${id}` of records changed here and not sent yet, each with a counter bumped on every change,
  // so a record changed again while being sent stays in the outbox.
  const outbox = useRef(new Map<string, number>());
  const familyRef = useRef<string>(undefined);
  const userRef = useRef<cloud.CloudUser | null>(null);
  const lastSeen = useRef<string>(undefined);
  const device = useRef('');
  const pushing = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const started = useRef(false);

  const saveMeta = (meta: Record<string, string>) => storeRef.current.saveSyncMeta(meta);

  const saveOutbox = () => {
    clearTimeout(saveTimer.current);
    setPending(outbox.current.size);
    saveTimer.current = setTimeout(() => saveMeta({ 'sync.outbox': JSON.stringify([...outbox.current.keys()]) }), 500);
  };

  const addToOutbox = (keys: string[]) => {
    for (const k of keys) outbox.current.set(k, (outbox.current.get(k) ?? 0) + 1);
    saveOutbox();
    schedulePush();
  };

  const schedulePush = (delay = 1500) => {
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(push, delay);
  };

  async function push() {
    const family = familyRef.current;
    const uid = userRef.current?.uid;
    if (pushing.current || !family || !uid || !outbox.current.size) return;
    pushing.current = true;
    setStatus('syncing');
    try {
      while (outbox.current.size && familyRef.current === family) {
        const sending = new Map(outbox.current);
        for (const changes of batches(storeRef.current.state, [...sending.keys()])) {
          await cloud.sendOp(family, uid, device.current, changes);
        }
        for (const [k, n] of sending) if (outbox.current.get(k) === n) outbox.current.delete(k);
        saveOutbox();
      }
      setStatus('synced');
      setError(undefined);
    } catch (e) {
      setStatus('error');
      setError(cloud.describeError(e));
      schedulePush(30_000);
    } finally {
      pushing.current = false;
    }
  }

  function applyOps(ops: cloud.Op[]) {
    const theirs = ops.filter((op) => op.device !== device.current);
    const changes = merge(theirs, outbox.current);
    if (changes) storeRef.current.applyRemote(changes);
    lastSeen.current = ops[ops.length - 1].at;
    saveMeta({ 'sync.lastSeen': lastSeen.current });
  }

  // Load what was saved last time, and listen for changes made on this device.
  useEffect(() => {
    if (!loaded || started.current) return;
    started.current = true;
    device.current = syncMeta['sync.deviceId'] || newId();
    if (!syncMeta['sync.deviceId']) saveMeta({ 'sync.deviceId': device.current });
    familyRef.current = syncMeta['sync.familyId'] || undefined;
    setFamilyId(familyRef.current);
    lastSeen.current = syncMeta['sync.lastSeen'] || undefined;
    for (const k of JSON.parse(syncMeta['sync.outbox'] || '[]') as string[]) outbox.current.set(k, 1);
    setPending(outbox.current.size);
    store.onLocalChanges((changes) => {
      if (familyRef.current) addToOutbox(changedKeys(changes));
    });
    return () => store.onLocalChanges(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => (cloud.cloudConfigured ? cloud.watchUser(setUser) : undefined), []);

  // Once signed in: forget the family if someone else signed in, otherwise find the family this person is in.
  useEffect(() => {
    if (!loaded || !started.current || user === undefined) return;
    userRef.current = user;
    if (!user) return;
    if (syncMeta['sync.uid'] && syncMeta['sync.uid'] !== user.uid) unlink();
    saveMeta({ 'sync.uid': user.uid });
    if (familyRef.current) return;
    setStatus('linking');
    cloud
      .findFamily(user.uid)
      .then((id) => (id ? link(id) : setStatus('off')))
      .catch((e) => {
        setStatus('error');
        setError(cloud.describeError(e));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loaded]);

  // While linked: receive the family's changes as they come, and send this device's.
  useEffect(() => {
    if (!user || !familyId) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    setStatus('syncing');
    cloud.familyCode(familyId).then(setCode, () => undefined);
    (async () => {
      // A device that has never synced gets everything first, then sends only what the family doesn't have.
      if (!lastSeen.current) {
        const ops = await cloud.fetchOps(familyId);
        if (cancelled) return;
        const theirs = new Set(ops.flatMap((op) => changedKeys(op.changes)));
        const state = storeRef.current.state;
        const mine = TABLES.flatMap((t) => (state[STATE_KEY[t]] as Row[]).map((r) => keyOf(t, r.id)));
        if (ops.length) applyOps(ops);
        else saveMeta({ 'sync.lastSeen': '' });
        addToOutbox(mine.filter((k) => !theirs.has(k)));
      }
      if (cancelled) return;
      stop = cloud.watchOps(familyId, lastSeen.current, applyOps, (e) => {
        setStatus('error');
        setError(cloud.describeError(e));
      });
      if (outbox.current.size) schedulePush(0);
      else setStatus('synced');
    })().catch((e) => {
      setStatus('error');
      setError(cloud.describeError(e));
    });
    return () => {
      cancelled = true;
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, familyId]);

  function link(id: string) {
    familyRef.current = id;
    lastSeen.current = undefined;
    saveMeta({ 'sync.familyId': id, 'sync.lastSeen': '' });
    setFamilyId(id);
  }

  function unlink() {
    familyRef.current = undefined;
    lastSeen.current = undefined;
    outbox.current.clear();
    saveMeta({ 'sync.familyId': '', 'sync.lastSeen': '', 'sync.outbox': '[]', 'sync.uid': '' });
    setFamilyId(undefined);
    setCode(undefined);
    setPending(0);
    setStatus('off');
  }

  const sync: Sync = {
    configured: cloud.cloudConfigured,
    user,
    familyId,
    code,
    status,
    pending,
    error,
    createFamily: async () => {
      if (!user) return;
      setError(undefined);
      try {
        link(await cloud.createFamily(user.uid));
      } catch (e) {
        setError(cloud.describeError(e));
      }
    },
    joinFamily: async (invite) => {
      if (!user) return false;
      setError(undefined);
      try {
        const id = await cloud.joinFamily(user.uid, invite);
        if (!id) {
          setError('找不到這個邀請碼，請再確認一次。');
          return false;
        }
        link(id);
        return true;
      } catch (e) {
        setError(cloud.describeError(e));
        return false;
      }
    },
    signOut: async () => {
      unlink();
      await cloud.signOut();
    },
  };

  return <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const sync = useContext(SyncContext);
  if (!sync) throw new Error('useSync must be used inside SyncProvider');
  return sync;
}
