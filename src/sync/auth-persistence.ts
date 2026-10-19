import { browserLocalPersistence, type Persistence } from 'firebase/auth';

/** Browsers keep the sign-in in local storage, so it survives closing the tab. */
export const persistence: Persistence = browserLocalPersistence;
