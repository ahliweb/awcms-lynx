/**
 * The host page's HTML shell. Rendered from TypeScript (rather than an .html
 * template with <%= %> placeholders) so the values are escaped in one place
 * and the file stays valid HTML for editors and linters.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Only `#rgb` / `#rrggbb` reach CSS and the meta tag; anything else falls back. */
export function safeThemeColor(raw: string | undefined): string {
  return raw && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(raw) ? raw : '#0f172a';
}

export interface HtmlShellOptions {
  lang: 'en' | 'id';
  appName: string;
  themeColor: string;
}

export function renderHtmlShell({ lang, appName, themeColor }: HtmlShellOptions): string {
  const name = escapeHtml(appName);
  const color = safeThemeColor(themeColor);
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="${color}" />
    <meta name="description" content="${name}" />
    <!-- A persona app shell has nothing to index; public SEO stays on the Astro sites (awcms ADR-0146). -->
    <meta name="robots" content="noindex, nofollow" />
    <title>${name}</title>
    <style>
      html, body, #root { margin: 0; height: 100%; background: ${color}; }
      lynx-view { display: block; width: 100vw; height: 100vh; }
      @supports (height: 100dvh) { lynx-view { height: 100dvh; } }
      noscript { display: block; padding: 24px; font: 16px/1.5 system-ui, sans-serif; color: #fff; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <noscript>
      ${name} needs JavaScript to run. Please enable JavaScript in your browser and reload the
      page. / ${name} memerlukan JavaScript. Aktifkan JavaScript di peramban Anda lalu muat ulang
      halaman.
    </noscript>
  </body>
</html>
`;
}
