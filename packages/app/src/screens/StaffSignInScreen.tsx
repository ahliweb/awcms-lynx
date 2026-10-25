import type { LoginOutcome } from '@awcms-lynx/client';
import { useState } from '@lynx-js/react';
import { Button } from '../components/Button.tsx';
import { Notice } from '../components/Notice.tsx';
import { Screen } from '../components/Screen.tsx';
import { TextField } from '../components/TextField.tsx';
import { useApp } from '../context.tsx';
import { describeError } from '../errors.ts';

type Step =
  | { kind: 'credentials' }
  | { kind: 'tenant'; principalToken: string }
  | { kind: 'mfa'; mfaChallengeToken: string; tenantId: string | null }
  | { kind: 'blocked'; message: string };

/**
 * awcms staff/member sign-in: password → (workspace selection) → (TOTP).
 *
 * Mirrors the server's state machine in `src/pages/api/v1/auth/login.ts`
 * (ADR-0088 membership selection, MFA challenge). The resulting bearer is an
 * opaque 120-minute token with no refresh — the user signs in again when it
 * lapses. A production persona app still needs the native-auth ADR that
 * awcms ADR-0146 §2.3 asks for (docs/security.md).
 */
export function StaffSignInScreen() {
  const { client, config, t } = useApp();
  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const follow = (outcome: LoginOutcome) => {
    switch (outcome.type) {
      case 'signed-in':
        return; // the session subscription swaps this screen for the account screen
      case 'tenant-selection-required':
        setStep({ kind: 'tenant', principalToken: outcome.principalToken });
        return;
      case 'mfa-required':
        setStep({
          kind: 'mfa',
          mfaChallengeToken: outcome.mfaChallengeToken,
          tenantId: outcome.tenantId,
        });
        return;
      case 'mfa-enrollment-required':
        setStep({ kind: 'blocked', message: t('signIn.staff.mfaEnrol') });
        return;
      case 'turnstile-required':
        setStep({ kind: 'blocked', message: t('signIn.staff.turnstile') });
        return;
    }
  };

  const attempt = async (task: () => Promise<LoginOutcome>) => {
    setBusy(true);
    setError(null);
    try {
      follow(await task());
    } catch (caught) {
      setError(describeError(t, caught));
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep({ kind: 'credentials' });
    setError(null);
  };

  return (
    <Screen title={t('signIn.title')}>
      {error ? <Notice tone="error" message={error} /> : null}
      {step.kind === 'credentials' ? (
        <view>
          <TextField label={t('signIn.staff.identifier')} type="email" onChange={setIdentifier} />
          <TextField
            label={t('signIn.staff.password')}
            type="password"
            onChange={setPassword}
            onConfirm={() =>
              void attempt(() =>
                client.awcms.login({
                  loginIdentifier: identifier.trim(),
                  password,
                  tenantId: config.tenantId,
                }),
              )
            }
          />
          <Button
            label={t('signIn.staff.submit')}
            busy={busy}
            disabled={!identifier.trim() || !password}
            onTap={() =>
              void attempt(() =>
                client.awcms.login({
                  loginIdentifier: identifier.trim(),
                  password,
                  tenantId: config.tenantId,
                }),
              )
            }
          />
        </view>
      ) : null}
      {step.kind === 'tenant' ? (
        <view>
          <Notice tone="info" message={t('signIn.staff.tenantHint')} />
          <TextField label={t('signIn.staff.tenantId')} onChange={setTenantId} />
          <Button
            label={t('signIn.staff.tenant')}
            busy={busy}
            disabled={!tenantId.trim()}
            onTap={() =>
              void attempt(() =>
                client.awcms.selectTenant({
                  principalToken: step.principalToken,
                  tenantId: tenantId.trim(),
                }),
              )
            }
          />
          <Button variant="secondary" label={t('signIn.back')} onTap={restart} />
        </view>
      ) : null}
      {step.kind === 'mfa' ? (
        <view>
          <Notice tone="info" message={t('signIn.staff.mfaHint')} />
          <TextField
            label={t('signIn.staff.mfaCode')}
            type="text"
            maxlength={32}
            onChange={setCode}
          />
          <Button
            label={t('signIn.customer.verify')}
            busy={busy}
            disabled={!code.trim()}
            onTap={() => {
              const value = code.trim();
              const isTotp = /^\d{6}$/.test(value);
              void attempt(() =>
                client.awcms.verifyTotp({
                  mfaChallengeToken: step.mfaChallengeToken,
                  tenantId: step.tenantId,
                  ...(isTotp ? { code: value } : { recoveryCode: value }),
                }),
              );
            }}
          />
          <Button variant="secondary" label={t('signIn.back')} onTap={restart} />
        </view>
      ) : null}
      {step.kind === 'blocked' ? (
        <view>
          <Notice tone="warning" message={step.message} />
          <Button variant="secondary" label={t('signIn.back')} onTap={restart} />
        </view>
      ) : null}
    </Screen>
  );
}
