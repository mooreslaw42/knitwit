import { resolveRowGroups } from '@/lib/knitwit-helpers';
import {
  buildPixelPattern,
  cellsBetween,
  colorTag,
  compactPalette,
  gridHeight,
  paintCell,
  quantize,
  rgbToHex,
  type ImageSample,
} from '@/lib/pixel-pattern';
import type { PatternSection } from '@/types/knitwit';

// A test image from hex pixels, row-major from the top-left — the orientation a decoder hands back.
function sample(width: number, height: number, hexes: string[]): ImageSample {
  const data = new Uint8Array(width * height * 4);
  hexes.forEach((hex, i) => {
    data[i * 4] = parseInt(hex.slice(1, 3), 16);
    data[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
    data[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
    data[i * 4 + 3] = 255;
  });
  return { width, height, data };
}

// The colour the chart would show at a screen position, counting rows up from the bottom and
// columns from the left — the way a knitting chart is read. Re-derives what stitch-chart.tsx draws:
// pattern row 0 is the bottom, and each row is reversed so stitch 1 sits on the right.
function screenColor(section: PatternSection, materials: { id: string; color?: string }[], rowFromBottom: number, colFromLeft: number): string | undefined {
  const row = section.rows[rowFromBottom];
  const cells: string[] = [];
  for (const { group, units } of resolveRowGroups(row, section.castOn as number, 0)) {
    for (let i = 0; i < units; i++) cells.push(group.materialSlot ?? '');
  }
  const slot = cells[cells.length - 1 - colFromLeft];
  return materials.find((m) => m.id === slot)?.color;
}

describe('gridHeight', () => {
  it('keeps the aspect ratio', () => {
    expect(gridHeight({ width: 10, height: 5 }, 4)).toBe(2);
    expect(gridHeight({ width: 100, height: 300 }, 20)).toBe(60);
  });
  it('never returns less than one row', () => {
    expect(gridHeight({ width: 100, height: 1 }, 10)).toBe(1);
    expect(gridHeight({ width: 0, height: 0 }, 10)).toBe(1);
  });
});

describe('quantize', () => {
  it('keeps every distinct colour when there is room, in the picture', () => {
    const img = sample(2, 2, ['#ff0000', '#00ff00', '#0000ff', '#ffffff']);
    const grid = quantize(img, 2, 4);
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(2);
    expect(grid.palette.map(rgbToHex).sort()).toEqual(
      ['#0000ff', '#00ff00', '#ff0000', '#ffffff'].sort(),
    );
  });

  it('collapses a solid image to a single colour, not a padded palette', () => {
    const img = sample(2, 2, ['#3366cc', '#3366cc', '#3366cc', '#3366cc']);
    const grid = quantize(img, 2, 6);
    expect(grid.palette).toHaveLength(1);
    expect(grid.cells).toEqual([0, 0, 0, 0]);
  });

  it('clamps the width to the grid ceiling', () => {
    const img = sample(10, 10, Array(100).fill('#000000'));
    expect(quantize(img, 999, 4).width).toBe(60);
  });
});

describe('buildPixelPattern', () => {
  const img = sample(2, 2, ['#ff0000', '#00ff00', '#0000ff', '#ffffff']);
  const grid = quantize(img, 2, 4);

  it('makes one colour slot per palette colour', () => {
    const { materials } = buildPixelPattern(grid, 'knit');
    expect(materials).toHaveLength(4);
    expect(materials.map((m) => m.short)).toEqual(['A', 'B', 'C', 'D']);
    expect(materials.every((m) => /^#[0-9a-f]{6}$/.test(m.color ?? ''))).toBe(true);
  });

  it('charts one row per grid row, the full width, counted at least as high as charted', () => {
    const { section } = buildPixelPattern(grid, 'knit');
    expect(section.castOn).toBe(2);
    expect(section.totalRows).toBe(2);
    expect(section.rows).toHaveLength(2);
    for (const row of section.rows) {
      const total = row.stitches.reduce((n, g) => n + (g.count as number), 0);
      expect(total).toBe(2);
    }
  });

  it('uses the craft stitch — knit for knitting, single crochet for crochet', () => {
    expect(buildPixelPattern(grid, 'knit').section.rows[0].stitches[0].type).toBe('knit');
    expect(buildPixelPattern(grid, 'crochet').section.rows[0].stitches[0].type).toBe('sc');
  });

  it('orients the chart so it reads as the photo, right way up and unmirrored', () => {
    const { materials, section } = buildPixelPattern(grid, 'knit');
    // Source: red top-left, green top-right, blue bottom-left, white bottom-right.
    expect(screenColor(section, materials, 0, 0)).toBe('#0000ff'); // bottom-left
    expect(screenColor(section, materials, 0, 1)).toBe('#ffffff'); // bottom-right
    expect(screenColor(section, materials, 1, 0)).toBe('#ff0000'); // top-left
    expect(screenColor(section, materials, 1, 1)).toBe('#00ff00'); // top-right
  });
});

describe('paintCell', () => {
  const grid = quantize(sample(2, 2, ['#ff0000', '#00ff00', '#0000ff', '#ffffff']), 2, 4);

  it('repaints one stitch and leaves the original grid alone', () => {
    const next = paintCell(grid, 0, grid.cells[3]);
    expect(next.cells[0]).toBe(grid.cells[3]);
    expect(next.cells.slice(1)).toEqual(grid.cells.slice(1));
    expect(grid.cells[0]).not.toBe(grid.cells[3]);
  });

  // A drag passes over the same cell again and again; the same object back is what lets the
  // editor know nothing needs drawing.
  it('hands back the same grid when nothing changes', () => {
    expect(paintCell(grid, 0, grid.cells[0])).toBe(grid);
    expect(paintCell(grid, -1, 0)).toBe(grid);
    expect(paintCell(grid, 99, 0)).toBe(grid);
    expect(paintCell(grid, 0, 99)).toBe(grid);
  });

  it('carries hand edits through into the chart', () => {
    // Paint the top-left (red) stitch white.
    const white = grid.cells[3];
    const { materials, section } = buildPixelPattern(compactPalette(paintCell(grid, 0, white)), 'knit');
    expect(screenColor(section, materials, 1, 0)).toBe('#ffffff');
  });
});

describe('cellsBetween', () => {
  it('is just the one cell when both ends are the same', () => {
    expect(cellsBetween({ x: 2, y: 3 }, { x: 2, y: 3 })).toEqual([{ x: 2, y: 3 }]);
  });

  it('fills a fast horizontal drag with every stitch it crossed', () => {
    expect(cellsBetween({ x: 0, y: 1 }, { x: 4, y: 1 }).map((c) => c.x)).toEqual([0, 1, 2, 3, 4]);
  });

  it('runs backwards as well as forwards', () => {
    expect(cellsBetween({ x: 3, y: 0 }, { x: 0, y: 0 }).map((c) => c.x)).toEqual([3, 2, 1, 0]);
  });

  it('leaves no gaps on a diagonal', () => {
    const line = cellsBetween({ x: 0, y: 0 }, { x: 5, y: 2 });
    expect(line[0]).toEqual({ x: 0, y: 0 });
    expect(line[line.length - 1]).toEqual({ x: 5, y: 2 });
    for (let i = 1; i < line.length; i++) {
      expect(Math.abs(line[i].x - line[i - 1].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(line[i].y - line[i - 1].y)).toBeLessThanOrEqual(1);
    }
  });
});

describe('compactPalette', () => {
  const grid = quantize(sample(2, 2, ['#ff0000', '#00ff00', '#0000ff', '#ffffff']), 2, 4);

  it('drops a colour painted out entirely, so it does not become a yarn nobody uses', () => {
    const red = grid.cells[0];
    const painted = paintCell(grid, 0, grid.cells[1]);
    const compact = compactPalette(painted);
    expect(compact.palette).toHaveLength(3);
    expect(compact.palette).not.toContainEqual(grid.palette[red]);
    // Every cell still shows the colour it did before renumbering.
    compact.cells.forEach((c, i) => expect(compact.palette[c]).toEqual(painted.palette[painted.cells[i]]));
    expect(buildPixelPattern(compact, 'knit').materials).toHaveLength(3);
  });

  it('leaves a grid that uses every colour untouched', () => {
    expect(compactPalette(grid)).toBe(grid);
  });
});

describe('colorTag', () => {
  it('counts A, B, … Z, AA', () => {
    expect([0, 1, 25, 26].map(colorTag)).toEqual(['A', 'B', 'Z', 'AA']);
  });
});
