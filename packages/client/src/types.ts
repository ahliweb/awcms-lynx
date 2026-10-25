/**
 * Wire DTOs. Typed loosely on purpose where the backend contract is not fully
 * pinned down (`[k: string]: unknown`): the client must keep working when the
 * backend adds a field, and the app only reads the fields named here.
 */

// ---- awcms (staff / member app) -------------------------------------------

export interface HealthStatus {
  status: string;
  service: string;
  runtime: string;
  moduleCount: number;
  generatedAt: string;
}

/** `GET /api/v1/auth/me` */
export interface StaffIdentity {
  identityId: string;
  loginIdentifier: string;
  profileId: string | null;
  status: string;
  lastLoginAt: string | null;
}

/** `GET /api/v1/auth/session` */
export interface SessionIntrospection {
  identityId: string;
  tenantId: string;
  displayName: string | null;
  roles: string[];
  assuranceLevel: 'aal1' | 'aal2';
  expiresAt: string;
  scopes: string[];
}

export interface SearchItem {
  resourceType: string;
  resourceId: string;
  url: string;
  title: string;
  /** Pre-escaped HTML with `<mark>`; run it through `snippetToText` before showing it. */
  snippet: string;
  locale: string;
  rank: number;
}

export interface SearchPage {
  items: SearchItem[];
  nextCursor: string | null;
  facets: unknown;
  query: string;
  locale: string;
}

export interface JsonFeedItem {
  id: string;
  url: string;
  title: string;
  summary?: string;
  content_text?: string;
  date_published?: string;
  image?: string;
}

/** JSON Feed 1.1 (`GET /feed.json`, not enveloped). */
export interface JsonFeed {
  version: string;
  title: string;
  home_page_url?: string;
  items: JsonFeedItem[];
}

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  publishedAt?: string;
  [k: string]: unknown;
}

// ---- awcms-one (customer commerce app) ------------------------------------

export interface Order {
  code: string;
  status: string;
  paymentStatus?: string;
  /** Money: decimal string such as "19999.00". Never a number. */
  total: string;
  createdAt: string;
  lines?: unknown[];
  [k: string]: unknown;
}

/**
 * Row of the storefront's static `/index/produk.json` — awcms-one
 * `apps/storefront/src/lib/catalog.ts` `ProdukIndexEntry`, built by
 * `buildProdukIndex()`. `price`/`finalPrice` are money strings; `rating` is the
 * product's `averageRating`, also a decimal string.
 */
export interface ProductIndexEntry {
  id: string;
  slug: string;
  name: string;
  sku: string;
  categorySlug: string | null;
  categoryName: string | null;
  price: string;
  finalPrice: string;
  image: { url: string; alt: string } | null;
  label: string | null;
  labelColor: string | null;
  rating: string | null;
  sold: number;
  stock: number;
  inFlashSale: boolean;
  [k: string]: unknown;
}

/**
 * Row of the storefront's static `/index/berita.json` — awcms-one
 * `apps/storefront/src/profil/berita/pages/index/berita.json.ts` `BeritaIndexEntry`.
 */
export interface NewsIndexEntry {
  slug: string;
  title: string;
  excerpt: string | null;
  rubrik: string | null;
  region: string | null;
  date: string;
  [k: string]: unknown;
}

export interface CartLineInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface CartQuoteInput {
  lines: CartLineInput[];
  shipping?: unknown;
  voucherCode?: string;
  destination?: { districtCode: string };
}

export interface CartQuote {
  canCheckout: boolean;
  lines: unknown[];
  total?: string;
  [k: string]: unknown;
}

/**
 * Checkout body. Same fields as the quote plus whatever customer / payment
 * fields the storefront order route takes (contact, address, payment method…),
 * passed through untouched.
 */
export interface CreateOrderInput extends CartQuoteInput {
  /** UUID; generated when absent. A replay with the same key returns 200 and the same order. */
  idempotencyKey?: string;
  [k: string]: unknown;
}
