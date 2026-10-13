import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AddEmailGate } from '@/components/add-email-gate';

// The screen between a new Ravelry account and the app. What matters is which way each answer
// sends the knitter, so that is what these check: the inbox, the account they already have, or out.

const mockAddRecoveryEmail = jest.fn();
const mockRecheckEmail = jest.fn();
const mockDeleteAccount = jest.fn();
const mockSignOut = jest.fn();
const mockClear = jest.fn();
let mockUser: Record<string, unknown> = {};

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// Reanimated needs a native runtime the test environment does not have; a plain pressable is all
// these tests need from the button.
jest.mock('@/components/knitwit-ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable } = require('react-native');
  return { PillButton: Pressable };
});
jest.mock('@/lib/session', () => ({
  currentSession: () => ({ session: { user: mockUser }, settled: true }),
  onSessionChange: () => () => undefined,
}));
jest.mock('@/lib/switch-account', () => ({ clearLocalAccountData: () => mockClear() }));
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  addRecoveryEmail: (e: string) => mockAddRecoveryEmail(e),
  recheckEmail: () => mockRecheckEmail(),
  deleteAccount: () => mockDeleteAccount(),
  signOut: () => mockSignOut(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', is_anonymous: false, email: '', identities: [{ provider: 'custom:ravelry' }] };
  mockSignOut.mockResolvedValue({ ok: true });
  mockClear.mockResolvedValue(undefined);
});

const ask = async (address: string) => {
  await fireEvent.changeText(screen.getByLabelText('Email address'), address);
  await fireEvent.press(screen.getByText('Send the link'));
};

it('asks for an email, naming Ravelry as the way they came in', async () => {
  await render(<AddEmailGate />);
  expect(screen.getByText('One more thing: your email')).toBeTruthy();
  expect(screen.getByText(/signed in with Ravelry/)).toBeTruthy();
});

it('goes to the inbox once a link has been sent', async () => {
  mockAddRecoveryEmail.mockResolvedValue({ ok: true, confirmEmail: true });
  await render(<AddEmailGate />);
  await ask('me@example.com');
  await waitFor(() => expect(screen.getByText('Check your inbox')).toBeTruthy());
  expect(mockAddRecoveryEmail).toHaveBeenCalledWith('me@example.com');
});

// Reopening the app with a link still out picks up where it was, not at an empty field.
it('opens on the inbox when an address is already waiting', async () => {
  mockUser = { ...mockUser, new_email: 'me@example.com' };
  await render(<AddEmailGate />);
  expect(screen.getByText('Check your inbox')).toBeTruthy();
});

it('says so when the link has not been opened yet', async () => {
  mockUser = { ...mockUser, new_email: 'me@example.com' };
  mockRecheckEmail.mockResolvedValue(false);
  await render(<AddEmailGate />);
  await fireEvent.press(screen.getByText('I have opened the link'));
  await waitFor(() => expect(screen.getByText(/has not been opened/)).toBeTruthy());
});

it('offers the existing account when the address already has one', async () => {
  mockAddRecoveryEmail.mockResolvedValue({ ok: false, taken: true, message: '' });
  mockDeleteAccount.mockResolvedValue({ ok: true });
  await render(<AddEmailGate />);
  await ask('taken@example.com');
  await waitFor(() => expect(screen.getByText('You already have an account')).toBeTruthy());

  await fireEvent.press(screen.getByText('Go to my existing account'));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  // Deleted first: that is what frees the Ravelry login to be connected elsewhere.
  expect(mockDeleteAccount).toHaveBeenCalled();
  expect(mockClear).toHaveBeenCalled();
});

// A failed delete means the account is still whole and still signed in. Signing out on top of that
// would leave the Ravelry login stuck on an account the knitter can no longer reach.
it('stays put when the empty account could not be removed', async () => {
  mockAddRecoveryEmail.mockResolvedValue({ ok: false, taken: true, message: '' });
  mockDeleteAccount.mockResolvedValue({ ok: false, message: 'Your account could not be deleted.' });
  await render(<AddEmailGate />);
  await ask('taken@example.com');
  await waitFor(() => screen.getByText('Go to my existing account'));
  await fireEvent.press(screen.getByText('Go to my existing account'));
  await waitFor(() => expect(screen.getByText('Your account could not be deleted.')).toBeTruthy());
  expect(mockSignOut).not.toHaveBeenCalled();
});

it('shows what went wrong otherwise, and stays on the question', async () => {
  mockAddRecoveryEmail.mockResolvedValue({ ok: false, taken: false, message: "That doesn't look like an email address." });
  await render(<AddEmailGate />);
  await ask('nope');
  await waitFor(() => expect(screen.getByText("That doesn't look like an email address.")).toBeTruthy());
  expect(screen.getByText('One more thing: your email')).toBeTruthy();
});
