/**
 * Lynx `<text>` renders plain text only, never HTML. The site-search backend
 * returns `snippet` as pre-escaped HTML with `<mark>` around the hits, so the
 * app flattens it with this helper before display.
 *
 * Order matters: tags are stripped first, then entities are decoded in a single
 * pass. Decoding first would turn an escaped `&lt;b&gt;` into a real tag and
 * strip it; decoding in two passes would turn `&amp;lt;` into `<`.
 */

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};

export function snippetToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
}
