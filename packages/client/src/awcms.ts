/**
 * Client for ahliweb/awcms (the staff / member app backend).
 *
 * Facts this encodes (verified against the backend source):
 *   - Tenant travels in the `X-AWCMS-Tenant-ID` header on authenticated calls.
 *   - `POST /api/v1/auth/login` -> 200 `{ token, expiresAt }`: an opaque bearer,
 *     default TTL 120 min, NO refresh token and no sliding window. When it
 *     lapses the user signs in again (docs: gaps in README.md).
 *   - Login can branch instead of succeeding, which `LoginOutcome` models:
 *       409 MEMBERSHIP_SELECTION_REQUIRED  details { principalToken, expiresAt }
 *           -> POST /auth/session/tenant { principalToken, tenantId }
 *       401 MFA_REQUIRED                   details { mfaChallengeToken, expiresAt }
 *           -> POST /auth/mfa/totp/verify { mfaChallengeToken, code | recoveryCode }
 *       401 MFA_ENROLLMENT_REQUIRED        details { mfaEnrollmentToken, expiresAt }
 *           -> enrolment UI is out of scope; the app tells the user to enrol in the web admin
 *       TURNSTILE_REQUIRED / TURNSTILE_INVALID
 *           -> a native app cannot run Cloudflare Turnstile, so it is a typed outcome
 *   - A 401 on a request that carried the staff bearer means the session is
 *     dead server-side, so the stored session is cleared before the error is
 *     rethrown; the app's session subscriber then routes to the login screen.
 *   - Logout always clears the local session, even if the server call fails:
 *     the user must never be stuck "signed in" because the network is down.
 */

import { API_PREFIX, type ClientConfig } from './config.ts';
import { AwcmsApiError, configError, isApiError } from './errors.ts';
import type { HttpClient, QueryValue, RequestOptions } from './http.ts';
import type { SessionManager, StaffSession } from './session.ts';
import type {
  BlogPostSummary,
  HealthStatus,
  JsonFeed,
  SearchPage,
  SessionIntrospection,
  StaffIdentity,
} from './types.ts';

export type LoginOutcome =
  | { type: 'signed-in'; session: StaffSession }
  | { type: 'mfa-required'; mfaChallengeToken: string; expiresAt: string; tenantId: string | null }
  | { type: 'mfa-enrollment-required'; expiresAt: string }
  | { type: 'tenant-selection-required'; principalToken: string; expiresAt: string }
  | { type: 'turnstile-required' };

export interface AwcmsApi {
  /**
   * `GET /api/v1/health`. Allowed on both profiles: awcms-one's backend is an
   * awcms instance (its `apps/cms`), so the health route exists there too.
   */
  health(): Promise<HealthStatus>;
  login(input: {
    loginIdentifier: string;
    password: string;
    tenantId?: string | null;
    turnstileToken?: string;
  }): Promise<LoginOutcome>;
  selectTenant(input: { principalToken: string; tenantId: string }): Promise<LoginOutcome>;
  verifyTotp(input: {
    mfaChallengeToken: string;
    tenantId: string | null;
    code?: string;
    recoveryCode?: string;
  }): Promise<LoginOutcome>;
  me(): Promise<StaffIdentity>;
  session(): Promise<SessionIntrospection>;
  logout(): Promise<void>;
  siteSearch(input: {
    q: string;
    type?: string;
    locale?: 'en' | 'id';
    cursor?: string | null;
  }): Promise<SearchPage>;
  feed(input?: { locale?: 'en' | 'id' }): Promise<JsonFeed>;
  listPosts(input?: {
    cursor?: string | null;
    limit?: number;
  }): Promise<{ posts: BlogPostSummary[]; nextCursor: string | null }>;
  registerPush(input: {
    transport: 'fcm' | 'web_push';
    endpoint: string;
    keys?: { p256dh: string; auth: string };
  }): Promise<unknown>;
  listPush(): Promise<unknown>;
  deletePush(id: string): Promise<void>;
}

/** Backend limit on `site-search/query?q=`. */
export const SEARCH_QUERY_MAX_LENGTH = 128;

