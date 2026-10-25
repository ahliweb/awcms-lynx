import { describe, expect, test } from 'bun:test';
import { createAwcmsClient } from '../client.ts';
import { isApiError } from '../errors.ts';
import type { Session } from '../session.ts';
import {
  awcmsConfig,
  commerceConfig,
  fail,
  fakeFetch,
  json,
  MemoryStore,
  ok,
  TENANT,
  TENANT_B,
} from './testkit.ts';

const FUTURE = '2099-01-01T00:00:00Z';

function setup(handler: Parameters<typeof fakeFetch>[0], over = {}) {
  const f = fakeFetch(handler);
  const store = new MemoryStore();
  const client = createAwcmsClient(awcmsConfig({ fetch: f.fetch, ...over }), store);
  return { client, calls: f.calls, store };
}

const staffSession: Session = {
  kind: 'staff',
  token: 'staff-tok',
  expiresAt: FUTURE,
  tenantId: TENANT,
  assuranceLevel: 'aal1',
};

describe('login outcomes', () => {
  test('signed-in: sends tenant header + body, saves the session', async () => {
    const { client, calls, store } = setup(() => ok({ token: 'tok', expiresAt: FUTURE }));
    const outcome = await client.awcms.login({ loginIdentifier: 'ani', password: 'pw' });
    expect(outcome).toEqual({
      type: 'signed-in',
      session: {
        kind: 'staff',
        token: 'tok',
        expiresAt: FUTURE,
        tenantId: TENANT,
        assuranceLevel: 'aal1',
      },
    });
    expect(calls[0]?.url).toBe('https://cms.example.id/api/v1/auth/login');
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBe(TENANT);
    expect(calls[0]?.headers.Authorization).toBeUndefined();
    expect(calls[0]?.body).toEqual({ loginIdentifier: 'ani', password: 'pw' });
    expect(client.sessions.current()?.kind).toBe('staff');
    expect(store.data.get('awcms-lynx:session')).toContain('"token":"tok"');
  });

  test('explicit tenantId beats config; turnstileToken is forwarded', async () => {
    const { client, calls } = setup(() => ok({ token: 'tok', expiresAt: FUTURE }));
    await client.awcms.login({
      loginIdentifier: 'a',
      password: 'b',
      tenantId: TENANT_B,
      turnstileToken: 'ts',
    });
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBe(TENANT_B);
    expect(calls[0]?.body).toMatchObject({ turnstileToken: 'ts' });
    expect(client.sessions.current()).toMatchObject({ tenantId: TENANT_B });
  });

  test('no tenant configured: header omitted and tenant taken from the response', async () => {
    const { client, calls } = setup(
      () => ok({ token: 'tok', expiresAt: FUTURE, tenantId: TENANT_B }),
      {
        tenantId: null,
      },
    );
    const outcome = await client.awcms.login({ loginIdentifier: 'a', password: 'b' });
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBeUndefined();
    expect(outcome).toMatchObject({ type: 'signed-in', session: { tenantId: TENANT_B } });
  });

  test('no tenant anywhere: falls back to GET auth/session for the tenant', async () => {
    const { client, calls } = setup(
      (req) =>
        req.url.endsWith('/auth/login')
          ? ok({ token: 'tok', expiresAt: FUTURE })
          : ok({ tenantId: TENANT_B, roles: [], scopes: [] }),
      { tenantId: null },
    );
    const outcome = await client.awcms.login({ loginIdentifier: 'a', password: 'b' });
    expect(outcome).toMatchObject({ type: 'signed-in', session: { tenantId: TENANT_B } });
    expect(calls[1]?.headers.Authorization).toBe('Bearer tok');
  });

  test('membership selection required, then selectTenant signs in', async () => {
    const { client, calls } = setup(
      (req) =>
        req.url.endsWith('/auth/login')
          ? fail(409, 'MEMBERSHIP_SELECTION_REQUIRED', 'pick', {
              principalToken: 'pt',
              expiresAt: FUTURE,
            })
          : ok({ token: 'tok2', expiresAt: FUTURE, tenantId: TENANT_B }),
      { tenantId: null },
    );
    const first = await client.awcms.login({ loginIdentifier: 'a', password: 'b' });
    expect(first).toEqual({
      type: 'tenant-selection-required',
      principalToken: 'pt',
      expiresAt: FUTURE,
    });
    expect(client.sessions.current()).toBeNull();
    const second = await client.awcms.selectTenant({ principalToken: 'pt', tenantId: TENANT_B });
    expect(second).toMatchObject({
      type: 'signed-in',
      session: { token: 'tok2', tenantId: TENANT_B },
    });
    expect(calls[1]?.url).toBe('https://cms.example.id/api/v1/auth/session/tenant');
    expect(calls[1]?.body).toEqual({ principalToken: 'pt', tenantId: TENANT_B });
  });

  test('MFA required, then verifyTotp yields an aal2 session', async () => {
    const { client, calls } = setup((req) =>
      req.url.endsWith('/auth/login')
        ? fail(401, 'MFA_REQUIRED', 'mfa', { mfaChallengeToken: 'mc', expiresAt: FUTURE })
        : ok({ token: 'tok-aal2', expiresAt: FUTURE, assuranceLevel: 'aal2' }),
    );
    const first = await client.awcms.login({ loginIdentifier: 'a', password: 'b' });
    expect(first).toEqual({
      type: 'mfa-required',
      mfaChallengeToken: 'mc',
      expiresAt: FUTURE,
      tenantId: TENANT,
    });
    expect(client.sessions.current()).toBeNull();
    const second = await client.awcms.verifyTotp({
      mfaChallengeToken: 'mc',
      tenantId: TENANT,
      code: '123456',
    });
    expect(second).toMatchObject({
      type: 'signed-in',
      session: { assuranceLevel: 'aal2', tenantId: TENANT },
    });
    expect(calls[1]?.url).toBe('https://cms.example.id/api/v1/auth/mfa/totp/verify');
    expect(calls[1]?.body).toEqual({ mfaChallengeToken: 'mc', code: '123456' });
    expect(calls[1]?.headers['X-AWCMS-Tenant-ID']).toBe(TENANT);
    expect(client.sessions.current()).toMatchObject({ kind: 'staff', assuranceLevel: 'aal2' });
  });

  test('verifyTotp with a recovery code; requires one of the two', async () => {
    const { client, calls } = setup(() => ok({ token: 't', expiresAt: FUTURE }));
    await client.awcms.verifyTotp({
      mfaChallengeToken: 'mc',
      tenantId: TENANT,
      recoveryCode: 'rc-1',
    });
    expect(calls[0]?.body).toEqual({ mfaChallengeToken: 'mc', recoveryCode: 'rc-1' });
    expect(client.sessions.current()).toMatchObject({ assuranceLevel: 'aal2' });
    const error = await client.awcms
      .verifyTotp({ mfaChallengeToken: 'mc', tenantId: TENANT })
      .catch((e) => e);
    expect(error).toMatchObject({ kind: 'config', code: 'MFA_CODE_REQUIRED' });
    expect(calls).toHaveLength(1);
  });

  test('wrong TOTP code surfaces as an error and saves nothing', async () => {
    const { client } = setup(() => fail(401, 'MFA_INVALID_CODE'));
    const error = await client.awcms
      .verifyTotp({ mfaChallengeToken: 'mc', tenantId: TENANT, code: '000000' })
      .catch((e) => e);
    expect(isApiError(error, 'MFA_INVALID_CODE')).toBe(true);
    expect(client.sessions.current()).toBeNull();
  });

  test('MFA enrolment required', async () => {
    const { client } = setup(() =>
      fail(401, 'MFA_ENROLLMENT_REQUIRED', 'enrol', {
        mfaEnrollmentToken: 'me',
        expiresAt: FUTURE,
      }),
    );
    expect(await client.awcms.login({ loginIdentifier: 'a', password: 'b' })).toEqual({
      type: 'mfa-enrollment-required',
      expiresAt: FUTURE,
    });
    expect(client.sessions.current()).toBeNull();
  });

  test('Turnstile outcomes', async () => {
    for (const code of ['TURNSTILE_REQUIRED', 'TURNSTILE_INVALID']) {
      const { client } = setup(() => fail(400, code));
      expect(await client.awcms.login({ loginIdentifier: 'a', password: 'b' })).toEqual({
        type: 'turnstile-required',
      });
    }
  });

  test('other login failures are thrown with their code and Retry-After', async () => {
    const bad = setup(() => fail(401, 'INVALID_CREDENTIALS'));
    expect(
      await bad.client.awcms.login({ loginIdentifier: 'a', password: 'b' }).catch((e) => e),
    ).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
    });
    const limited = setup(() =>
      fail(429, 'RATE_LIMITED', 'slow', undefined, { 'Retry-After': '30' }),
    );
    expect(
      await limited.client.awcms.login({ loginIdentifier: 'a', password: 'b' }).catch((e) => e),
    ).toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 30,
    });
  });

  test('a failed login does not clear an existing session', async () => {
    const { client } = setup(() => fail(401, 'INVALID_CREDENTIALS'));
    await client.sessions.save(staffSession);
    await client.awcms.login({ loginIdentifier: 'a', password: 'b' }).catch(() => {});
    expect(client.sessions.current()).toEqual(staffSession);
  });

  test('malformed MFA details are an error, not a silent outcome', async () => {
    const { client } = setup(() => fail(401, 'MFA_REQUIRED', 'mfa', {}));
    expect(
      await client.awcms.login({ loginIdentifier: 'a', password: 'b' }).catch((e) => e),
    ).toMatchObject({
      code: 'MFA_REQUIRED',
    });
  });

  test('a 200 without a token is BAD_ENVELOPE', async () => {
    const { client } = setup(() => ok({}));
    expect(
      await client.awcms.login({ loginIdentifier: 'a', password: 'b' }).catch((e) => e),
    ).toMatchObject({
      kind: 'envelope',
    });
  });
});

