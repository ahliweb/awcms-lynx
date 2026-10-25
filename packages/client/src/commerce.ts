/**
 * Client for ahliweb/awcms-one (customer commerce app, ADR-0016).
 *
 * Facts this encodes:
 *   - Account routes live under `/api/v1/commerce/storefront/account/`. The
 *     server resolves the tenant from `Origin` (browsers) or Host / the default
 *     tenant (native, no Origin). There is NO tenant header on these routes, so
 *     this module never passes `tenantId` to the HTTP layer; native builds on a
 *     multi-tenant backend use `ClientConfig.originHeader` instead.
 *   - Sign-in is passwordless: `otp/request` is deliberately neutral (an
 *     unknown email "succeeds" too, so accounts cannot be enumerated), then
 *     `otp/verify` returns `{ token, expiresAt, account }`.
 *   - Token `cs_` + 43 base64url, 30-day lifetime SLIDING on the server, and
 *     `me` returns no new `expiresAt`. The stored `expiresAt` is therefore not
 *     trusted locally (see session.ts); a 401 UNAUTHENTICATED clears the
 *     session.
 *   - The catalog is NOT served by the API anonymously. The anonymous catalog is
 *     the Astro storefront's static index (`/index/produk.json`,
 *     `/index/berita.json`: raw JSON, not enveloped), fetched from
 *     `storefrontOrigin`. If that is null the call throws a typed
 *     configuration error.
 *   - Checkout: `cart/quote` is anonymous; `POST orders` takes an
 *     `idempotencyKey` (201 first time, 200 on replay) and an optional customer
 *     bearer. 409 CART_CHANGED carries `details.quote`.
 *   - Money is a decimal string, always (see money.ts).
 */

import type { ClientConfig } from './config.ts';
import { AwcmsApiError, configError, isApiError } from './errors.ts';
import type { HttpClient, RequestOptions } from './http.ts';
import { createRandomId, isValidIdempotencyKey } from './ids.ts';
import {
  type CustomerAccount,
  type CustomerSession,
  parseCustomerAccount,
  type SessionManager,
} from './session.ts';
import type {
  CartQuote,
  CartQuoteInput,
  CreateOrderInput,
  NewsIndexEntry,
  Order,
  ProductIndexEntry,
} from './types.ts';

export interface CommerceApi {
  requestOtp(input: {
    email: string;
    purpose: 'login' | 'register';
    name?: string;
    phone?: string;
    via?: 'email' | 'whatsapp';
  }): Promise<{ sent: boolean; expiresInSeconds: number }>;
  verifyOtp(input: {
    email?: string;
    phone?: string;
    code: string;
    purpose: 'login' | 'register';
  }): Promise<CustomerSession>;
  me(): Promise<CustomerAccount>;
  updateMe(input: { name?: string; marketingConsent?: boolean }): Promise<CustomerAccount>;
  logout(): Promise<void>;
  orders(input?: {
    cursor?: string | null;
  }): Promise<{ items: Order[]; nextCursor: string | null }>;
  order(code: string): Promise<Order>;
  productIndex(): Promise<ProductIndexEntry[]>;
  newsIndex(): Promise<NewsIndexEntry[]>;
  quoteCart(input: CartQuoteInput): Promise<CartQuote>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  trackOrder(code: string, phone: string): Promise<Order>;
}

const STOREFRONT = '/api/v1/commerce/storefront';
const ACCOUNT = `${STOREFRONT}/account`;
const OTP_CODE_PATTERN = /^\d{6}$/;

