import { useState } from '@lynx-js/react';
import { Button } from '../components/Button.tsx';
import { Notice } from '../components/Notice.tsx';
import { Screen } from '../components/Screen.tsx';
import { TextField } from '../components/TextField.tsx';
import { useApp } from '../context.tsx';
import { describeError } from '../errors.ts';

type Mode = 'login' | 'register';

/**
 * awcms-one customer sign-in by one-time code (ADR-0016): request a code by
 * email, then verify it for a `cs_` bearer session. The request answer is
 * deliberately neutral — an unknown email "succeeds" too — so the screen
 * never claims an account exists.
 */
export function CustomerSignInScreen() {
  const { client, t } = useApp();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<{ minutes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(describeError(t, caught));
    } finally {
      setBusy(false);
    }
  };

  const requestCode = () =>
    run(async () => {
      const result = await client.commerce.requestOtp({
        email: email.trim(),
        purpose: mode,
        ...(mode === 'register' ? { name: name.trim(), phone: phone.trim() } : {}),
      });
      setSent({ minutes: Math.max(1, Math.round(result.expiresInSeconds / 60)) });
    });

  const verify = () =>
    run(async () => {
      await client.commerce.verifyOtp({ email: email.trim(), code: code.trim(), purpose: mode });
    });

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validRegistration =
    mode === 'login' || (name.trim().length >= 2 && phone.trim().length >= 8);

  return (
    <Screen title={mode === 'login' ? t('signIn.title') : t('signIn.customer.register')}>
      {error ? <Notice tone="error" message={error} /> : null}
      {sent === null ? (
        <view>
          {mode === 'register' ? (
            <view>
              <TextField label={t('signIn.customer.name')} maxlength={150} onChange={setName} />
              <TextField
                label={t('signIn.customer.phone')}
                type="tel"
                maxlength={20}
                onChange={setPhone}
              />
            </view>
          ) : null}
          <TextField
            label={t('signIn.customer.email')}
            type="email"
            onChange={setEmail}
            onConfirm={() => void requestCode()}
          />
          <Button
            label={t('signIn.customer.requestCode')}
            busy={busy}
            disabled={!validEmail || !validRegistration}
            onTap={() => void requestCode()}
          />
          <Button
            variant="secondary"
            label={mode === 'login' ? t('signIn.customer.register') : t('signIn.back')}
            onTap={() => setMode(mode === 'login' ? 'register' : 'login')}
          />
        </view>
      ) : (
        <view>
          <Notice
            tone="info"
            message={t('signIn.customer.codeSent', { email: email.trim(), minutes: sent.minutes })}
          />
          <TextField
            label={t('signIn.customer.code')}
            type="digit"
            maxlength={6}
            onChange={setCode}
            onConfirm={() => void verify()}
          />
          <Button
            label={t('signIn.customer.verify')}
            busy={busy}
            disabled={!/^\d{6}$/.test(code.trim())}
            onTap={() => void verify()}
          />
          <Button
            variant="secondary"
            label={t('signIn.customer.changeEmail')}
            onTap={() => {
              setSent(null);
              setCode('');
            }}
          />
        </view>
      )}
    </Screen>
  );
}
