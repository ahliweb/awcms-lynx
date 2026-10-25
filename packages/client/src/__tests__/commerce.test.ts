import { describe, expect, test } from 'bun:test';
import { createAwcmsClient } from '../client.ts';
import { isApiError } from '../errors.ts';
import type { Session } from '../session.ts';
import {
  ACCOUNT,
  awcmsConfig,
  commerceConfig,
  fail,
  fakeFetch,
  json,
  MemoryStore,
  ok,
  TENANT,
} from './testkit.ts';

const BASE = 'https://api.shop.example.id/api/v1/commerce/storefront';
const customer: Session = {
  kind: 'customer',
  token: 'cs_tok',
  expiresAt: '2026-01-01T00:00:00Z',
  account: ACCOUNT,
};

function setup(handler: Parameters<typeof fakeFetch>[0], over = {}) {
  const f = fakeFetch(handler);
  const store = new MemoryStore();
  const client = createAwcmsClient(commerceConfig({ fetch: f.fetch, ...over }), store);
  return { client, calls: f.calls, store };
}

describe('OTP sign-in', () => {
  test('requestOtp posts the neutral body; no tenant header, no bearer', async () => {
    const { client, calls } = setup(() => ok({ sent: true, expiresInSeconds: 600 }));
    const result = await client.commerce.requestOtp({
      email: 'a@b.id',
      purpose: 'register',
      name: 'Ani',
      phone: '0812',
      via: 'whatsapp',
    });
    expect(result).toEqual({ sent: true, expiresInSeconds: 600 });
    expect(calls[0]?.url).toBe(`${BASE}/account/otp/request`);
    expect(calls[0]?.body).toEqual({
      email: 'a@b.id',
      purpose: 'register',
      name: 'Ani',
      phone: '0812',
      via: 'whatsapp',
    });
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBeUndefined();
  });

  test('requestOtp accepts 202 and 200 alike', async () => {
    for (const status of [200, 202]) {
      const { client } = setup(() => ok({ sent: true, expiresInSeconds: 600 }, status));
      expect(await client.commerce.requestOtp({ email: 'a@b.id', purpose: 'login' })).toMatchObject(
        { sent: true },
      );
    }
  });

  test('requestOtp surfaces validation details and rate limiting', async () => {
    const v = setup(() =>
      fail(400, 'VALIDATION_ERROR', 'bad', [{ field: 'name', message: 'too short' }]),
    );
    const error = await v.client.commerce
      .requestOtp({ email: 'a@b.id', purpose: 'register' })
      .catch((e) => e);
    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'name', message: 'too short' }],
    });
    const r = setup(() => fail(429, 'RATE_LIMITED', 'slow', undefined, { 'Retry-After': '60' }));
    expect(
      await r.client.commerce.requestOtp({ email: 'a@b.id', purpose: 'login' }).catch((e) => e),
    ).toMatchObject({ retryAfterSeconds: 60 });
  });

  test('verifyOtp saves a customer session and returns it', async () => {
    const { client, calls, store } = setup(() =>
      ok({ token: 'cs_new', expiresAt: '2026-07-01T00:00:00Z', account: ACCOUNT }),
    );
    const session = await client.commerce.verifyOtp({
      email: 'siti@example.id',
      code: '123456',
      purpose: 'login',
    });
    expect(session).toMatchObject({ kind: 'customer', token: 'cs_new', account: { id: 'acc-1' } });
    expect(calls[0]?.body).toEqual({ email: 'siti@example.id', code: '123456', purpose: 'login' });
    expect(client.sessions.current()).toEqual(session);
    expect(store.data.get('awcms-lynx:session')).toContain('cs_new');
  });

  test('verifyOtp by phone sends phone, not email', async () => {
    const { client, calls } = setup(() => ok({ token: 'cs_n', expiresAt: 'x', account: ACCOUNT }));
    await client.commerce.verifyOtp({ phone: '0812', code: '000000', purpose: 'login' });
    expect(calls[0]?.body).toEqual({ phone: '0812', code: '000000', purpose: 'login' });
  });

  test('verifyOtp validates target and code before fetching', async () => {
    const { client, calls } = setup(() => ok({}));
    expect(
      await client.commerce
        .verifyOtp({ email: 'a@b.id', phone: '1', code: '123456', purpose: 'login' })
        .catch((e) => e),
    ).toMatchObject({ code: 'OTP_TARGET_INVALID' });
    expect(
      await client.commerce.verifyOtp({ code: '123456', purpose: 'login' }).catch((e) => e),
    ).toMatchObject({ code: 'OTP_TARGET_INVALID' });
    expect(
      await client.commerce
        .verifyOtp({ email: 'a@b.id', code: '12345', purpose: 'login' })
        .catch((e) => e),
    ).toMatchObject({ code: 'OTP_CODE_INVALID' });
    expect(calls).toHaveLength(0);
  });

  test('verifyOtp errors do not save a session', async () => {
    for (const [status, code] of [
      [401, 'OTP_INVALID'],
      [404, 'ACCOUNT_NOT_FOUND'],
      [409, 'PHONE_ALREADY_REGISTERED'],
      [403, 'ACCOUNT_BLOCKED'],
    ] as const) {
      const { client } = setup(() => fail(status, code));
      const error = await client.commerce
        .verifyOtp({ email: 'a@b.id', code: '123456', purpose: 'login' })
        .catch((e) => e);
      expect(isApiError(error, code)).toBe(true);
      expect(client.sessions.current()).toBeNull();
    }
  });

  test('verifyOtp rejects a response without token/account', async () => {
    const { client } = setup(() => ok({ token: 'cs_x' }));
    expect(
      await client.commerce
        .verifyOtp({ email: 'a@b.id', code: '123456', purpose: 'login' })
        .catch((e) => e),
    ).toMatchObject({ code: 'BAD_ENVELOPE' });
  });
});

