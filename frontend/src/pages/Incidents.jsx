import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { incidents as api } from '../api';
import { useLang } from '../context/LangContext';
import { AlertTriangle, CheckCircle, BellOff, Trash2, X, Siren, FileText, Wrench } from 'lucide-react';
import Portal from '../components/Portal';

const SEVERITIES = ['P1','P2','P3','P4'];
const SEV_STYLE = {
  P1: 'text-red-400 bg-red-900/30 border-red-900/40',
  P2: 'text-amber-400 bg-amber-900/30 border-amber-900/40',
  P3: 'text-periwinkle bg-blue-900/20 border-blue-900/30',
  P4: 'text-muted bg-granite/20 border-granite/30',
};

function duration(ms) {
  if (ms == null) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
}

const PM_FIELDS = ['summary', 'rootCause', 'impact', 'resolution', 'lessons'];

function PostmortemModal({ incident, onClose, onSaved }) {
  const { t, lang } = useLang();
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const pm = incident.postmortem || {};
  const [form, setForm] = useState({
    summary:    pm.summary    || '',
    rootCause:  pm.rootCause  || '',
    impact:     pm.impact     || '',
    resolution: pm.resolution || '',
    lessons:    pm.lessons    || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.savePostmortem(incident._id, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  const labelKey = { summary: 'postmortemSummary', rootCause: 'postmortemRootCause', impact: 'postmortemImpact', resolution: 'postmortemResolution', lessons: 'postmortemLessons' };

  return (
    <Portal><div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-thistle flex items-center gap-2">
              <FileText size={15} className="text-periwinkle" />
              {t('incidents.postmortem')} — {incident.monitorName}
            </h2>
            {pm.updatedAt && (
              <p className="text-xs text-muted mt-0.5">{t('incidents.postmortemUpdated')} : {new Date(pm.updatedAt).toLocaleString(locale)}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-muted hover:text-thistle transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {PM_FIELDS.map(field => (
            <div key={field}>
              <label className="label">{t(`incidents.${labelKey[field]}`)}</label>
              <textarea
                className="input resize-none h-20 text-sm"
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">{t('form.cancel')}</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saved ? `✓ ${t('incidents.postmortemSaved')}` : saving ? '…' : t('incidents.postmortemSave')}
            </button>
          </div>
        </form>
      </div>
    </div></Portal>
  );
}

function IncidentRow({ incident: i, onAcknowledge, onDelete, onSeverityChange, onPostmortem }) {
  const { t, lang } = useLang();
  const [confirming, setConfirming] = useState(false);
  const resolved = !!i.resolvedAt;
  const acknowledged = !!i.acknowledgedAt;
  const sev = i.severity || 'P3';

  function cycleSeverity(e) {
    e.stopPropagation();
    const next = SEVERITIES[(SEVERITIES.indexOf(sev) + 1) % SEVERITIES.length];
    onSeverityChange(i._id, next);
  }
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';

  return (
    <div id={`incident-${i._id}`} className="card flex items-start gap-3 py-3 px-4">
      <div className={`mt-0.5 shrink-0 ${resolved ? 'text-celadon' : acknowledged ? 'text-amber-400' : 'text-red-400'}`}>
        {resolved ? <CheckCircle size={16} /> : acknowledged ? <BellOff size={16} /> : <AlertTriangle size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="font-medium text-thistle text-sm">{i.monitorName}</p>
          <span className="text-xs text-muted font-mono">{i.monitorType}</span>
          <button
            onClick={cycleSeverity}
            title={t('incidents.severityClick')}
            className={`text-xs px-1.5 py-0.5 rounded border font-semibold transition-opacity hover:opacity-70 ${SEV_STYLE[sev]}`}
          >
            {sev}
          </button>
          {!resolved && !acknowledged && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-900/40">
              {t('incidents.badge')}
            </span>
          )}
          {!resolved && acknowledged && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-900/40">
              {t('incidents.acknowledged')}
            </span>
          )}
          {i.duringMaintenance && (
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/25">
              <Wrench size={10} />
              {lang === 'fr' ? 'Maintenance' : 'Maintenance'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-muted">
          <span>{t('incidents.start')} : {new Date(i.startedAt).toLocaleString(locale)}</span>
          {resolved && <span>{t('incidents.resolvedAt')} : {new Date(i.resolvedAt).toLocaleString(locale)}</span>}
          {resolved && i.duration && (
            <span>{t('incidents.duration')} : <span className="text-thistle">{duration(i.duration)}</span></span>
          )}
          {!resolved && (
            <span className={acknowledged ? 'text-amber-400' : 'text-red-400'}>
              {t('incidents.ongoing')(duration(Date.now() - new Date(i.startedAt)))}
            </span>
          )}
          {i.reason && (
            <span className="text-muted truncate max-w-xs" title={i.reason}>— {i.reason}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 self-center">
        {resolved && (
          <button
            onClick={() => onPostmortem(i)}
            title={i.postmortem?.updatedAt ? t('incidents.postmortemView') : t('incidents.postmortemAdd')}
            className={`p-2 rounded-lg transition-colors ${i.postmortem?.updatedAt ? 'text-periwinkle hover:text-thistle' : 'text-muted hover:text-periwinkle'}`}
          >
            <FileText size={14} />
          </button>
        )}
        {!resolved && !acknowledged && (
          <button
            onClick={() => onAcknowledge(i._id)}
            title={t('incidents.acknowledge')}
            className="btn-ghost p-2 rounded-lg text-muted hover:text-amber-400 transition-colors"
          >
            <BellOff size={14} />
          </button>
        )}
        {confirming ? (
          <>
            <button
              onClick={() => onDelete(i._id)}
              className="text-xs px-2 py-1 rounded-lg bg-red-900/30 text-red-400 border border-red-900/40 hover:bg-red-900/50 transition-colors"
            >
              {t('incidents.confirmDelete')}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="p-2 rounded-lg text-muted hover:text-thistle transition-colors"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            title={t('incidents.delete')}
            className="p-2 rounded-lg text-muted hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

const SELECT_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23626273' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.4rem center',
  backgroundSize: '1.1em 1.1em',
};

export default function Incidents() {
  const { t, lang } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterService, setFilterService] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterDuration, setFilterDuration] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [sortMode, setSortMode] = useState('newest');
  const [warRoom, setWarRoom] = useState(false);
  const [pmIncident, setPmIncident] = useState(null);

  const load = useCallback(() => {
    api.list({ limit: 500 }).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const targetId = location.state?.openIncidentId;
    const openPm = location.state?.openPostmortem;
    if (!targetId || data.length === 0) return;
    const incident = data.find(i => String(i._id) === String(targetId));
    if (incident) {
      if (openPm) setPmIncident(incident);
      // Scroll the incident into view by its element id
      setTimeout(() => {
        document.getElementById(`incident-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      navigate('/incidents', { replace: true, state: {} });
    }
  }, [location.state?.openIncidentId, data]);

  useEffect(() => {
    if (!warRoom) return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [warRoom, load]);

  async function handleAcknowledge(id) {
    await api.acknowledge(id);
    load();
  }

  async function handleDelete(id) {
    await api.delete(id);
    load();
  }

  async function handleSeverityChange(id, severity) {
    await api.setSeverity(id, severity);
    load();
  }

  function handlePostmortemSaved(updated) {
    setData(d => d.map(i => i._id === updated._id ? updated : i));
    if (pmIncident?._id === updated._id) setPmIncident(updated);
  }

  const serviceNames = useMemo(() => {
    const names = [...new Set(data.map(i => i.monitorName))].sort();
    return names;
  }, [data]);

  const filtered = useMemo(() => {
    let result = [...data];

    if (filterService)  result = result.filter(i => i.monitorName === filterService);
    if (filterSeverity) result = result.filter(i => (i.severity || 'P3') === filterSeverity);

    if (filterPeriod) {
      const cutoff = Date.now() - parseInt(filterPeriod) * 24 * 60 * 60 * 1000;
      result = result.filter(i => new Date(i.startedAt).getTime() >= cutoff);
    }

    if (filterDuration) {
      const minMs = parseInt(filterDuration) * 60 * 1000;
      result = result.filter(i => {
        const ms = i.resolvedAt
          ? i.duration
          : Date.now() - new Date(i.startedAt).getTime();
        return ms != null && ms >= minMs;
      });
    }

    result.sort((a, b) => {
      if (sortMode === 'oldest') return new Date(a.startedAt) - new Date(b.startedAt);
      if (sortMode === 'longest') {
        const da = a.resolvedAt ? a.duration : Date.now() - new Date(a.startedAt).getTime();
        const db = b.resolvedAt ? b.duration : Date.now() - new Date(b.startedAt).getTime();
        return (db ?? 0) - (da ?? 0);
      }
      return new Date(b.startedAt) - new Date(a.startedAt);
    });

    return result;
  }, [data, filterService, filterPeriod, filterDuration, sortMode]);

  const SEV_ORDER = { P1: 0, P2: 1, P3: 2, P4: 3 };
  const warRoomData = useMemo(() =>
    data.filter(i => !i.resolvedAt).sort((a, b) => (SEV_ORDER[a.severity || 'P3'] ?? 3) - (SEV_ORDER[b.severity || 'P3'] ?? 3)),
  [data]);

  const open = filtered.filter(i => !i.resolvedAt);
  const closed = filtered.filter(i => i.resolvedAt);
  const hasFilters = filterService || filterPeriod || filterDuration || filterSeverity || sortMode !== 'newest';

  // Group closed incidents by day
  const closedByDay = useMemo(() => {
    const groups = [];
    const seen = {};
    for (const i of closed) {
      const d = new Date(i.startedAt);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const isYesterday = d.toDateString() === new Date(now - 86400000).toDateString();
      const label = isToday
        ? (lang === 'fr' ? "Aujourd'hui" : 'Today')
        : isYesterday
        ? (lang === 'fr' ? 'Hier' : 'Yesterday')
        : d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
      if (!seen[label]) { seen[label] = true; groups.push({ label, items: [] }); }
      groups[groups.length - 1].items.push(i);
    }
    return groups;
  }, [closed, lang]);

  if (warRoom) {
    const hasP1 = warRoomData.some(i => (i.severity || 'P3') === 'P1');
    return (
      <div className={`min-h-screen p-4 md:p-6 space-y-4 transition-colors duration-500 ${hasP1 ? 'bg-red-950/20' : 'bg-black/10'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-xl md:text-2xl font-bold text-red-400 flex items-center gap-2 ${hasP1 ? 'animate-pulse' : ''}`}>
              <Siren size={22} className="shrink-0" />
              {t('incidents.warRoom')}
            </h1>
            <p className="text-xs text-muted mt-0.5">{t('incidents.warRoomHint')}</p>
          </div>
          <button onClick={() => setWarRoom(false)} className="btn-ghost border border-border">
            ← {t('incidents.title')}
          </button>
        </div>

        {warRoomData.length === 0 ? (
          <div className="card text-center py-16">
            <CheckCircle size={32} className="text-celadon mx-auto mb-3" />
            <p className="text-thistle font-medium">{t('incidents.warRoomEmpty')}</p>
            <p className="text-sm text-muted mt-1">{t('incidents.warRoomEmptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {warRoomData.map(i => (
              <div key={i._id} className={(i.severity || 'P3') === 'P1' ? 'ring-1 ring-red-500/50 rounded-xl shadow-lg shadow-red-900/30' : ''}>
                <IncidentRow incident={i} onAcknowledge={handleAcknowledge} onDelete={handleDelete} onSeverityChange={handleSeverityChange} onPostmortem={setPmIncident} />
              </div>
            ))}
          </div>
        )}
        {pmIncident && <PostmortemModal incident={pmIncident} onClose={() => setPmIncident(null)} onSaved={handlePostmortemSaved} />}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {pmIncident && <PostmortemModal incident={pmIncident} onClose={() => setPmIncident(null)} onSaved={handlePostmortemSaved} />}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('incidents.title')}</h1>
          <p className="text-xs md:text-sm text-muted mt-0.5">{t('incidents.subtitle')(open.length, closed.length)}</p>
        </div>
        {open.length > 0 && (
          <button onClick={() => setWarRoom(true)} className="btn-danger shrink-0">
            <Siren size={13} />
            {t('incidents.warRoom')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={filterService}
          onChange={e => setFilterService(e.target.value)}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value="">{t('incidents.filters.allServices')}</option>
          {serviceNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <select
          value={filterPeriod}
          onChange={e => setFilterPeriod(e.target.value)}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value="">{t('incidents.filters.allPeriods')}</option>
          <option value="7">{t('incidents.filters.last7d')}</option>
          <option value="30">{t('incidents.filters.last30d')}</option>
        </select>

        <select
          value={filterDuration}
          onChange={e => setFilterDuration(e.target.value)}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value="">{t('incidents.filters.allDurations')}</option>
          <option value="5">{t('incidents.filters.gt5min')}</option>
          <option value="30">{t('incidents.filters.gt30min')}</option>
          <option value="60">{t('incidents.filters.gt1h')}</option>
        </select>

        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value="">{t('incidents.filters.allSeverities')}</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={sortMode}
          onChange={e => setSortMode(e.target.value)}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value="newest">{t('incidents.filters.sortNewest')}</option>
          <option value="oldest">{t('incidents.filters.sortOldest')}</option>
          <option value="longest">{t('incidents.filters.sortLongest')}</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {[
          { sev: 'P1', label: t('incidents.severity.P1'), style: SEV_STYLE.P1 },
          { sev: 'P2', label: t('incidents.severity.P2'), style: SEV_STYLE.P2 },
          { sev: 'P3', label: t('incidents.severity.P3'), style: SEV_STYLE.P3 },
        ].map(({ sev, label, style }) => (
          <span key={sev} className="flex items-center gap-1.5 text-xs text-muted">
            <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${style}`}>{sev}</span>
            {label}
          </span>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          {[0,1,2,3].map(i => (
            <div key={i} className="card flex items-start gap-3 py-3 px-4">
              <div className="skeleton w-4 h-4 rounded-full mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2"><div className="skeleton h-3.5 w-28 rounded" /><div className="skeleton h-3.5 w-10 rounded" /><div className="skeleton h-3.5 w-6 rounded" /></div>
                <div className="flex gap-3"><div className="skeleton h-2.5 w-36 rounded" /><div className="skeleton h-2.5 w-24 rounded" /></div>
              </div>
              <div className="skeleton w-6 h-6 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      )}

      {!loading && data.length > 0 && filtered.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-thistle font-medium">{t('incidents.noResults')}</p>
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">{t('incidents.open')}</h2>
          {open.map(i => <IncidentRow key={i._id} incident={i} onAcknowledge={handleAcknowledge} onDelete={handleDelete} onSeverityChange={handleSeverityChange} onPostmortem={setPmIncident} />)}
        </div>
      )}

      {closedByDay.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">{t('incidents.resolved')}</h2>
          {closedByDay.map(group => (
            <div key={group.label} className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted/70 font-medium whitespace-nowrap">{group.label}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {group.items.map(i => <IncidentRow key={i._id} incident={i} onAcknowledge={handleAcknowledge} onDelete={handleDelete} onSeverityChange={handleSeverityChange} onPostmortem={setPmIncident} />)}
            </div>
          ))}
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="card text-center py-14">
          <p className="text-thistle font-medium">{t('incidents.empty')}</p>
          <p className="text-sm text-muted mt-1">{t('incidents.emptyHint')}</p>
        </div>
      )}
    </div>
  );
}
