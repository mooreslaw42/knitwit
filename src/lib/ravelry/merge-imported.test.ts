import type {
  Material,
  Pattern,
  PatternSection,
  Project,
  ProjectSection,
  Tool,
} from '@/types/knitwit';

import { mergeMaterial, mergePattern, mergeProject, mergeTool } from './merge-imported';

const SOURCE = (id: string, at: string) =>
  ({ id, kind: 'stash', url: '', importedAt: at }) as Material['ravelrySource'];

function material(over: Partial<Material> = {}): Material {
  return {
    brand: '',
    colorName: '',
    colorLot: '',
    price: '',
    weight: '',
    grams: '',
    meters: '',
    composition: '',
    thickness: '',
    strands: '',
    craftType: 'knit',
    washing: '',
    gauge: null,
    link: '',
    photo: null,
    ...over,
  };
}

describe('mergeMaterial', () => {
  it('refreshes Ravelry’s facts and keeps what the knitter measured', () => {
    const existing = material({
      brand: 'Garnstudio DROPS Saga',
      colorName: '3 Birk',
      // The knitter's own work — none of which the mapper knows anything about.
      thickness: 'a bit splitty',
      washing: 'Hand wash, dry flat',
      careSymbols: ['hand-wash'],
      gauge: { stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' },
      ravelrySource: SOURCE('111', 'first'),
    });
    const incoming = material({
      brand: 'Garnstudio DROPS Saga (renamed on Ravelry)',
      colorName: '3 Birk',
      grams: '50',
      ravelrySource: SOURCE('111', 'second'),
    });

    const merged = mergeMaterial(existing, incoming);

    expect(merged.brand).toBe('Garnstudio DROPS Saga (renamed on Ravelry)'); // Ravelry refreshed
    expect(merged.grams).toBe('50');
    // The things an import has no business blanking:
    expect(merged.thickness).toBe('a bit splitty');
    expect(merged.washing).toBe('Hand wash, dry flat');
    expect(merged.careSymbols).toEqual(['hand-wash']);
    expect(merged.gauge).toEqual({ stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' });
    expect(merged.ravelrySource?.importedAt).toBe('second');
  });

  it('does not blank a field the import has nothing to say about', () => {
    const existing = material({ colorLot: '123', link: 'https://example.test/yarn' });
    const merged = mergeMaterial(existing, material({ brand: 'New' }));
    expect(merged.colorLot).toBe('123');
    expect(merged.link).toBe('https://example.test/yarn');
  });
});

describe('mergeTool', () => {
  it('takes Ravelry’s count', () => {
    const existing: Tool = { type: 'dpn', thickness: '3.25mm', length: '20cm', quantity: 1 };
    const incoming: Tool = { type: 'dpn', thickness: '3.25mm', length: '20cm', quantity: 3 };
    expect(mergeTool(existing, incoming).quantity).toBe(3);
  });
});

function pattern(over: Partial<Pattern> = {}): Pattern {
  return {
    name: '',
    category: 'other',
    craft: 'knit',
    weight: '',
    needleSize: '',
    video: '',
    sourceName: '',
    sourceText: '',
    accentColor: '',
    photo: null,
    gauge: null,
    swatchGauge: null,
    favorited: false,
    notes: '',
    level: 'intermediate',
    sizes: [],
    materials: [],
    tools: [],
    techniques: [],
    sections: [],
    ...over,
  };
}

describe('mergePattern', () => {
  it('never loses a chart built from the PDF', () => {
    const charted = [{ id: 'sec1', name: 'Body' } as PatternSection];
    const existing = pattern({
      name: 'Camisole No. 9',
      // What Phase 4 produced — a slow, paid-for AI pass.
      sections: charted,
      materials: [{ id: 'pm1', label: 'MC', short: 'A' }],
      sizes: ['S', 'M', 'L'],
      swatchGauge: { stitches: 28, rows: 36, width: 10, height: 10, unit: 'cm' },
      accentColor: '#F4C6D3',
      // The knitter corrected the mapper's guess.
      category: 'tops',
    });
    // A metadata card: everything structural empty, and the category guessed differently.
    const incoming = pattern({ name: 'Camisole No. 9 (v2)', category: 'other', favorited: true });

    const merged = mergePattern(existing, incoming);

    expect(merged.sections).toBe(charted); // the chart survives
    expect(merged.materials).toHaveLength(1);
    expect(merged.sizes).toEqual(['S', 'M', 'L']);
    expect(merged.swatchGauge).not.toBeNull();
    expect(merged.accentColor).toBe('#F4C6D3');
    expect(merged.category).toBe('tops'); // their correction is not reverted
    expect(merged.name).toBe('Camisole No. 9 (v2)'); // Ravelry's name refreshed
    expect(merged.favorited).toBe(true);
  });

  it('takes the import’s structure when the card had none', () => {
    const incoming = pattern({ sizes: ['One size'], sections: [{ id: 's' } as PatternSection] });
    const merged = mergePattern(pattern(), incoming);
    expect(merged.sizes).toEqual(['One size']);
    expect(merged.sections).toHaveLength(1);
  });
});

function project(over: Partial<Project> = {}): Project {
  return {
    name: '',
    startedOn: null,
    craft: 'knit',
    photo: null,
    color: '#F7EBDD',
    colorDeep: '#8A7873',
    category: 'other',
    level: 'intermediate',
    needleSize: '',
    video: '',
    sourceName: '',
    sourceText: '',
    notes: '',
    labels: [],
    patternId: null,
    sizeIndex: 0,
    status: 'active',
    gauge: null,
    sections: [],
    ...over,
  };
}

describe('mergeProject', () => {
  it('never loses the row the knitter is on', () => {
    // Mid-project: 37 rows counted. This is the thing that must not disappear.
    const counting = [{ id: 'psec1', name: 'Body', row: 37, totalRows: 60 } as ProjectSection];
    const existing = project({
      name: 'Test project 1',
      sections: counting,
      notes: 'ran out of yarn, ordered more',
      color: '#E8B4C0',
      sizeIndex: 2,
      status: 'active',
    });
    // What an import always brings: one placeholder section, "row 1 of 1".
    const incoming = project({
      name: 'Test project 1',
      status: 'finished',
      sections: [{ id: 'psec_rav_1', name: 'Whole project', row: 1, totalRows: 1 } as ProjectSection],
    });

    const merged = mergeProject(existing, incoming);

    expect(merged.sections).toBe(counting); // row 37 of 60 survives
    expect(merged.notes).toBe('ran out of yarn, ordered more');
    expect(merged.color).toBe('#E8B4C0');
    expect(merged.sizeIndex).toBe(2);
    expect(merged.status).toBe('finished'); // Ravelry's status still refreshed
  });

  it('accepts the placeholder when the project has no sections yet', () => {
    const incoming = project({ sections: [{ id: 'p' } as ProjectSection] });
    expect(mergeProject(project(), incoming).sections).toHaveLength(1);
  });
});