describe('account', () => {
  test('me sends the customer bearer and never a tenant header', async () => {
    const { client, calls } = setup(() => ok({ account: { ...ACCOUNT, name: 'Siti B' } }));
    await client.sessions.save(customer);
    const account = await client.commerce.me();
    expect(account.name).toBe('Siti B');
    expect(calls[0]?.url).toBe(`${BASE}/account/me`);
    expect(calls[0]?.headers.Authorization).toBe('Bearer cs_tok');
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBeUndefined();
    // stored account refreshed, token and expiresAt untouched
    expect(client.sessions.current()).toMatchObject({
      token: 'cs_tok',
      expiresAt: '2026-01-01T00:00:00Z',
      account: { name: 'Siti B' },
    });
  });

  test('a stale customer expiresAt is never used to refuse a request', async () => {
    const { client, calls } = setup(() => ok({ account: ACCOUNT }), {
      now: () => Date.parse('2030-01-01T00:00:00Z'),
    });
    await client.sessions.save(customer);
    await client.commerce.me();
    expect(calls).toHaveLength(1);
  });

  test('NOT_SIGNED_IN without a customer session', async () => {
    const { client, calls } = setup(() => ok({}));
    expect(await client.commerce.me().catch((e) => e)).toMatchObject({
      kind: 'config',
      code: 'NOT_SIGNED_IN',
    });
    expect(calls).toHaveLength(0);
  });

  test('updateMe PATCHes only provided fields', async () => {
    const { client, calls } = setup(() => ok({ account: { ...ACCOUNT, marketingConsent: true } }));
    await client.sessions.save(customer);
    const account = await client.commerce.updateMe({ marketingConsent: true });
    expect(account.marketingConsent).toBe(true);
    expect(calls[0]).toMatchObject({ method: 'PATCH', body: { marketingConsent: true } });
  });

  test('401 UNAUTHENTICATED clears the customer session', async () => {
    const { client, store } = setup(() => fail(401, 'UNAUTHENTICATED'));
    await client.sessions.save(customer);
    expect(isApiError(await client.commerce.me().catch((e) => e), 'UNAUTHENTICATED')).toBe(true);
    expect(client.sessions.current()).toBeNull();
    expect(store.data.size).toBe(0);
  });

  test('403 ACCOUNT_BLOCKED keeps the session', async () => {
    const { client } = setup(() => fail(403, 'ACCOUNT_BLOCKED'));
    await client.sessions.save(customer);
    await client.commerce.me().catch(() => {});
    expect(client.sessions.current()).not.toBeNull();
  });

  test('logout handles 204 and clears even on server failure', async () => {
    const ok204 = setup(() => new Response(null, { status: 204 }));
    await ok204.client.sessions.save(customer);
    await ok204.client.commerce.logout();
    expect(ok204.calls[0]).toMatchObject({ method: 'POST', url: `${BASE}/account/logout` });
    expect(ok204.client.sessions.current()).toBeNull();

    const broken = setup(() => fail(500, 'INTERNAL'));
    await broken.client.sessions.save(customer);
    await broken.client.commerce.logout();
    expect(broken.client.sessions.current()).toBeNull();
  });
});

