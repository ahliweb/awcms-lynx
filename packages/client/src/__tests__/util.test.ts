import { describe, expect, test } from 'bun:test';
import { createRandomId, isValidIdempotencyKey } from '../ids.ts';
import { formatMoney } from '../money.ts';
import { snippetToText } from '../text.ts';

describe('formatMoney', () => {
  test('id locale', () => {
    expect(formatMoney('19999.00', 'id')).toBe('Rp19.999');
    expect(formatMoney('19999.50', 'id')).toBe('Rp19.999,50');
    expect(formatMoney('0.00', 'id')).toBe('Rp0');
    expect(formatMoney('1234567.89', 'id')).toBe('Rp1.234.567,89');
    expect(formatMoney('-1500.50', 'id')).toBe('-Rp1.500,50');
    expect(formatMoney('999.00', 'id')).toBe('Rp999');
    expect(formatMoney('0.05', 'id')).toBe('Rp0,05');
  });

  test('en locale', () => {
    expect(formatMoney('19999.00', 'en')).toBe('IDR 19,999');
    expect(formatMoney('19999.50', 'en')).toBe('IDR 19,999.50');
    expect(formatMoney('0.00', 'en')).toBe('IDR 0');
    expect(formatMoney('1234567.89', 'en')).toBe('IDR 1,234,567.89');
    expect(formatMoney('-1500.50', 'en')).toBe('-IDR 1,500.50');
  });

  test('other currency and integer / odd-precision input', () => {
    expect(formatMoney('1000.00', 'en', 'USD')).toBe('USD 1,000');
    expect(formatMoney('1000.5', 'id', 'USD')).toBe('USD 1.000,50');
    expect(formatMoney('5000', 'id')).toBe('Rp5.000');
    expect(formatMoney('19999.500', 'id')).toBe('Rp19.999,50');
    expect(formatMoney('007.00', 'id')).toBe('Rp7');
  });

  test('negative zero loses its sign', () => {
    expect(formatMoney('-0.00', 'id')).toBe('Rp0');
  });

  test('exact for amounts beyond float precision (string arithmetic only)', () => {
    expect(formatMoney('123456789012.99', 'id')).toBe('Rp123.456.789.012,99');
    expect(formatMoney('99999999999999.99', 'en')).toBe('IDR 99,999,999,999,999.99');
  });

  test('invalid input is returned unchanged', () => {
    for (const bad of ['', 'abc', '1e5', '1,000.00', '.5', '5.', ' 5', '--5', 'Rp5']) {
      expect(formatMoney(bad, 'id')).toBe(bad);
    }
  });
});

describe('snippetToText', () => {
  test('strips tags and decodes the escaped entities', () => {
    expect(snippetToText('Cara <mark>kopi</mark> &amp; teh')).toBe('Cara kopi & teh');
    expect(snippetToText('a &lt; b &gt; c &quot;q&quot; it&#39;s it&#x27;s')).toBe(
      'a < b > c "q" it\'s it\'s',
    );
  });

  test('escaped markup is text, not a tag', () => {
    expect(snippetToText('&lt;b&gt;bold&lt;/b&gt;')).toBe('<b>bold</b>');
  });

  test('decodes exactly once', () => {
    expect(snippetToText('&amp;lt;')).toBe('&lt;');
  });

  test('collapses whitespace and trims; handles empty', () => {
    expect(snippetToText('  a\n  <mark>b</mark>\t c ')).toBe('a b c');
    expect(snippetToText('')).toBe('');
  });
});

describe('createRandomId', () => {
  test('is UUID v4 shaped', () => {
    for (let i = 0; i < 50; i++) {
      expect(createRandomId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  test('is unique across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createRandomId()));
    expect(ids.size).toBe(1000);
  });

  test('falls back to Math.random without crypto', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      const id = createRandomId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(createRandomId()).not.toBe(id);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    }
  });

  test('generated ids are valid idempotency keys', () => {
    expect(isValidIdempotencyKey(createRandomId())).toBe(true);
  });
});
