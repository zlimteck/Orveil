import React, { useState, useEffect, useRef } from 'react';
import { monitors as api } from '../api';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import ServiceModal from '../components/ServiceModal';
import ServiceIcon from '../components/ServiceIcon';
import { Plus, Play, Pencil, Trash2, Power, Wrench, X } from 'lucide-react';

function timeRemaining(until) {
  const ms = new Date(until) - Date.now();
  if (ms <= 0) return null;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function MaintenancePopover({ monitor, onClose, onSet, onCancel }) {
  const { t } = useLang();
  const [custom, setCustom] = useState('');
  const ref = useRef();

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const inMaintenance = monitor.maintenanceUntil && new Date(monitor.maintenanceUntil) > new Date();

  return (
    <div ref={ref} className="absolute right-0 top-9 z-50 w-64 card shadow-lg border border-border p-3 space-y-3">
      <p className="text-xs font-semibold text-thistle">{t('services.maintenance.title')}</p>
      <p className="text-xs text-muted">{t('services.maintenance.hint')}</p>
      {inMaintenance ? (
        <div className="space-y-2">
          <p className="text-xs text-amber-400 font-medium">{t('services.actions.maintenanceActive')(timeRemaining(monitor.maintenanceUntil))}</p>
          <button onClick={onCancel} className="btn-ghost w-full text-xs py-1.5 rounded-lg text-red-400 hover:text-red-300">
            {t('services.actions.maintenanceCancel')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1">
            {t('services.maintenance.presets').map((label, i) => (
              <button key={i} onClick={() => onSet(t('services.maintenance.presetValues')[i])}
                className="btn-ghost text-xs py-1.5 rounded-lg border border-border hover:border-periwinkle/40">
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number" min="1" placeholder={t('services.maintenance.custom')}
              value={custom} onChange={e => setCustom(e.target.value)}
              className="input text-xs py-1.5 flex-1"
            />
            <button onClick={() => custom > 0 && onSet(parseInt(custom))}
              className="btn-primary text-xs px-3 py-1.5 rounded-lg">
              {t('services.maintenance.start')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Services() {
  const { t } = useLang();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [running, setRunning] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [maintenanceOpen, setMaintenanceOpen] = useState(null);

  async function load() {
    setItems(await api.list());
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  async function handleSave(form) {
    try {
      if (modal && modal._id) await api.update(modal._id, form);
      else await api.create(form);
      setModal(null);
      load();
    } catch (err) {
      toast.add(err.response?.data?.error || err.message, 'error');
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

  async function handleDelete(id) {
    await api.delete(id);
    setConfirmDelete(null);
    load();
  }

  async function handleSetMaintenance(id, minutes) {
    await api.setMaintenance(id, minutes);
    setMaintenanceOpen(null);
    load();
  }

  async function handleCancelMaintenance(id) {
    await api.cancelMaintenance(id);
    setMaintenanceOpen(null);
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
        {items.map(m => {
          const inMaintenance = m.maintenanceUntil && new Date(m.maintenanceUntil) > new Date();
          return (
            <div key={m._id} className={`card ${!m.enabled ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5"><ServiceIcon type={m.type} size={22} url={m.config?.url} faviconUrl={m.metrics?.faviconUrl} /></span>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-semibold text-thistle text-sm">{m.name}</p>
                    <StatusBadge status={m.enabled ? m.status : 'unknown'} />
                    {inMaintenance && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-900/40 flex items-center gap-1">
                        <Wrench size={10} /> {timeRemaining(m.maintenanceUntil)}
                      </span>
                    )}
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
                  <div className="relative">
                    <button
                      title={t('services.actions.maintenance')}
                      onClick={() => setMaintenanceOpen(maintenanceOpen === m._id ? null : m._id)}
                      className={`btn-ghost p-2 rounded-lg ${inMaintenance ? 'text-amber-400' : ''}`}>
                      <Wrench size={14} />
                    </button>
                    {maintenanceOpen === m._id && (
                      <MaintenancePopover
                        monitor={m}
                        onClose={() => setMaintenanceOpen(null)}
                        onSet={(minutes) => handleSetMaintenance(m._id, minutes)}
                        onCancel={() => handleCancelMaintenance(m._id)}
                      />
                    )}
                  </div>
                  <button title={t('services.actions.edit')} onClick={() => setModal(m)} className="btn-ghost p-2 rounded-lg">
                    <Pencil size={14} />
                  </button>
                  {confirmDelete === m._id ? (
                    <>
                      <button
                        onClick={() => handleDelete(m._id)}
                        className="text-xs px-2 py-1 rounded-lg bg-red-900/30 text-red-400 border border-red-900/40 hover:bg-red-900/50 transition-colors"
                      >
                        {t('incidents.confirmDelete')}
                      </button>
                      <button onClick={() => setConfirmDelete(null)} className="p-2 rounded-lg text-muted hover:text-thistle transition-colors">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <button title={t('services.actions.delete')} onClick={() => setConfirmDelete(m._id)}
                      className="p-2 rounded-lg text-muted hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <ServiceModal
          monitor={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
