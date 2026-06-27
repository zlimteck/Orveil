import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { auth as authApi, totp as totpApi, passkey as passkeyApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { Fingerprint } from 'lucide-react';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // TOTP step
  const [pendingToken, setPendingToken] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  // Passkey
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(form);
      if (data.requiresOtp) {
        setPendingToken(data.pendingToken);
      } else {
        login(data.username);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || t('login.error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await totpApi.login(pendingToken, otpCode);
      login(data.username);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t('login.error'));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskey() {
    setError('');
    setPasskeyLoading(true);
    try {
      const { challengeId, options } = await passkeyApi.loginOptions();
      const credential = await startAuthentication(options);
      const data = await passkeyApi.login({ challengeId, credential });
      login(data.username);
      navigate('/');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError(t('login.passkeyDismissed'));
      } else {
        setError(err.response?.data?.error || err.message || t('login.error'));
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img src="/logo.svg" alt="Orveil" className="w-14 h-14 mx-auto" />
          <h1 className="text-2xl font-bold text-thistle">Orveil</h1>
          <p className="text-sm text-muted">{t('login.subtitle')}</p>
        </div>

        <div className="card">
          {/* Étape OTP */}
          {pendingToken ? (
            <form onSubmit={handleOtp} className="space-y-4">
              <p className="text-sm text-muted">{t('login.otpHint')}</p>
              <input
                className="input text-center tracking-widest text-lg"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
              />
              {error && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
              )}
              <button type="submit" disabled={loading || otpCode.length !== 6} className="btn-primary w-full justify-center">
                {loading ? t('login.signing') : t('login.otpSubmit')}
              </button>
              <button type="button" onClick={() => { setPendingToken(null); setOtpCode(''); setError(''); }}
                className="btn-ghost w-full justify-center text-sm">
                {t('login.back')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">{t('login.username')}</label>
                <input className="input" autoComplete="username" autoFocus
                  value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="admin" />
              </div>
              <div>
                <label className="label">{t('login.password')}</label>
                <input className="input" type="password" autoComplete="current-password"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••" />
              </div>
              {error && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? t('login.signing') : t('login.submit')}
              </button>

              <div className="relative flex items-center gap-2 py-1">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted">{t('login.or')}</span>
                <div className="flex-1 border-t border-border" />
              </div>

              <button type="button" onClick={handlePasskey} disabled={passkeyLoading}
                className="btn-ghost border border-border w-full justify-center">
                <Fingerprint size={16} />
                {passkeyLoading ? t('login.passkeyWaiting') : t('login.passkey')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
