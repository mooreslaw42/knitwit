import { readYarnLabel } from '@/lib/read-yarn-label';

jest.mock('@/lib/edge-function', () => ({
  invokeEdgeFunction: jest.fn(),
}));

const { invokeEdgeFunction } = jest.requireMock('@/lib/edge-function') as {
  invokeEdgeFunction: jest.Mock;
};

const PHOTO = 'data:image/jpeg;base64,abc';

const reply = (material: Record<string, unknown>) => {
  invokeEdgeFunction.mockResolvedValueOnce({ material });
};

// The model is told twice to send bare numbers and a schema asks for them, and it still sometimes
// sends "3 mm". None of that should reach a numeric form field, so the client cleans up after it
// rather than trusting the prompt.
describe('reading a ball band into a material', () => {
  beforeEach(() => invokeEdgeFunction.mockReset());

  it('keeps what the band said', async () => {
    reply({
      brand: 'DROPS Design',
      colorName: 'Light Pearl Grey',
      colorLot: '184722',
      composition: '100% Merino Wool',
      weight: '3',
      washing: 'machine-wool',
      grams: '50',
      meters: '175',
      thickness: '3',
      gaugeStitches: '24',
      gaugeRows: '32',
      gaugeSize: '10',
      confident: true,
    });

    const result = await readYarnLabel(PHOTO);

    expect(result.confident).toBe(true);
    expect(result.values.brand).toBe('DROPS Design');
    expect(result.values.colorLot).toBe('184722');
    expect(result.values.gauge).toEqual({
      stitches: 24,
      rows: 32,
      width: 10,
      height: 10,
      unit: 'cm',
    });
  });

  it('strips a unit the model left on a number', async () => {
    reply({ grams: '50 g', meters: '175 m', thickness: '3 mm', gaugeSize: '10 x 10 cm' });
    const { values } = await readYarnLabel(PHOTO);
    expect(values.grams).toBe('50');
    expect(values.meters).toBe('175');
    expect(values.thickness).toBe('3');
  });

  it('reads a decimal needle size written either way', async () => {
    reply({ thickness: '3,5' });
    expect((await readYarnLabel(PHOTO)).values.thickness).toBe('3.5');
  });

  // A blank field means the band does not say, and the form may already hold something the knitter
  // typed. Spreading an empty string over that would quietly wipe it.
  it('leaves out anything the band was silent about', async () => {
    reply({ brand: 'Rowan', colorName: '', colorLot: '   ', composition: '' });
    const { values, filled } = await readYarnLabel(PHOTO);
    expect(values).toEqual({ brand: 'Rowan' });
    expect(filled).toEqual(['brand']);
  });

  it('does not invent a gauge out of a band that states none', async () => {
    reply({ brand: 'Rowan', gaugeStitches: '', gaugeRows: '', gaugeSize: '' });
    expect((await readYarnLabel(PHOTO)).values.gauge).toBeUndefined();
  });

  // Half a tension square is still worth keeping — the missing half reads as zero, which is what
  // the gauge field already shows for "not stated".
  it('keeps a tension square that gives only stitches, and assumes 10cm', async () => {
    reply({ gaugeStitches: '24', gaugeRows: '', gaugeSize: '' });
    expect((await readYarnLabel(PHOTO)).values.gauge).toEqual({
      stitches: 24,
      rows: 0,
      width: 10,
      height: 10,
      unit: 'cm',
    });
  });

  it('reports a photo the model could not read, without throwing away what it got', async () => {
    reply({ brand: 'Rowan', confident: false });
    const result = await readYarnLabel(PHOTO);
    expect(result.confident).toBe(false);
    expect(result.values.brand).toBe('Rowan');
  });

  it('survives a reply with no material at all', async () => {
    invokeEdgeFunction.mockResolvedValueOnce({});
    const result = await readYarnLabel(PHOTO);
    expect(result.values).toEqual({});
    expect(result.confident).toBe(false);
  });

  it('sends the photo as a material task', async () => {
    reply({ brand: 'Rowan' });
    await readYarnLabel(PHOTO);
    expect(invokeEdgeFunction).toHaveBeenCalledWith(
      'parse-pattern',
      { task: 'material', image: PHOTO },
      expect.objectContaining({ timeoutMs: expect.any(Number) }),
    );
  });
});
