import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { oauth as oauthApi } from '../api';
import { useLang } from '../context/LangContext';
import { ShieldCheck } from 'lucide-react';

// MCP OAuth consent screen. Reached via redirect from the backend's /authorize
// endpoint (not client-side routing), carrying ?pending=<id>. Not wrapped in
// AuthGuard: an unauthenticated visitor must still be able to load this page
// so it can bounce them to /login?continue=<here> and come straight back.
export default function OAuthConsent() {
  const [searchParams] = useSearchParams();
  const pending = searchParams.get('pending');
  const { t } = useLang();

  const [state, setState] = useState('loading'); // loading | consent | error | denying | allowing
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pending) { setError(t('oauth.missingPending')); setState('error'); return; }

    oauthApi.authorizeState(pending).then(res => {
      if (!res.authenticated) {
        const dest = `/oauth/authorize?pending=${encodeURIComponent(pending)}`;
        window.location.href = `/login?continue=${encodeURIComponent(dest)}`;
        return;
      }
      setData(res);
      setState('consent');
    }).catch(err => {
      setError(err.response?.data?.error || t('oauth.expired'));
      setState('error');
    });
  }, [pending]);

  async function decide(decision) {
    setState(decision === 'allow' ? 'allowing' : 'denying');
    try {
      const res = await oauthApi.authorizeDecision(pending, data.csrfToken, decision);
      window.location.href = res.redirect;
    } catch (err) {
      setError(err.response?.data?.error || t('oauth.expired'));
      setState('error');
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img src="/logo.svg" alt="Orveil" className="w-14 h-14 mx-auto" />
          <h1 className="text-2xl font-bold text-thistle">Orveil</h1>
        </div>

        <div className="card space-y-4">
          {state === 'loading' && (
            <p className="text-sm text-muted text-center">{t('oauth.loading')}</p>
          )}

          {state === 'error' && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
          )}

          {(state === 'consent' || state === 'allowing' || state === 'denying') && data && (
            <>
              <div className="flex items-center gap-2 text-ink">
                <ShieldCheck size={18} className="text-thistle shrink-0" />
                <p className="text-sm">
                  {t('oauth.wantsAccess').replace('{{client}}', data.client.name)}
                </p>
              </div>
              <p className="text-xs text-muted">
                {t('oauth.redirectsTo')} <span className="font-mono text-ink">{data.client.redirectHost}</span>
              </p>
              <div className="flex gap-2 pt-2">
                <button type="button" disabled={state !== 'consent'}
                  onClick={() => decide('deny')}
                  className="btn-ghost border border-border flex-1 justify-center">
                  {t('oauth.deny')}
                </button>
                <button type="button" disabled={state !== 'consent'}
                  onClick={() => decide('allow')}
                  className="btn-primary flex-1 justify-center">
                  {state === 'allowing' ? t('oauth.allowing') : t('oauth.allow')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
