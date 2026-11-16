import { fireEvent, render, screen } from '@testing-library/react-native';

import NewProjectWizardScreen from '@/app/project/new';

// Arriving with `?pattern=` — from a pattern's own page, or "Save & start a project" at the end of
// the pattern wizard — the knitter has already said which pattern this is. Asserted on screen,
// because a prefill that is wired up wrong looks fine in the diff and asks the question again.
// Lives under src/__tests__/app for the reason given in ../pattern/new.test.tsx.

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/lib/use-page-title', () => ({ usePageTitle: jest.fn() }));
// Reaches AsyncStorage's native module (through the shared UI kit), which isn't there under Jest.
jest.mock('@/lib/photo-store', () => ({ putPhoto: jest.fn(), PHOTO_STORAGE_FULL: '' }));

const mockCreateProject = jest.fn((_draft: unknown) => 'proj1');
const mockPattern = {
  name: 'Pixel pattern',
  craft: 'crochet',
  category: 'blankets',
  accentColor: '#cccccc',
  needleSize: '',
  weight: '',
  sizes: ['One size'],
  gauge: null,
  materials: [],
  tools: [],
  techniques: [],
  sections: [],
};
const mockState = {
  patterns: {
    p9: mockPattern,
    p1: { ...mockPattern, name: 'Other', craft: 'knit', category: 'hats' },
  },
  projects: {},
  materials: {},
  tools: {},
  techniques: {},
  createProject: mockCreateProject,
  setActiveSection: jest.fn(),
  settings: { gaugeUnit: 'cm' },
};
jest.mock('@/store/useKnitwitStore', () => ({
  useKnitwitStore: (select: (s: unknown) => unknown) => select(mockState),
}));

beforeEach(() => {
  mockParams = {};
  mockCreateProject.mockClear();
});

describe('the new-project wizard, started from a pattern', () => {
  it('names the project after the pattern and links it', async () => {
    mockParams = { pattern: 'p9' };
    await render(<NewProjectWizardScreen />);

    expect(screen.getByDisplayValue('Pixel pattern')).toBeTruthy();

    // Basics → Pattern (already chosen) → Rows, and save.
    await fireEvent.press(screen.getByText('Next'));
    expect(screen.getByText('Working from a pattern?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Next'));
    await fireEvent.press(screen.getByText('Save project'));

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Pixel pattern',
        patternId: 'p9',
        craft: 'crochet',
        category: 'blankets',
      }),
    );
  });

  it('starts blank when the pattern no longer exists', async () => {
    mockParams = { pattern: 'gone' };
    await render(<NewProjectWizardScreen />);

    // Blank, so the wizard holds the knitter on the first step until they name it.
    await fireEvent.press(screen.getByText('Next'));
    expect(screen.getByText('A name is needed to save the project.')).toBeTruthy();
  });
});
