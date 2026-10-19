import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseAuth from 'firebase/auth';
import type { Persistence } from 'firebase/auth';

// Only Firebase's React Native build has this, so its browser typings leave it out.
const { getReactNativePersistence } = firebaseAuth as unknown as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

/** The phone keeps the sign-in in AsyncStorage, so it survives restarting the app. */
export const persistence: Persistence = getReactNativePersistence(AsyncStorage);
