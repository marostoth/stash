import { describe, expect, it } from 'vitest';
import {
  FALLBACK_GLOBAL_COMMANDS,
  formatShortcutTokens,
  SHORTCUT_GROUPS,
} from '@/lib/shortcuts/shortcut-catalog';

describe('formatShortcutTokens', () => {
  it('splits Windows/Linux + chords cleanly', () => {
    expect(formatShortcutTokens('Alt+Shift+S', 'other')).toEqual([
      'Alt',
      'Shift',
      'S',
    ]);
    expect(formatShortcutTokens('Ctrl+Shift+K', 'other')).toEqual([
      'Ctrl',
      'Shift',
      'K',
    ]);
    expect(formatShortcutTokens('Command+D', 'other')).toEqual(['Ctrl', 'D']);
  });

  it('adapts modifiers and compact symbol strings on macOS', () => {
    expect(formatShortcutTokens('Alt+Shift+S', 'mac')).toEqual(['⌥', '⇧', 'S']);
    expect(formatShortcutTokens('Ctrl+K', 'mac')).toEqual(['⌘', 'K']);
    expect(formatShortcutTokens('⌘⇧S', 'mac')).toEqual(['⌘', '⇧', 'S']);
    expect(formatShortcutTokens('⌥⇧D', 'mac')).toEqual(['⌥', '⇧', 'D']);
    expect(formatShortcutTokens('⌘⇧S', 'other')).toEqual([
      'Ctrl',
      'Shift',
      'S',
    ]);
  });

  it('returns an empty array for empty or unassigned shortcuts', () => {
    expect(formatShortcutTokens('', 'other')).toEqual([]);
    expect(formatShortcutTokens('   ', 'mac')).toEqual([]);
  });
});

describe('SHORTCUT_GROUPS catalog integrity', () => {
  it('contains well-formed groups with non-empty labels and keys', () => {
    expect(SHORTCUT_GROUPS.length).toBe(3);

    const seenIds = new Set<string>();
    for (const group of SHORTCUT_GROUPS) {
      expect(group.title.trim().length).toBeGreaterThan(0);
      expect(group.items.length).toBeGreaterThan(0);

      for (const item of group.items) {
        expect(seenIds.has(item.id)).toBe(false);
        seenIds.add(item.id);
        expect(item.label.trim().length).toBeGreaterThan(0);
        expect(item.keys.length).toBeGreaterThan(0);
        for (const key of item.keys) {
          expect(key.trim().length).toBeGreaterThan(0);
        }
      }
    }

    expect(FALLBACK_GLOBAL_COMMANDS.length).toBeGreaterThanOrEqual(2);
    for (const cmd of FALLBACK_GLOBAL_COMMANDS) {
      expect(cmd.name.trim().length).toBeGreaterThan(0);
      expect(cmd.description.trim().length).toBeGreaterThan(0);
      expect(
        formatShortcutTokens(cmd.shortcut, 'other').length,
      ).toBeGreaterThan(0);
    }
  });
});
