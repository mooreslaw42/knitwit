import { fireEvent, render, screen } from '@testing-library/react-native';

import { PatternKitEditor, type PatternKit } from '@/components/pattern-section-editor';

// Reaches AsyncStorage's native module (through the shared UI kit), which isn't there under Jest.
jest.mock('@/lib/photo-store', () => ({ putPhoto: jest.fn(), PHOTO_STORAGE_FULL: '' }));

// A pixel pattern's yarn slots *are* its colours. The kit editor has no field for a colour, and it
// used to rebuild every slot from the fields it did have — so opening a single yarn card wrote the
// whole pattern back without a colour, and its chart went from a picture to rows of plain stitches.
describe('PatternKitEditor', () => {
  it('keeps each yarn slot’s colour when anything in the kit is edited', async () => {
    const initial: PatternKit = {
      materials: [
        { id: 'a', label: 'Colour A', short: 'A', color: '#aa3322' },
        { id: 'b', label: 'Colour B', short: 'B', color: '#2233aa' },
      ],
      tools: [],
      techniques: [],
    };
    const onChange = jest.fn();
    await render(<PatternKitEditor initial={initial} onChange={onChange} />);

    // Only opening the card — the smallest thing that commits.
    fireEvent.press(screen.getByText('A · Colour A'));

    const kit: PatternKit = onChange.mock.calls.at(-1)[0];
    expect(kit.materials.map((m) => m.color)).toEqual(['#aa3322', '#2233aa']);
  });

  it('does not invent a colour for an ordinary yarn slot', async () => {
    const onChange = jest.fn();
    await render(
      <PatternKitEditor
        initial={{ materials: [{ id: 'a', label: 'Main', short: 'A' }], tools: [], techniques: [] }}
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByText('A · Main'));
    expect(onChange.mock.calls.at(-1)[0].materials[0]).not.toHaveProperty('color');
  });
});