describe('authenticated calls', () => {
  test('use the stored token and tenant; me and session', async () => {
    const { client, calls } = setup(() => ok({ identityId: 'i1' }));
    await client.sessions.save(staffSession);
    await client.awcms.me();
    await client.awcms.session();
    expect(calls[0]?.url).toBe('https://cms.example.id/api/v1/auth/me');
    expect(calls[1]?.url).toBe('https://cms.example.id/api/v1/auth/session');
    for (const c of calls) {
      expect(c.headers.Authorization).toBe('Bearer staff-tok');
      expect(c.headers['X-AWCMS-Tenant-ID']).toBe(TENANT);
    }
  });

  test('NOT_SIGNED_IN without a session, and nothing is fetched', async () => {
    const { client, calls } = setup(() => ok({}));
    expect(await client.awcms.me().catch((e) => e)).toMatchObject({
      kind: 'config',
      code: 'NOT_SIGNED_IN',
    });
    expect(calls).toHaveLength(0);
  });

  test('NOT_SIGNED_IN when only a customer session exists', async () => {
    const { client } = setup(() => ok({}));
    await client.sessions.save({
      kind: 'customer',
      token: 'cs_1',
      expiresAt: '',
      account: {
        id: 'a',
        name: 'n',
        email: null,
        phone: null,
        level: null,
        createdAt: '',
        historyFrom: null,
        marketingConsent: false,
      },
    });
    expect(await client.awcms.me().catch((e) => e)).toMatchObject({ code: 'NOT_SIGNED_IN' });
  });

  test('an expired in-memory staff session is cleared locally without a request', async () => {
    const { client, calls } = setup(() => ok({}), {
      now: () => Date.parse('2100-01-01T00:00:00Z'),
    });
    await client.sessions.save(staffSession);
    expect(await client.awcms.me().catch((e) => e)).toMatchObject({ code: 'NOT_SIGNED_IN' });
    expect(calls).toHaveLength(0);
    expect(client.sessions.current()).toBeNull();
  });

  test('401 clears the session and rethrows', async () => {
    const { client, store } = setup(() => fail(401, 'AUTH_REQUIRED'));
    await client.sessions.save(staffSession);
    const error = await client.awcms.me().catch((e) => e);
    expect(isApiError(error, 'AUTH_REQUIRED')).toBe(true);
    expect(client.sessions.current()).toBeNull();
    expect(store.data.size).toBe(0);
  });

  test('403 does not clear the session', async () => {
    const { client } = setup(() => fail(403, 'ACCESS_DENIED'));
    await client.sessions.save(staffSession);
    await client.awcms.me().catch(() => {});
    expect(client.sessions.current()).not.toBeNull();
  });

  test('a late 401 does not clear a newer session', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const { client } = setup(async () => {
      await gate;
      return fail(401, 'AUTH_REQUIRED');
    });
    await client.sessions.save(staffSession);
    const pending = client.awcms.me().catch(() => {});
    await client.sessions.save({ ...staffSession, token: 'newer' });
    release();
    await pending;
    expect(client.sessions.current()).toMatchObject({ token: 'newer' });
  });
});

