// Device storage, for every test.
//
// The shared UI kit reaches the photo store, and the photo store reaches AsyncStorage, whose native
// half does not exist under Jest — so importing a button was enough to stop a suite from loading.
// Each screen test had been working round that with its own mock of the photo store, and the next
// file to import the kit failed the same way until somebody remembered to add one.
//
// The library's own in-memory mock, installed once. A test that wants a particular storage
// behaviour can still `jest.mock` it itself; a per-file mock wins over this one.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
