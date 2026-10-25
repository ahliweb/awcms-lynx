import '@testing-library/jest-dom';
import { AwcmsApp, ConfigErrorScreen } from '@awcms-lynx/app';
import { createAwcmsClient } from '@awcms-lynx/client';
import {
  createMemoryHostBridge,
  type RuntimeConfig,
  resolveRuntimeConfig,
} from '@awcms-lynx/platform';
import { fireEvent, render } from '@lynx-js/react/testing-library';
import { expect, test } from '@rstest/core';

type Route = (url: string, init: RequestInit | undefined) => Response | undefined;

/** A fake `fetch` answering by URL suffix; anything unmatched is a 404 envelope. */
function fakeFetch(route: Route): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return (
      route(url, init) ??
      new Response(
        JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'x' }, meta: {} }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' },
        },
      )
    );
  }) as typeof fetch;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function setup(config: RuntimeConfig, route: Route) {
  const bridge = createMemoryHostBridge('0.1.0');
  const store = {
    data: new Map<string, string>(),
    async getItem(key: string) {
      return this.data.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      this.data.set(key, value);
    },
    async removeItem(key: string) {
      this.data.delete(key);
    },
  };
  const client = createAwcmsClient({ ...config, fetch: fakeFetch(route) }, store);
  return render(<AwcmsApp config={config} bridge={bridge} client={client} />);
}

const health = {
  success: true,
  data: {
    status: 'ok',
    service: 'awcms',
    runtime: 'bun',
    moduleCount: 21,
    generatedAt: '2026-10-25T00:00:00Z',
  },
  meta: {},
};

test('awcms-one: home lists storefront news and the catalog formats money in Rupiah', async () => {
  const config = resolveRuntimeConfig({
    backend: 'awcms-one',
    apiBaseUrl: 'https://cms.example.id',
    storefrontOrigin: 'https://toko.example.id',
    locale: 'id',
    appName: 'Toko Contoh',
  });
  const { findByText, getByText } = setup(config, (url) => {
    if (url.endsWith('/api/v1/health')) return json(health);
    if (url === 'https://toko.example.id/index/berita.json') {
      return json([
        {
          slug: 'b1',
          title: 'Pasar murah akhir pekan',
          excerpt: null,
          rubrik: null,
          region: null,
          date: '2026-10-24T08:00:00Z',
        },
      ]);
    }
    if (url === 'https://toko.example.id/index/produk.json') {
      return json([
        {
          id: 'p1',
          slug: 'kopi',
          name: 'Kopi Robusta 250 g',
          sku: 'K1',
          categorySlug: 'minuman',
          categoryName: 'Minuman',
          price: '10000.00',
          finalPrice: '9000.00',
          image: null,
          label: null,
          labelColor: null,
          rating: null,
          sold: 12,
          stock: 3,
          inFlashSale: true,
        },
      ]);
    }
    return undefined;
  });

  expect(await findByText('Pasar murah akhir pekan')).toBeInTheDocument();
  expect(await findByText(/Daring/)).toBeInTheDocument();

  fireEvent.tap(getByText('Katalog'));
  expect(await findByText('Kopi Robusta 250 g')).toBeInTheDocument();
  expect(getByText('Rp9.000')).toBeInTheDocument();
  expect(getByText('Rp10.000')).toBeInTheDocument();
  expect(getByText('Minuman · Flash sale · 12 terjual')).toBeInTheDocument();

  fireEvent.tap(getByText('Akun'));
  expect(await findByText('Kirim kode')).toBeInTheDocument();
});

test('awcms: an unreachable backend is reported, and settings are honest about memory storage', async () => {
  const config = resolveRuntimeConfig({
    backend: 'awcms',
    apiBaseUrl: 'https://cms.example.id',
    locale: 'en',
  });
  const { findByText, findAllByText, getByText } = setup(config, (url) => {
    if (url.endsWith('/api/v1/health')) throw new TypeError('network down');
    if (url.includes('/feed.json'))
      return json({ version: 'https://jsonfeed.org/version/1.1', title: 'Feed', items: [] });
    return undefined;
  });

  expect(await findByText(/Unreachable/)).toBeInTheDocument();
  expect(await findByText('Nothing has been published yet.')).toBeInTheDocument();
  expect(getByText('Search')).toBeInTheDocument();

  fireEvent.tap(getByText('Settings'));
  // Both the bridge transport and the storage backend read "memory" outside a real host.
  expect(await findAllByText('memory')).toHaveLength(2);
  expect(
    getByText('Not hardware-backed: do not use this host for production sign-in.'),
  ).toBeInTheDocument();
  expect(getByText('chosen at sign-in')).toBeInTheDocument();

  fireEvent.tap(getByText('Account'));
  expect(await findByText('Email or username')).toBeInTheDocument();
});

test('a misconfigured build renders the configuration error instead of crashing', async () => {
  const { findByText } = render(
    <ConfigErrorScreen message="apiBaseUrl: is required" locale="en" />,
  );
  expect(await findByText('This build is misconfigured')).toBeInTheDocument();
  expect(await findByText('apiBaseUrl: is required')).toBeInTheDocument();
});
