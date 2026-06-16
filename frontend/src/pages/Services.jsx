import React, { useState, useEffect } from 'react';
import { monitors as api } from '../api';
import { useLang } from '../context/LangContext';
import StatusBadge from '../components/StatusBadge';
import ServiceModal from '../components/ServiceModal';
import ServiceIcon from '../components/ServiceIcon';
import { Plus, Play, Pencil, Trash2, Power } from 'lucide-react';

export default function Services() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [running, setRunning] = useState({});
  const [saveError, setSaveError] = useState(null);

  async function load() {
    setItems(await api.list());
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  async function handleSave(form) {
    setSaveError(null);
    try {
      if (modal && modal._id) await api.update(modal._id, form);
      else await api.create(form);
      setModal(null);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message);
    }
  }

  async function handleToggle(id) {
    await api.toggle(id);
    load();
  }

  async function handleRun(id) {
    setRunning(r => ({ ...r, [id]: true }));
    await api.run(id);
    setTimeout(() => { load(); setRunning(r => ({ ...r, [id]: false })); }, 2000);
  }

  async function handleDelete(m) {
    if (!confirm(t('services.actions.deleteConfirm')(m.name))) return;
    await api.delete(m._id);
    load();
  }

  function timeAgo(date) {
    if (!date) return t('time.never');
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return `${s}${t('time.sec')}`;
    if (s < 3600) return `${Math.floor(s / 60)}${t('time.min')}`;
    return `${Math.floor(s / 3600)}${t('time.hour')}`;
  }

  const n = items.length;
  const subtitle = `${n} ${n !== 1 ? t('services.subtitle_many') : t('services.subtitle_one')}`;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('services.title')}</h1>
          <p className="text-xs md:text-sm text-muted mt-0.5">{subtitle}</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary text-sm">
          <Plus size={15} />
          <span className="hidden sm:inline">{t('services.new')}</span>
        </button>
      </div>

      {items.length === 0 && (
        <div className="card text-center py-14">
          <p className="text-thistle font-medium">{t('services.emptyTitle')}</p>
          <p className="text-sm text-muted mt-1">{t('services.emptyHint')}</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map(m => (
          <div key={m._id} className={`card ${!m.enabled ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3">
              <span className="shrink-0 mt-0.5"><ServiceIcon type={m.type} size={22} url={m.config?.url} faviconUrl={m.metrics?.faviconUrl} /></span>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-semibold text-thistle text-sm">{m.name}</p>
                  <StatusBadge status={m.enabled ? m.status : 'unknown'} />
                </div>
                {m.description && <p className="text-xs text-muted truncate mt-0.5">{m.description}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted">
                  <span>{t('services.checkEvery')} {m.checkInterval}min</span>
                  {m.reportInterval > 0 && <span>· {t('services.report')} /{m.reportInterval}h</span>}
                  <span>· {timeAgo(m.lastChecked)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button title={t('services.actions.run')} onClick={() => handleRun(m._id)}
                  disabled={running[m._id] || !m.enabled}
                  className="btn-ghost p-2 rounded-lg">
                  <Play size={14} className={running[m._id] ? 'animate-pulse text-periwinkle' : ''} />
                </button>
                <button title={m.enabled ? t('services.actions.disable') : t('services.actions.enable')}
                  onClick={() => handleToggle(m._id)}
                  className={`btn-ghost p-2 rounded-lg ${m.enabled ? 'text-celadon' : 'text-muted'}`}>
                  <Power size={14} />
                </button>
                <button title={t('services.actions.edit')} onClick={() => setModal(m)} className="btn-ghost p-2 rounded-lg">
                  <Pencil size={14} />
                </button>
                <button title={t('services.actions.delete')} onClick={() => handleDelete(m)}
                  className="p-2 rounded-lg text-muted hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <ServiceModal
          monitor={modal === 'new' ? null : modal}
          onClose={() => { setModal(null); setSaveError(null); }}
          onSave={handleSave}
          error={saveError}
        />
      )}

    </div>
  );
}
