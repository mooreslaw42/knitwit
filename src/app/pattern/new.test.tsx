import { fireEvent, render, screen } from '@testing-library/react-native';

import NewPatternWizardScreen from '@/app/pattern/new';

// The first step used to show every way in at once — an upload control, a paste box and a skip,
// all competing for the same glance. It is a choice now, and the thing worth asserting is what the
// knitter is actually offered at each point, because that is exactly the kind of wiring that looks
// right in the diff and wrong on the screen. In the spirit of charts.test.tsx.

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
// Reaches AsyncStorage's native module, which isn't there under Jest. Nothing here stores a photo.
jest.mock('@/lib/photo-store', () => ({ putPhoto: jest.fn(), PHOTO_STORAGE_FULL: '' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('@/lib/use-page-title', () => ({ usePageTitle: jest.fn() }));
jest.mock('@/lib/read-pattern-file', () => ({ pickPatternFile: jest.fn() }));
jest.mock('@/lib/pick-image', () => ({ pickImage: jest.fn(), pickImageMessage: () => '' }));

jest.mock('@/store/useKnitwitStore', () => ({
  useKnitwitStore: (select: (s: unknown) => unknown) =>
    select({ savePattern: jest.fn(), catalogue: null, loadCatalogue: jest.fn() }),
}));

describe('the first step of the new-pattern wizard', () => {
  it('asks how to start, rather than showing every way in at once', async () => {
    await render(<NewPatternWizardScreen />);

    expect(screen.getByText('How do you want to start?')).toBeTruthy();
    expect(screen.getByText('Upload pattern')).toBeTruthy();
    expect(screen.getByText('Write pattern')).toBeTruthy();
    // The upload control and the paste box belong to a choice, not to the choosing.
    expect(screen.queryByText('Choose a PDF or text file…')).toBeNull();
  });

  it('offers no Next on the choice screen, because the cards are the action', async () => {
    await render(<NewPatternWizardScreen />);
    expect(screen.queryByText('Continue')).toBeNull();
  });

  it('shows the file picker only once uploading is the chosen way in', async () => {
    await render(<NewPatternWizardScreen />);
    await fireEvent.press(screen.getByText('Upload pattern'));

    expect(screen.getByText('Choose a PDF or text file…')).toBeTruthy();
    expect(screen.getByText('What Knitwit read from the file')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('asks for text and nothing to upload when the pattern is being written', async () => {
    await render(<NewPatternWizardScreen />);
    await fireEvent.press(screen.getByText('Write pattern'));

    expect(screen.getByText('The pattern text')).toBeTruthy();
    expect(screen.queryByText('Choose a PDF or text file…')).toBeNull();
  });

  it('goes back to the choice instead of out of the wizard', async () => {
    await render(<NewPatternWizardScreen />);
    await fireEvent.press(screen.getByText('Write pattern'));
    expect(screen.queryByText('How do you want to start?')).toBeNull();

    await fireEvent.press(screen.getByText('←'));
    expect(screen.getByText('How do you want to start?')).toBeTruthy();
  });

  it('still lets a knitter fill the whole thing in themselves', async () => {
    await render(<NewPatternWizardScreen />);
    await fireEvent.press(screen.getByText('Fill it in myself'));

    // Straight past the reading step to the details, which is what skipping always meant.
    expect(screen.queryByText('How do you want to start?')).toBeNull();
    expect(screen.getByText(/Step 2 of 5/)).toBeTruthy();
  });
});
