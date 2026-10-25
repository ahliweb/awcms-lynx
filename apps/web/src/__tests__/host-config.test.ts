import { describe, expect, test } from 'bun:test';
import { buildGlobalProps, resolveHtmlLang, resolvePersistence } from '../host-config.ts';

describe('buildGlobalProps', () => {
  test('keeps only defined, non-empty values and trims them', () => {
    expect(
      buildGlobalProps({
        PUBLIC_AWCMS_BACKEND: ' awcms ',
        PUBLIC_AWCMS_API_BASE_URL: 'https://cms.example.id',
        PUBLIC_AWCMS_TENANT_ID: '',
        PUBLIC_AWCMS_LOCALE: '   ',
        PUBLIC_AWCMS_APP_NAME: 'Toko',
      }),
    ).toEqual({ backend: 'awcms', apiBaseUrl: 'https://cms.example.id', appName: 'Toko' });
  });

  test('defaults the API origin to the page origin (same-origin proxy)', () => {
    expect(buildGlobalProps({}, 'https://app.example.id')).toEqual({
      apiBaseUrl: 'https://app.example.id',
      storefrontOrigin: 'https://app.example.id',
    });
  });

  test('does not default storefrontOrigin for the staff backend', () => {
    expect(buildGlobalProps({ PUBLIC_AWCMS_BACKEND: 'awcms' }, 'https://app.example.id')).toEqual({
      backend: 'awcms',
      apiBaseUrl: 'https://app.example.id',
    });
  });

  test('explicit values beat the page origin', () => {
    expect(
      buildGlobalProps(
        {
          PUBLIC_AWCMS_API_BASE_URL: 'https://cms.example.id',
          PUBLIC_AWCMS_STOREFRONT_ORIGIN: 'https://shop.example.id',
        },
        'https://app.example.id',
      ),
    ).toEqual({
      apiBaseUrl: 'https://cms.example.id',
      storefrontOrigin: 'https://shop.example.id',
    });
  });

  test('is empty when nothing is configured and no origin is known', () => {
    expect(buildGlobalProps({})).toEqual({});
  });
});

describe('resolvePersistence', () => {
  test('staff sessions end with the tab, customer sessions survive it', () => {
    expect(resolvePersistence({ PUBLIC_AWCMS_BACKEND: 'awcms' })).toBe('session');
    expect(resolvePersistence({ PUBLIC_AWCMS_BACKEND: 'awcms-one' })).toBe('local');
    expect(resolvePersistence({})).toBe('local');
  });

  test('an explicit valid setting wins; an invalid one is ignored', () => {
    expect(
      resolvePersistence({
        PUBLIC_AWCMS_BACKEND: 'awcms',
        PUBLIC_AWCMS_WEB_SESSION_PERSISTENCE: 'local',
      }),
    ).toBe('local');
    expect(
      resolvePersistence({
        PUBLIC_AWCMS_BACKEND: 'awcms',
        PUBLIC_AWCMS_WEB_SESSION_PERSISTENCE: 'forever',
      }),
    ).toBe('session');
  });
});

describe('resolveHtmlLang', () => {
  test('en or id, id by default', () => {
    expect(resolveHtmlLang('en')).toBe('en');
    expect(resolveHtmlLang('fr')).toBe('id');
    expect(resolveHtmlLang(undefined)).toBe('id');
  });
});