describe('orders', () => {
  test('orders pages with cursor', async () => {
    const { client, calls } = setup(() =>
      ok({
        items: [{ code: 'A1', status: 'paid', total: '10000.00', createdAt: 'x' }],
        nextCursor: 'n2',
      }),
    );
    await client.sessions.save(customer);
    const page = await client.commerce.orders({ cursor: 'n1' });
    expect(page.nextCursor).toBe('n2');
    expect(page.items[0]?.code).toBe('A1');
    expect(calls[0]?.url).toBe(`${BASE}/account/orders?cursor=n1`);
  });

  test('order accepts both data.order and data as the order; encodes the code', async () => {
    const order = { code: 'A/1', status: 'paid', total: '1.00', createdAt: 'x' };
    for (const payload of [{ order }, order]) {
      const { client, calls } = setup(() => ok(payload));
      await client.sessions.save(customer);
      expect(await client.commerce.order('A/1')).toMatchObject({ code: 'A/1' });
      expect(calls[0]?.url).toBe(`${BASE}/account/orders/A%2F1`);
    }
  });

  test('order without a code is BAD_ENVELOPE', async () => {
    const { client } = setup(() => ok({ nothing: true }));
    await client.sessions.save(customer);
    expect(await client.commerce.order('X').catch((e) => e)).toMatchObject({
      code: 'BAD_ENVELOPE',
    });
  });

  test('trackOrder is anonymous, passes phone, accepts both shapes', async () => {
    const order = { code: 'A1', status: 'new', total: '5.00', createdAt: 'x' };
    const { client, calls } = setup(() => ok({ order }));
    await client.sessions.save(customer);
    expect(await client.commerce.trackOrder('A1', '+62 812')).toMatchObject({ code: 'A1' });
    expect(calls[0]?.url).toBe(`${BASE}/orders/A1?phone=%2B62%20812`);
    expect(calls[0]?.headers.Authorization).toBeUndefined();
  });
});

describe('catalog index', () => {
  const product = {
    id: 'p1',
    slug: 'kopi',
    name: 'Kopi',
    sku: 'K1',
    categorySlug: 'minuman',
    categoryName: 'Minuman',
    price: '10000.00',
    finalPrice: '9000.00',
    image: { url: 'https://cdn.example.id/kopi.webp', alt: 'Kopi' },
    label: null,
    labelColor: null,
    rating: '4.50',
    sold: 3,
    stock: 9,
    inFlashSale: false,
  };

  test('productIndex reads the storefront static index (raw array), without auth/tenant/origin', async () => {
    const { client, calls } = setup(() => json(200, [product]), {
      originHeader: 'https://shop.example.id',
    });
    await client.sessions.save(customer);
    expect(await client.commerce.productIndex()).toEqual([product]);
    expect(calls[0]?.url).toBe('https://shop.example.id/index/produk.json');
    expect(calls[0]?.headers.Authorization).toBeUndefined();
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBeUndefined();
    expect(calls[0]?.headers.Origin).toBeUndefined();
  });

  test('tolerates { items: [...] }', async () => {
    const { client } = setup(() => json(200, { items: [product] }));
    expect(await client.commerce.productIndex()).toEqual([product]);
  });

  test('newsIndex reads berita.json', async () => {
    const news = { slug: 's', title: 't', excerpt: 'e', rubrik: 'r', region: 'g', date: 'd' };
    const { client, calls } = setup(() => json(200, [news]));
    expect(await client.commerce.newsIndex()).toEqual([news]);
    expect(calls[0]?.url).toBe('https://shop.example.id/index/berita.json');
  });

  test('null storefrontOrigin is a typed configuration error, with no request', async () => {
    const { client, calls } = setup(() => json(200, []), { storefrontOrigin: null });
    for (const call of [() => client.commerce.productIndex(), () => client.commerce.newsIndex()]) {
      expect(await call().catch((e: unknown) => e)).toMatchObject({
        kind: 'config',
        code: 'STOREFRONT_NOT_CONFIGURED',
      });
    }
    expect(calls).toHaveLength(0);
  });

  test('an unexpected index shape is BAD_ENVELOPE', async () => {
    const { client } = setup(() => json(200, { nope: true }));
    expect(await client.commerce.productIndex().catch((e) => e)).toMatchObject({
      code: 'BAD_ENVELOPE',
    });
  });

  test('a missing index file surfaces as an HTTP error', async () => {
    const { client } = setup(() => new Response('Not Found', { status: 404 }));
    expect(await client.commerce.productIndex().catch((e) => e)).toMatchObject({
      kind: 'http',
      status: 404,
    });
  });
});

