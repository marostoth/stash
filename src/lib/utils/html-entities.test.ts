import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from '@/lib/utils/html-entities';

describe('utils/html-entities', () => {
  it('decodes named, typographic, decimal, and hex entities accurately', () => {
    expect(
      decodeHtmlEntities(
        'Tom &amp; Jerry &mdash; Episode &ndash; &quot;Pilot&quot; &#39;A&#x21;&apos; &lt;1&gt;&nbsp;ok',
      ),
    ).toBe('Tom & Jerry — Episode – "Pilot" \'A!\' <1> ok');
    expect(decodeHtmlEntities('Fire &#x1F525; and &#65;')).toBe(
      'Fire 🔥 and A',
    );
  });

  it('never throws on out-of-range or malformed numeric entities', () => {
    expect(decodeHtmlEntities('Bad decimal &#99999999; stays safe')).toBe(
      'Bad decimal &#99999999; stays safe',
    );
    expect(decodeHtmlEntities('Bad hex &#x99999999; stays safe')).toBe(
      'Bad hex &#x99999999; stays safe',
    );
    expect(
      decodeHtmlEntities('Max valid &#x10FFFF; vs overflow &#x110000;'),
    ).toBe(
      `Max valid ${String.fromCodePoint(0x10ffff)} vs overflow &#x110000;`,
    );
  });
});