interface Deps {
  config: ClientConfig;
  http: HttpClient;
  sessions: SessionManager;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function malformed(what: string): AwcmsApiError {
  return new AwcmsApiError({
    kind: 'envelope',
    status: 200,
    code: 'BAD_ENVELOPE',
    message: `Response is missing ${what}`,
  });
}

/** `data.order` when present, else `data` itself: the order-detail shape is not pinned down. */
function unwrapOrder(data: unknown): Order {
  const candidate = isRecord(data) && isRecord(data.order) ? data.order : data;
  if (!isRecord(candidate) || typeof candidate.code !== 'string') throw malformed('the order');
  return candidate as Order;
}

function unwrapAccount(data: unknown): CustomerAccount {
  const account = parseCustomerAccount(isRecord(data) && 'account' in data ? data.account : data);
  if (!account) throw malformed('the account');
  return account;
}

export function createCommerceApi({ config, http, sessions }: Deps): CommerceApi {
  const assertBackend = () => {
    if (config.backend !== 'awcms-one') {
      throw configError(
        'WRONG_BACKEND',
        `This call needs the "awcms-one" backend, not "${config.backend}"`,
      );
    }
  };

  const customerToken = (): string | null => {
    const s = sessions.current();
    return s?.kind === 'customer' ? s.token : null;
  };

  /** Customer-bearer call, no tenant header. Clears the session on 401. */
  async function authed<T>(options: Omit<RequestOptions, 'bearer' | 'tenantId'>): Promise<T> {
    assertBackend();
    const token = customerToken();
    if (!token) throw configError('NOT_SIGNED_IN', 'No customer session');
    try {
      return await http.request<T>({ ...options, bearer: token });
    } catch (e) {
      if (isApiError(e) && e.status === 401 && customerToken() === token) await sessions.clear();
      throw e;
    }
  }

  async function anonymous<T>(options: RequestOptions): Promise<T> {
    assertBackend();
    return http.request<T>(options);
  }

  async function staticIndex<T>(file: string): Promise<T[]> {
    assertBackend();
    if (!config.storefrontOrigin) {
      throw configError(
        'STOREFRONT_NOT_CONFIGURED',
        'storefrontOrigin is not set; the anonymous catalog is served by the storefront, not the API',
      );
    }
    const data = await http.request<unknown>({
      method: 'GET',
      path: `/index/${file}`,
      baseUrl: config.storefrontOrigin,
      envelope: false,
    });
    // Tolerate both a bare array and { items: [...] }.
    if (Array.isArray(data)) return data as T[];
    if (isRecord(data) && Array.isArray(data.items)) return data.items as T[];
    throw malformed(`the ${file} array`);
  }

  /** Keep the stored account fresh without touching token or expiresAt. */
  const refreshStoredAccount = async (account: CustomerAccount) => {
    const s = sessions.current();
    if (s?.kind === 'customer') await sessions.save({ ...s, account });
  };

  return {
    async requestOtp(input) {
      const body: Record<string, unknown> = { email: input.email, purpose: input.purpose };
      if (input.name !== undefined) body.name = input.name;
      if (input.phone !== undefined) body.phone = input.phone;
      if (input.via !== undefined) body.via = input.via;
      const data = await anonymous<unknown>({
        method: 'POST',
        path: `${ACCOUNT}/otp/request`,
        body,
      });
      const record = isRecord(data) ? data : {};
      return {
        sent: record.sent !== false,
        expiresInSeconds:
          typeof record.expiresInSeconds === 'number' ? record.expiresInSeconds : 600,
      };
    },

    async verifyOtp(input) {
      assertBackend();
      const hasEmail = !!input.email;
      const hasPhone = !!input.phone;
      if (hasEmail === hasPhone) {
        throw configError('OTP_TARGET_INVALID', 'Provide exactly one of email or phone');
      }
      if (!OTP_CODE_PATTERN.test(input.code)) {
        throw configError('OTP_CODE_INVALID', 'The code must be 6 digits');
      }
      const body: Record<string, unknown> = hasEmail
        ? { email: input.email }
        : { phone: input.phone };
      body.code = input.code;
      body.purpose = input.purpose;
      const data = await http.request<unknown>({
        method: 'POST',
        path: `${ACCOUNT}/otp/verify`,
        body,
      });
      const record = isRecord(data) ? data : {};
      const account = parseCustomerAccount(record.account);
      if (typeof record.token !== 'string' || record.token === '' || !account) {
        throw malformed('token / account');
      }
      const session: CustomerSession = {
        kind: 'customer',
        token: record.token,
        expiresAt: typeof record.expiresAt === 'string' ? record.expiresAt : '',
        account,
      };
      await sessions.save(session);
      return session;
    },

    async me() {
      const account = unwrapAccount(
        await authed<unknown>({ method: 'GET', path: `${ACCOUNT}/me` }),
      );
      await refreshStoredAccount(account);
      return account;
    },

    async updateMe(input) {
      const body: Record<string, unknown> = {};
      if (input.name !== undefined) body.name = input.name;
      if (input.marketingConsent !== undefined) body.marketingConsent = input.marketingConsent;
      const account = unwrapAccount(
        await authed<unknown>({ method: 'PATCH', path: `${ACCOUNT}/me`, body }),
      );
      await refreshStoredAccount(account);
      return account;
    },

    async logout() {
      assertBackend();
      const token = customerToken();
      try {
        if (token)
          await http.request<void>({ method: 'POST', path: `${ACCOUNT}/logout`, bearer: token });
      } catch {
        // Best-effort revocation; the local session is dropped regardless.
      } finally {
        await sessions.clear();
      }
    },

    async orders(input) {
      const data = await authed<unknown>({
        method: 'GET',
        path: `${ACCOUNT}/orders`,
        query: { cursor: input?.cursor },
      });
      if (!isRecord(data)) throw malformed('the orders payload');
      return {
        items: Array.isArray(data.items) ? (data.items as Order[]) : [],
        nextCursor: typeof data.nextCursor === 'string' ? data.nextCursor : null,
      };
    },

    async order(code) {
      return unwrapOrder(
        await authed<unknown>({
          method: 'GET',
          path: `${ACCOUNT}/orders/${encodeURIComponent(code)}`,
        }),
      );
    },

    productIndex: () => staticIndex<ProductIndexEntry>('produk.json'),
    newsIndex: () => staticIndex<NewsIndexEntry>('berita.json'),

    async quoteCart(input) {
      const data = await anonymous<unknown>({
        method: 'POST',
        path: `${STOREFRONT}/cart/quote`,
        body: input,
      });
      if (!isRecord(data)) throw malformed('the quote');
      return data as CartQuote;
    },

    async createOrder(input) {
      assertBackend();
      const idempotencyKey = input.idempotencyKey ?? createRandomId();
      if (!isValidIdempotencyKey(idempotencyKey)) {
        throw configError(
          'IDEMPOTENCY_KEY_INVALID',
          'idempotencyKey must be 1-255 visible ASCII characters',
        );
      }
      // Optional customer bearer: signed-in customers get the order on their account.
      const bearer = customerToken();
      let data: unknown;
      try {
        data = await http.request<unknown>({
          method: 'POST',
          path: `${STOREFRONT}/orders`,
          body: { ...input, idempotencyKey },
          idempotencyKey,
          bearer,
        });
      } catch (e) {
        // A dead token would fail every retry; drop it so the next attempt is a guest checkout.
        if (bearer && isApiError(e) && e.status === 401 && customerToken() === bearer) {
          await sessions.clear();
        }
        throw e;
      }
      return unwrapOrder(data);
    },

    async trackOrder(code, phone) {
      return unwrapOrder(
        await anonymous<unknown>({
          method: 'GET',
          path: `${STOREFRONT}/orders/${encodeURIComponent(code)}`,
          query: { phone },
        }),
      );
    },
  };
}
