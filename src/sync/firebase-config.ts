import type { FirebaseOptions } from 'firebase/app';

/**
 * The Firebase project the family's records sync through, from the Firebase console
 * (Project settings → Your apps → Web app → firebaseConfig). These values identify the
 * project and are safe to ship in the app; access is controlled by firestore.rules.
 * While it is null, the app stays local-only and the sync panel says so.
 */
export const firebaseConfig: FirebaseOptions | null = null;