interface Deps {
  config: ClientConfig;
  http: HttpClient;
  sessions: SessionManager;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function malformed(what: string): AwcmsApiError {
  return new AwcmsApiError({
    kind: 'envelope',
    status: 200,
    code: 'BAD_ENVELOPE',
    message: `Response is missing ${what}`,
  });
}

export function createAwcmsApi({ config, http, sessions }: Deps): AwcmsApi {
  const now = config.now ?? Date.now;

  const assertBackend = () => {
    if (config.backend !== 'awcms') {
      throw configError(
        'WRONG_BACKEND',
        `This call needs the "awcms" backend, not "${config.backend}"`,
      );
    }
  };

  const requireSession = async (): Promise<StaffSession> => {
    const s = sessions.current();
    if (s?.kind !== 'staff') throw configError('NOT_SIGNED_IN', 'No staff session');
    const expiry = Date.parse(s.expiresAt);
    if (Number.isNaN(expiry) || expiry <= now()) {
      await sessions.clear();
      throw configError('NOT_SIGNED_IN', 'The staff session has expired');
    }
    return s;
  };

  /** Authenticated call: staff bearer + tenant header; clears the session on 401. */
  async function authed<T>(options: Omit<RequestOptions, 'bearer' | 'tenantId'>): Promise<T> {
    assertBackend();
    const s = await requireSession();
    try {
      return await http.request<T>({ ...options, bearer: s.token, tenantId: s.tenantId });
    } catch (e) {
      if (isApiError(e) && e.status === 401) {
        // Only clear if nobody signed in again while the request was in flight.
        const latest = sessions.current();
        if (latest?.kind === 'staff' && latest.token === s.token) await sessions.clear();
      }
      throw e;
    }
  }

  async function anonymous<T>(options: RequestOptions): Promise<T> {
    assertBackend();
    return http.request<T>(options);
  }

  /** Turns the documented branching errors into outcomes; rethrows everything else. */
  const outcomeFromError = (e: unknown, tenantId: string | null): LoginOutcome => {
    if (!isApiError(e)) throw e;
    const details = isRecord(e.details) ? e.details : {};
    const expiresAt = asString(details.expiresAt);
    switch (e.code) {
      case 'MEMBERSHIP_SELECTION_REQUIRED': {
        const principalToken = asString(details.principalToken);
        if (principalToken && expiresAt) {
          return { type: 'tenant-selection-required', principalToken, expiresAt };
        }
        break;
      }
      case 'MFA_REQUIRED': {
        const mfaChallengeToken = asString(details.mfaChallengeToken);
        if (mfaChallengeToken && expiresAt) {
          return { type: 'mfa-required', mfaChallengeToken, expiresAt, tenantId };
        }
        break;
      }
      case 'MFA_ENROLLMENT_REQUIRED':
        if (expiresAt) return { type: 'mfa-enrollment-required', expiresAt };
        break;
      case 'TURNSTILE_REQUIRED':
      case 'TURNSTILE_INVALID':
        return { type: 'turnstile-required' };
      default:
        break;
    }
    throw e;
  };

  /**
   * Turns a token response into a saved session. The tenant comes from, in
   * order: the response, the header we sent, then `GET auth/session`
   * (single-membership login without a configured tenant).
   */
  const completeSignIn = async (
    data: unknown,
    tenantUsed: string | null,
    forceLevel: 'aal2' | null,
  ): Promise<LoginOutcome> => {
    if (!isRecord(data)) throw malformed('the session payload');
    const token = asString(data.token);
    const expiresAt = asString(data.expiresAt);
    if (!token || !expiresAt) throw malformed('token / expiresAt');
    let tenantId = asString(data.tenantId) ?? tenantUsed;
    if (!tenantId) {
      const introspection = await http.request<SessionIntrospection>({
        method: 'GET',
        path: `${API_PREFIX}/auth/session`,
        bearer: token,
      });
      tenantId = asString(introspection?.tenantId);
    }
    if (!tenantId) throw malformed('the tenant id');
    const session: StaffSession = {
      kind: 'staff',
      token,
      expiresAt,
      tenantId,
      assuranceLevel: forceLevel ?? (data.assuranceLevel === 'aal2' ? 'aal2' : 'aal1'),
    };
    await sessions.save(session);
    return { type: 'signed-in', session };
  };

  return {
    health: () => http.request<HealthStatus>({ method: 'GET', path: `${API_PREFIX}/health` }),

    async login(input) {
      assertBackend();
      const tenantId = input.tenantId ?? config.tenantId ?? null;
      const body: Record<string, unknown> = {
        loginIdentifier: input.loginIdentifier,
        password: input.password,
      };
      if (input.turnstileToken) body.turnstileToken = input.turnstileToken;
      try {
        const data = await http.request<unknown>({
          method: 'POST',
          path: `${API_PREFIX}/auth/login`,
          body,
          tenantId,
        });
        return await completeSignIn(data, tenantId, null);
      } catch (e) {
        return outcomeFromError(e, tenantId);
      }
    },

    async selectTenant(input) {
      assertBackend();
      try {
        const data = await http.request<unknown>({
          method: 'POST',
          path: `${API_PREFIX}/auth/session/tenant`,
          body: { principalToken: input.principalToken, tenantId: input.tenantId },
        });
        return await completeSignIn(data, input.tenantId, null);
      } catch (e) {
        return outcomeFromError(e, input.tenantId);
      }
    },

    async verifyTotp(input) {
      assertBackend();
      if (!input.code && !input.recoveryCode) {
        throw configError('MFA_CODE_REQUIRED', 'Provide a TOTP code or a recovery code');
      }
      const tenantId = input.tenantId ?? config.tenantId ?? null;
      const body: Record<string, unknown> = { mfaChallengeToken: input.mfaChallengeToken };
      if (input.code) body.code = input.code;
      else body.recoveryCode = input.recoveryCode;
      const data = await http.request<unknown>({
        method: 'POST',
        path: `${API_PREFIX}/auth/mfa/totp/verify`,
        body,
        tenantId,
      });
      return completeSignIn(data, tenantId, 'aal2');
    },

    me: () => authed<StaffIdentity>({ method: 'GET', path: `${API_PREFIX}/auth/me` }),
    session: () =>
      authed<SessionIntrospection>({ method: 'GET', path: `${API_PREFIX}/auth/session` }),

    async logout() {
      assertBackend();
      const s = sessions.current();
      try {
        if (s?.kind === 'staff') {
          await http.request<void>({
            method: 'POST',
            path: `${API_PREFIX}/auth/logout`,
            bearer: s.token,
            tenantId: s.tenantId,
          });
        }
      } catch {
        // Revocation is best-effort: the token also dies on its own at expiresAt.
      } finally {
        await sessions.clear();
      }
    },

    async siteSearch(input) {
      const q = input.q.trim();
      if (q === '') throw configError('SEARCH_QUERY_INVALID', 'Search query is empty');
      if (q.length > SEARCH_QUERY_MAX_LENGTH) {
        throw configError(
          'SEARCH_QUERY_INVALID',
          `Search query is longer than ${SEARCH_QUERY_MAX_LENGTH} characters`,
        );
      }
      // Anonymous: the server resolves the tenant from Host, so no tenant header.
      const data = await anonymous<Partial<SearchPage> | undefined>({
        method: 'GET',
        path: `${API_PREFIX}/site-search/query`,
        query: {
          q,
          type: input.type,
          locale: input.locale ?? config.locale,
          cursor: input.cursor,
        },
      });
      if (!isRecord(data)) throw malformed('the search payload');
      return {
        items: Array.isArray(data.items) ? data.items : [],
        nextCursor: data.nextCursor ?? null,
        facets: data.facets ?? null,
        query: data.query ?? q,
        locale: data.locale ?? input.locale ?? config.locale,
      };
    },

    async feed(input) {
      const feed = await anonymous<JsonFeed | undefined>({
        method: 'GET',
        path: '/feed.json',
        query: { locale: input?.locale ?? config.locale },
        envelope: false,
      });
      if (!isRecord(feed) || !Array.isArray(feed.items)) throw malformed('feed items');
      return feed;
    },

    async listPosts(input) {
      const query: Record<string, QueryValue> = {
        status: 'published',
        order: 'created_at',
        limit: input?.limit,
        cursor: input?.cursor,
      };
      const data = await authed<
        { posts?: BlogPostSummary[]; nextCursor?: string | null } | undefined
      >({
        method: 'GET',
        path: `${API_PREFIX}/blog/posts`,
        query,
      });
      if (!isRecord(data)) throw malformed('the posts payload');
      return {
        posts: Array.isArray(data.posts) ? data.posts : [],
        nextCursor: data.nextCursor ?? null,
      };
    },

    async registerPush(input) {
      if (input.transport === 'web_push' && !input.keys) {
        throw configError('PUSH_KEYS_REQUIRED', 'web_push subscriptions need p256dh/auth keys');
      }
      if (input.transport === 'fcm' && input.keys) {
        throw configError('PUSH_KEYS_FORBIDDEN', 'fcm subscriptions must not carry keys');
      }
      const body: Record<string, unknown> = {
        transport: input.transport,
        endpoint: input.endpoint,
      };
      if (input.keys) body.keys = input.keys;
      const data = await authed<unknown>({
        method: 'POST',
        path: `${API_PREFIX}/push/subscriptions`,
        body,
      });
      return isRecord(data) && 'subscription' in data ? data.subscription : data;
    },

    listPush: () => authed<unknown>({ method: 'GET', path: `${API_PREFIX}/push/subscriptions` }),

    async deletePush(id) {
      await authed<void>({
        method: 'DELETE',
        path: `${API_PREFIX}/push/subscriptions/${encodeURIComponent(id)}`,
      });
    },
  };
}