describe('checkout', () => {
  test('quoteCart is anonymous and posts the lines', async () => {
    const quote = { canCheckout: true, lines: [], total: '20000.00' };
    const { client, calls } = setup(() => ok(quote));
    await client.sessions.save(customer);
    const input = {
      lines: [{ productId: 'p1', quantity: 2 }],
      destination: { districtCode: '3174010' },
    };
    expect(await client.commerce.quoteCart(input)).toEqual(quote);
    expect(calls[0]?.url).toBe(`${BASE}/cart/quote`);
    expect(calls[0]?.body).toEqual(input);
    expect(calls[0]?.headers.Authorization).toBeUndefined();
  });

  test('createOrder generates a UUID idempotency key (body + header) when absent', async () => {
    const { client, calls } = setup(() =>
      ok({ order: { code: 'A1', status: 'new', total: '1.00', createdAt: 'x' } }, 201),
    );
    const order = await client.commerce.createOrder({ lines: [{ productId: 'p1', quantity: 1 }] });
    expect(order.code).toBe('A1');
    const key = (calls[0]?.body as { idempotencyKey: string } | undefined)?.idempotencyKey ?? '';
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(calls[0]?.headers['Idempotency-Key']).toBe(key);
    expect(calls[0]?.url).toBe(`${BASE}/orders`);
  });

  test('createOrder keeps a supplied key, passes extra fields, and attaches the customer bearer when signed in', async () => {
    const { client, calls } = setup(() =>
      ok({ code: 'A1', status: 'new', total: '1.00', createdAt: 'x' }, 200),
    );
    await client.sessions.save(customer);
    await client.commerce.createOrder({
      lines: [],
      idempotencyKey: 'cart-42',
      contact: { phone: '0812' },
    });
    expect(calls[0]?.body).toMatchObject({ idempotencyKey: 'cart-42', contact: { phone: '0812' } });
    expect(calls[0]?.headers.Authorization).toBe('Bearer cs_tok');
    expect(calls[0]?.headers['X-AWCMS-Tenant-ID']).toBeUndefined();
  });

  test('createOrder rejects an invalid key before fetching', async () => {
    const { client, calls } = setup(() => ok({}));
    for (const bad of ['', 'has space', 'é']) {
      expect(
        await client.commerce.createOrder({ lines: [], idempotencyKey: bad }).catch((e) => e),
      ).toMatchObject({ kind: 'config', code: 'IDEMPOTENCY_KEY_INVALID' });
    }
    expect(calls).toHaveLength(0);
  });

  test('replay (200) and first (201) both succeed; 409 CART_CHANGED exposes details.quote', async () => {
    const order = { order: { code: 'A1', status: 'new', total: '1.00', createdAt: 'x' } };
    for (const status of [200, 201]) {
      const { client } = setup(() => ok(order, status));
      expect((await client.commerce.createOrder({ lines: [] })).code).toBe('A1');
    }
    const { client } = setup(() =>
      fail(409, 'CART_CHANGED', 'changed', { quote: { canCheckout: true, lines: [] } }),
    );
    const error = await client.commerce.createOrder({ lines: [] }).catch((e) => e);
    expect(isApiError(error, 'CART_CHANGED')).toBe(true);
    expect(error.details).toEqual({ quote: { canCheckout: true, lines: [] } });
  });

  test('a stale bearer on createOrder that gets 401 clears the session', async () => {
    const { client } = setup(() => fail(401, 'UNAUTHENTICATED'));
    await client.sessions.save(customer);
    await client.commerce.createOrder({ lines: [] }).catch(() => {});
    expect(client.sessions.current()).toBeNull();
  });
});

describe('originHeader and backend guard', () => {
  test('originHeader is sent on commerce API calls', async () => {
    const { client, calls } = setup(() => ok({ sent: true, expiresInSeconds: 600 }), {
      originHeader: 'https://shop.example.id',
    });
    await client.commerce.requestOtp({ email: 'a@b.id', purpose: 'login' });
    expect(calls[0]?.headers.Origin).toBe('https://shop.example.id');
  });

  test('commerce never sends a tenant header even when config.tenantId is set', async () => {
    const { client, calls } = setup(() => ok({ account: ACCOUNT }), { tenantId: TENANT });
    await client.sessions.save(customer);
    await client.commerce.me();
    await client.commerce.requestOtp({ email: 'a@b.id', purpose: 'login' });
    for (const c of calls) expect(c.headers['X-AWCMS-Tenant-ID']).toBeUndefined();
  });

  test('commerce methods throw WRONG_BACKEND on an awcms client', async () => {
    const f = fakeFetch(() => ok({}));
    const client = createAwcmsClient(awcmsConfig({ fetch: f.fetch }), new MemoryStore());
    await client.sessions.save(customer);
    for (const call of [
      () => client.commerce.me(),
      () => client.commerce.requestOtp({ email: 'a@b.id', purpose: 'login' }),
      () => client.commerce.verifyOtp({ email: 'a@b.id', code: '123456', purpose: 'login' }),
      () => client.commerce.productIndex(),
      () => client.commerce.quoteCart({ lines: [] }),
      () => client.commerce.createOrder({ lines: [] }),
      () => client.commerce.logout(),
    ]) {
      expect(await call().catch((e: unknown) => e)).toMatchObject({
        kind: 'config',
        code: 'WRONG_BACKEND',
      });
    }
    expect(f.calls).toHaveLength(0);
  });
});
