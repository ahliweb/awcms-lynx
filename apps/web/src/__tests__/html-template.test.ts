import { describe, expect, test } from 'bun:test';
import { renderHtmlShell, safeThemeColor } from '../../html-template.ts';

describe('renderHtmlShell', () => {
  test('has lang, viewport, title, theme-color and a noscript message', () => {
    const html = renderHtmlShell({ lang: 'en', appName: 'Toko', themeColor: '#112233' });
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('<title>Toko</title>');
    expect(html).toContain('<meta name="theme-color" content="#112233" />');
    expect(html).toContain('<noscript>');
  });

  test('keeps the app shell out of search indexes (no SEO surface in a persona app)', () => {
    const html = renderHtmlShell({ lang: 'id', appName: 'Toko', themeColor: '#112233' });
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
  });

  test('escapes the app name and rejects a non-hex theme colour', () => {
    const html = renderHtmlShell({
      lang: 'id',
      appName: '<script>alert("x")</script>',
      themeColor: 'red;}</style><script>',
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(safeThemeColor('red;}')).toBe('#0f172a');
    expect(html).toContain('content="#0f172a"');
  });
});
