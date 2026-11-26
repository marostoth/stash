import { describe, expect, it } from 'vitest';
import {
  computeNeighborJolt,
  computeSpaceSlideDirection,
} from '@/lib/motion/presets';
import { splitHighlightSegments } from '@/lib/utils/highlight-match';

describe('computeNeighborJolt', () => {
  it('pushes cards radially away from impact center with distance falloff', () => {
    const right = computeNeighborJolt({ x: 100, y: 100 }, { x: 260, y: 100 });
    expect(right).not.toBeNull();
    expect(right?.dx).toBeGreaterThan(0);
    expect(right?.dy).toBe(0);

    const farRight = computeNeighborJolt(
      { x: 100, y: 100 },
      { x: 420, y: 100 },
    );
    expect(farRight).not.toBeNull();
    expect(farRight?.dx ?? 99).toBeLessThan(right?.dx ?? 0);
    expect(farRight?.delaySec ?? 0).toBeGreaterThan(right?.delaySec ?? 0);

    const below = computeNeighborJolt({ x: 100, y: 100 }, { x: 100, y: 240 });
    expect(below?.dx).toBe(0);
    expect(below?.dy).toBeGreaterThan(0);
  });

  it('returns null for the impact card itself or cards outside shockwave radius', () => {
    expect(
      computeNeighborJolt({ x: 100, y: 100 }, { x: 102, y: 102 }),
    ).toBeNull();
    expect(
      computeNeighborJolt({ x: 100, y: 100 }, { x: 800, y: 100 }),
    ).toBeNull();
  });
});

describe('computeSpaceSlideDirection', () => {
  const ids = ['main', 'shopping', 'research'];

  it('returns +1 when moving right, -1 when moving left, and 0 when unchanged or unknown', () => {
    expect(computeSpaceSlideDirection(ids, 'main', 'shopping')).toBe(1);
    expect(computeSpaceSlideDirection(ids, 'research', 'main')).toBe(-1);
    expect(computeSpaceSlideDirection(ids, 'main', 'main')).toBe(0);
    expect(computeSpaceSlideDirection(ids, 'main', 'missing')).toBe(0);
  });
});

describe('splitHighlightSegments', () => {
  it('highlights case-insensitive multi-word matches and escapes regex characters', () => {
    const segs = splitHighlightSegments(
      'Autoglym Clean Wheels (C++)',
      'clean c++',
    );
    expect(segs.filter((s) => s.match).map((s) => s.text)).toEqual([
      'Clean',
      'C++',
    ]);
  });

  it('ignores empty or 1-character queries', () => {
    expect(splitHighlightSegments('TradingView', 't')).toEqual([
      { text: 'TradingView', match: false },
    ]);
  });
});