describe('logout', () => {
  test('revokes server-side and clears', async () => {
    const { client, calls } = setup(() => new Response(null, { status: 204 }));
    await client.sessions.save(staffSession);
    await client.awcms.logout();
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://cms.example.id/api/v1/auth/logout',
    });
    expect(calls[0]?.headers.Authorization).toBe('Bearer staff-tok');
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBe(TENANT);
    expect(client.sessions.current()).toBeNull();
  });

  test('clears locally even when the server returns 500 or the network fails', async () => {
    const failing = setup(() => fail(500, 'INTERNAL'));
    await failing.client.sessions.save(staffSession);
    await failing.client.awcms.logout();
    expect(failing.client.sessions.current()).toBeNull();
    expect(failing.store.data.size).toBe(0);

    const offline = setup(() => {
      throw new TypeError('offline');
    });
    await offline.client.sessions.save(staffSession);
    await offline.client.awcms.logout();
    expect(offline.client.sessions.current()).toBeNull();
  });

  test('without a session it just resolves', async () => {
    const { client, calls } = setup(() => ok({}));
    await client.awcms.logout();
    expect(calls).toHaveLength(0);
  });
});

describe('anonymous and content routes', () => {
  test('health: anonymous, no tenant header', async () => {
    const { client, calls } = setup(() =>
      ok({ status: 'ok', service: 'awcms', runtime: 'bun', moduleCount: 21, generatedAt: 'x' }),
    );
    await client.sessions.save(staffSession);
    expect((await client.awcms.health()).status).toBe('ok');
    expect(calls[0]?.headers.Authorization).toBeUndefined();
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBeUndefined();
  });

  test('siteSearch: anonymous, encodes q, defaults locale, skips empty cursor', async () => {
    const { client, calls } = setup(() =>
      ok({
        items: [
          {
            resourceType: 'post',
            resourceId: '1',
            url: '/p',
            title: 'T',
            snippet: '<mark>k</mark>',
            locale: 'id',
            rank: 1,
          },
        ],
        nextCursor: 'c2',
        facets: {},
        query: 'kopi susu',
        locale: 'id',
      }),
    );
    await client.sessions.save(staffSession);
    const page = await client.awcms.siteSearch({ q: '  kopi susu ', cursor: null });
    expect(page.nextCursor).toBe('c2');
    expect(page.items).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      'https://cms.example.id/api/v1/site-search/query?q=kopi%20susu&locale=id',
    );
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBeUndefined();
    expect(calls[0]?.headers.Authorization).toBeUndefined();
  });

  test('siteSearch passes type, locale and cursor', async () => {
    const { client, calls } = setup(() => ok({ items: [] }));
    const page = await client.awcms.siteSearch({
      q: 'a',
      type: 'post',
      locale: 'en',
      cursor: 'abc',
    });
    expect(calls[0]?.url).toContain('q=a&type=post&locale=en&cursor=abc');
    expect(page).toMatchObject({ items: [], nextCursor: null });
  });

  test('siteSearch validates q (empty, > 128) before fetching', async () => {
    const { client, calls } = setup(() => ok({ items: [] }));
    expect(await client.awcms.siteSearch({ q: '   ' }).catch((e) => e)).toMatchObject({
      code: 'SEARCH_QUERY_INVALID',
    });
    expect(await client.awcms.siteSearch({ q: 'x'.repeat(129) }).catch((e) => e)).toMatchObject({
      code: 'SEARCH_QUERY_INVALID',
    });
    await client.awcms.siteSearch({ q: 'x'.repeat(128) });
    expect(calls).toHaveLength(1);
  });

  test('feed: raw JSON (not enveloped), locale in the query', async () => {
    const feed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'Blog',
      items: [{ id: '1', url: 'u', title: 't' }],
    };
    const { client, calls } = setup(() => json(200, feed));
    expect(await client.awcms.feed({ locale: 'en' })).toEqual(feed);
    expect(calls[0]?.url).toBe('https://cms.example.id/feed.json?locale=en');
  });

  test('feed without items is BAD_ENVELOPE', async () => {
    const { client } = setup(() => json(200, { title: 'x' }));
    expect(await client.awcms.feed().catch((e) => e)).toMatchObject({ code: 'BAD_ENVELOPE' });
  });

  test('listPosts: needs session, sends published/created_at, returns posts + cursor', async () => {
    const { client, calls } = setup(() =>
      ok({ posts: [{ id: '1', title: 'T', slug: 't' }], nextCursor: null }),
    );
    expect(await client.awcms.listPosts().catch((e) => e)).toMatchObject({ code: 'NOT_SIGNED_IN' });
    await client.sessions.save(staffSession);
    const page = await client.awcms.listPosts({ limit: 10, cursor: 'c1' });
    expect(page.posts).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
    expect(calls[0]?.url).toBe(
      'https://cms.example.id/api/v1/blog/posts?status=published&order=created_at&limit=10&cursor=c1',
    );
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBe(TENANT);
  });
});

