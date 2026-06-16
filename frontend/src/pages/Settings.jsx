import React, { useState, useEffect } from 'react';
import { settings as api, auth as authApi } from '../api';
import { Save, Send, Info, KeyRound } from 'lucide-react';
import { useLang } from '../context/LangContext';

const EXAMPLES = [
  'pover://UserKey@ApiToken/',
  'tgram://BotToken/ChatID/',
  'slack://TokenA/TokenB/TokenC/',
  'discord://WebhookID/WebhookToken/',
  'mailto://user:pass@gmail.com',
];

function ChangePassword() {
  const { t } = useLang();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [state, setState] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { setState('mismatch'); return; }
    setState('saving');
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setState('ok');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setState(err.response?.data?.error || 'error');
    }
    setTimeout(() => setState(null), 3000);
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-thistle text-sm flex items-center gap-2">
        <KeyRound size={14} className="text-periwinkle" /> {t('settings.password.title')}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input className="input" type="password" placeholder={t('settings.password.current')}
          value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} />
        <input className="input" type="password" placeholder={t('settings.password.new')}
          value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} />
        <input className="input" type="password" placeholder={t('settings.password.confirm')}
          value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={state === 'saving'} className="btn-primary">
            <Save size={14} /> {state === 'saving' ? t('settings.password.saving') : t('settings.password.change')}
          </button>
          {state === 'ok'       && <span className="text-sm text-celadon">{t('settings.password.ok')}</span>}
          {state === 'mismatch' && <span className="text-sm text-red-400">{t('settings.password.mismatch')}</span>}
          {state && state !== 'ok' && state !== 'mismatch' && state !== 'saving' && (
            <span className="text-sm text-red-400">❌ {state}</span>
          )}
        </div>
      </form>
    </div>
  );
}

export default function Settings() {
  const { t } = useLang();
  const [form, setForm] = useState({ appriseUrls: [], appriseApiUrl: 'http://apprise:8000' });
  const [urlsText, setUrlsText] = useState('');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get()
      .then(s => {
        setForm({ appriseUrls: s.appriseUrls || [], appriseApiUrl: s.appriseApiUrl || 'http://apprise:8000' });
        setUrlsText((s.appriseUrls || []).join('\n'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    const appriseUrls = urlsText.split('\n').map(u => u.trim()).filter(Boolean);
    await api.save({ appriseUrls, appriseApiUrl: form.appriseApiUrl });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.test();
      setTestResult(r.sent ? 'success' : 'no_urls');
    } catch { setTestResult('error'); }
    setTesting(false);
    setTimeout(() => setTestResult(null), 4000);
  }

  if (loading) return <div className="p-6 text-muted">{t('settings.loading')}</div>;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('settings.title')}</h1>
        <p className="text-xs md:text-sm text-muted mt-0.5">{t('settings.subtitle')}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="font-semibold text-thistle text-sm">🔔 {t('settings.apprise.title')}</h2>
          <p className="text-xs text-muted">{t('settings.apprise.hint')}</p>

          <div>
            <label className="label">{t('settings.apprise.urlsLabel')}</label>
            <textarea
              className="input h-28 resize-none font-mono text-xs leading-relaxed"
              placeholder={EXAMPLES.join('\n')}
              value={urlsText}
              onChange={e => setUrlsText(e.target.value)}
            />
          </div>

          <div className="bg-granite-3/60 border border-border rounded-xl p-3 flex gap-2.5 text-xs text-muted">
            <Info size={14} className="shrink-0 mt-0.5 text-periwinkle" />
            <div className="min-w-0">
              <p className="font-medium text-thistle mb-1.5">{t('settings.apprise.examples')}</p>
              <ul className="space-y-0.5 font-mono break-all">
                {EXAMPLES.map(e => <li key={e}>{e}</li>)}
              </ul>
              <p className="mt-2 font-sans">
                {t('settings.apprise.docsText')}{' '}
                <a href="https://github.com/caronc/apprise/wiki" target="_blank" rel="noreferrer"
                  className="text-periwinkle hover:underline">{t('settings.apprise.docsLink')}</a>{' '}
                {t('settings.apprise.docsAfter')}
              </p>
            </div>
          </div>

          <div>
            <label className="label">{t('settings.apprise.apiUrlLabel')}</label>
            <input className="input" value={form.appriseApiUrl}
              onChange={e => setForm(f => ({ ...f, appriseApiUrl: e.target.value }))}
              placeholder="http://apprise:8000" />
            <p className="text-xs text-muted mt-1">{t('settings.apprise.apiUrlHint')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="submit" className="btn-primary">
              <Save size={14} />
              {saved ? t('settings.saved') : t('settings.save')}
            </button>
            <button type="button" onClick={handleTest} disabled={testing} className="btn-primary">
              <Send size={14} className={testing ? 'animate-pulse' : ''} />
              {testing ? t('settings.testing') : t('settings.test')}
            </button>
            {testResult === 'success'  && <p className="text-sm text-celadon">{t('settings.testOk')}</p>}
            {testResult === 'no_urls' && <p className="text-sm text-amber-400">{t('settings.testNoUrls')}</p>}
            {testResult === 'error'   && <p className="text-sm text-red-400">{t('settings.testError')}</p>}
          </div>
        </div>
      </form>

      <ChangePassword />

      <div className="card space-y-3">
        <h2 className="font-semibold text-thistle text-sm">🐳 {t('settings.docker.title')}</h2>
        <div className="divide-y divide-border">
          {[
            ['Frontend',    `${window.location.hostname}:3050`],
            ['Backend API', `${window.location.hostname}:5050`],
            ['Apprise API', `${window.location.hostname}:8008`],
            ['MongoDB',     `${t('settings.docker.internal')} (mongo:27017)`],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between items-center py-2 text-sm">
              <span className="text-muted">{label}</span>
              <span className="font-mono text-xs text-thistle">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
