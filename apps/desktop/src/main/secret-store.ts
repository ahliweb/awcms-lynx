/**
 * A small key-value file under the per-user app-data directory: the desktop
 * host's `secureStorage`.
 *
 * Lynxtron 0.0.30 exposes no OS keyring or `safeStorage` API (checked in
 * node_modules/@lynx-js/lynxtron/apis), so nothing here is encrypted. What it
 * does provide: an owner-only file (0o600 inside a 0o700 directory on macOS;
 * on Windows the per-user %APPDATA% ACL is the protection, `mode` is ignored),
 * atomic writes, and a hard cap on size. The host reports `secureStorage:
 * 'app-file'` so the app never calls the session "secure".
 *
 * Pure Node (no Lynxtron import) so it can be unit-tested with `bun test`.
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const FILE_VERSION = 1;
/** Keys are `awcms-lynx:*`; a token store needs a handful, not thousands. */
export const MAX_ENTRIES = 256;

export class SecretStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SecretStoreError';
  }
}

export class FileSecretStore {
  readonly #file: string;
  #entries: Map<string, string> | null = null;

  constructor(file: string) {
    this.#file = file;
  }

  get(key: string): string | null {
    return this.#load().get(key) ?? null;
  }

  set(key: string, value: string): void {
    const entries = this.#load();
    if (!entries.has(key) && entries.size >= MAX_ENTRIES) {
      throw new SecretStoreError(`The secret store is full (${MAX_ENTRIES} entries)`);
    }
    const next = new Map(entries);
    next.set(key, value);
    this.#persist(next);
  }

  delete(key: string): void {
    const entries = this.#load();
    if (!entries.has(key)) return;
    const next = new Map(entries);
    next.delete(key);
    this.#persist(next);
  }

  #load(): Map<string, string> {
    if (this.#entries) return this.#entries;
    const entries = new Map<string, string>();
    if (existsSync(this.#file)) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(this.#file, 'utf8'));
        const stored = (parsed as { entries?: unknown } | null)?.entries;
        if (stored && typeof stored === 'object') {
          for (const [key, value] of Object.entries(stored)) {
            if (typeof value === 'string') entries.set(key, value);
          }
        }
      } catch (error) {
        // A truncated or hand-edited file must not lock the user out for good:
        // keep it for inspection and start empty (the user signs in again).
        try {
          renameSync(this.#file, `${this.#file}.corrupt`);
        } catch {
          // Nothing more to do; the next write replaces it.
        }
        if (error instanceof SecretStoreError) throw error;
      }
    }
    this.#entries = entries;
    return entries;
  }

  #persist(next: Map<string, string>): void {
    const dir = path.dirname(this.#file);
    const temp = `${this.#file}.${process.pid}.tmp`;
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      const body = JSON.stringify({ version: FILE_VERSION, entries: Object.fromEntries(next) });
      writeFileSync(temp, body, { mode: 0o600 });
      // `mode` only applies when the file is created; tighten a leftover temp file too.
      chmodSync(temp, 0o600);
      renameSync(temp, this.#file);
      this.#entries = next;
    } catch (error) {
      try {
        rmSync(temp, { force: true });
      } catch {
        // The original failure is the one worth reporting.
      }
      throw new SecretStoreError(
        `Could not write the secret store: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
}