describe('push subscriptions', () => {
  test('register fcm / web_push, list, delete', async () => {
    const { client, calls } = setup((req) =>
      req.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : ok({ subscription: { id: 's1' } }, 201),
    );
    await client.sessions.save(staffSession);
    expect(await client.awcms.registerPush({ transport: 'fcm', endpoint: 'tok' })).toEqual({
      id: 's1',
    });
    expect(calls[0]?.body).toEqual({ transport: 'fcm', endpoint: 'tok' });
    await client.awcms.registerPush({
      transport: 'web_push',
      endpoint: 'https://push',
      keys: { p256dh: 'p', auth: 'a' },
    });
    expect(calls[1]?.body).toMatchObject({ keys: { p256dh: 'p', auth: 'a' } });
    await client.awcms.listPush();
    await client.awcms.deletePush('a/b');
    expect(calls[3]).toMatchObject({
      method: 'DELETE',
      url: 'https://cms.example.id/api/v1/push/subscriptions/a%2Fb',
    });
  });

  test('keys are validated per transport before fetching', async () => {
    const { client, calls } = setup(() => ok({}));
    await client.sessions.save(staffSession);
    expect(
      await client.awcms.registerPush({ transport: 'web_push', endpoint: 'e' }).catch((e) => e),
    ).toMatchObject({ code: 'PUSH_KEYS_REQUIRED' });
    expect(
      await client.awcms
        .registerPush({ transport: 'fcm', endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } })
        .catch((e) => e),
    ).toMatchObject({ code: 'PUSH_KEYS_FORBIDDEN' });
    expect(calls).toHaveLength(0);
  });
});

describe('WRONG_BACKEND', () => {
  test('health is shared by both profiles (awcms-one runs awcms as its backend)', async () => {
    const f = fakeFetch(() =>
      ok({ status: 'ok', service: 'awcms', runtime: 'bun', moduleCount: 1, generatedAt: 'x' }),
    );
    const client = createAwcmsClient(commerceConfig({ fetch: f.fetch }), new MemoryStore());
    expect((await client.awcms.health()).status).toBe('ok');
  });

  test('awcms methods throw on an awcms-one client, with no request', async () => {
    const f = fakeFetch(() => ok({}));
    const client = createAwcmsClient(commerceConfig({ fetch: f.fetch }), new MemoryStore());
    for (const call of [
      () => client.awcms.login({ loginIdentifier: 'a', password: 'b' }),
      () => client.awcms.me(),
      () => client.awcms.siteSearch({ q: 'x' }),
      () => client.awcms.feed(),
      () => client.awcms.logout(),
    ]) {
      expect(await call().catch((e: unknown) => e)).toMatchObject({
        kind: 'config',
        code: 'WRONG_BACKEND',
      });
    }
    expect(f.calls).toHaveLength(0);
  });
});
