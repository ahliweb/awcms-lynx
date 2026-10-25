/**
 * Maps a thrown value to one localised sentence a person can act on.
 *
 * The API's own `error.message` is English-only and written for developers
 * (awcms `src/pages/api/v1/auth/login.ts`), so it is never shown verbatim;
 * the stable `error.code` decides the sentence instead.
 */
import { isApiError } from '@awcms-lynx/client';
import type { Translate } from './i18n.ts';

const BY_CODE: Record<string, Parameters<Translate>[0]> = {
  INVALID_CREDENTIALS: 'error.invalidCredentials',
  PASSWORD_LOGIN_DISABLED: 'error.passwordLoginDisabled',
  OTP_INVALID: 'error.otpInvalid',
  ACCOUNT_NOT_FOUND: 'error.accountNotFound',
  ACCOUNT_BLOCKED: 'error.accountBlocked',
  VALIDATION_ERROR: 'error.validation',
  AUTH_REQUIRED: 'error.signedOut',
  UNAUTHENTICATED: 'error.signedOut',
  NOT_SIGNED_IN: 'error.signedOut',
  ACCESS_DENIED: 'error.forbidden',
};

export function describeError(t: Translate, error: unknown): string {
  if (!isApiError(error)) return t('error.unknown');
  if (error.kind === 'network') return t('error.network');
  if (error.kind === 'timeout') return t('error.timeout');
  if (error.kind === 'config') return t('error.config', { code: error.code });
  if (error.status === 429 || error.code === 'RATE_LIMITED') {
    return error.retryAfterSeconds
      ? t('error.rateLimited', { seconds: error.retryAfterSeconds })
      : t('error.rateLimitedNoWait');
  }
  const key = BY_CODE[error.code];
  if (key) return t(key);
  return t('error.server', { code: error.code || String(error.status) });
}
