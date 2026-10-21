// Native modules have no implementation under Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Stylesheets are for the web build only.
jest.mock('@/global.css', () => ({}));
