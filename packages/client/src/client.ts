import type { AwcmsApi } from './awcms.ts';
import { createAwcmsApi } from './awcms.ts';
import type { CommerceApi } from './commerce.ts';
import { createCommerceApi } from './commerce.ts';
import type { AsyncKeyValueStore, ClientConfig } from './config.ts';
import { createHttpClient, type HttpClient } from './http.ts';
import { createSessionManager, type SessionManager } from './session.ts';

export interface AwcmsClient {
  config: ClientConfig;
  http: HttpClient;
  sessions: SessionManager;
  awcms: AwcmsApi;
  commerce: CommerceApi;
}

/**
 * Wires the HTTP layer, session manager and both backend APIs together. Both
 * APIs always exist; the one that does not match `config.backend` throws
 * WRONG_BACKEND when called, so a mis-wired screen fails loudly in development.
 * Call `client.sessions.load()` once at start-up to restore a saved session.
 */
export function createAwcmsClient(config: ClientConfig, store: AsyncKeyValueStore): AwcmsClient {
  const http = createHttpClient(config);
  const sessions = createSessionManager(store, { now: config.now });
  return {
    config,
    http,
    sessions,
    awcms: createAwcmsApi({ config, http, sessions }),
    commerce: createCommerceApi({ config, http, sessions }),
  };
}
