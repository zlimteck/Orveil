import React, { useState, useEffect } from 'react';
import { monitors as monitorsApi, history as historyApi } from '../api';
import { useLang } from '../context/LangContext';
import StatusBadge from '../components/StatusBadge';
import ServiceIcon from '../components/ServiceIcon';
import ServiceDetail from '../components/ServiceDetail';
import { RefreshCw, Radio, AlertTriangle, CheckCircle, Clock, ChevronDown } from 'lucide-react';

function ProgressBar({ value, warn = 80, danger = 95 }) {
  const color = value >= danger ? 'bg-red-400' : value >= warn ? 'bg-amber-400' : 'bg-frosted';
  return (
    <div className="h-1.5 bg-granite-3 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function CloudflareTunnels({ metrics }) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState({});
  const toggle = id => setExpanded(e => ({ ...e, [id]: !e[id] }));
  const tunnels = metrics.tunnels || [];
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">
        {t('metrics.tunnels')} : <span className="text-thistle font-medium">{metrics.healthy}/{metrics.total}</span> {t('metrics.running')}
      </p>
      <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
        {tunnels.map(t2 => {
          const ok = t2.status === 'active' || t2.status === 'healthy';
          const hosts = t2.hostnames || [];
          const open = expanded[t2.id];
          return (
            <div key={t2.id}>
              <button
                onClick={() => hosts.length && toggle(t2.id)}
                className={`flex items-center gap-1.5 text-xs w-full text-left ${hosts.length ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                <span className={ok ? 'text-celadon' : 'text-red-400'}>●</span>
                <span className="text-thistle font-medium flex-1 truncate">{t2.name}</span>
                {hosts.length > 0 && (
                  <span className="text-muted shrink-0 flex items-center gap-0.5">
                    <span>{hosts.length}</span>
                    <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                  </span>
                )}
              </button>
              {open && hosts.map(h => (
                <p key={h} className="text-xs text-muted pl-4 truncate">└ {h}</p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricsBlock({ monitor }) {
  const { t } = useLang();
  const { type, metrics, status, lastError } = monitor;

  if (!metrics) {
    if (status === 'error' && lastError) {
      return (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/30 rounded px-2 py-1.5 break-all">
          {lastError}
        </p>
      );
    }
    return <p className="text-xs text-muted italic">{t('metrics.waiting')}</p>;
  }

  if (type === 'cloudflare') return <CloudflareTunnels metrics={metrics} />;

  if (type === 'adguard') return (
    <div className="space-y-1.5">
      <div className="flex gap-4 text-xs text-muted">
        <span>{t('metrics.protection')} : <span className={metrics.protection ? 'text-celadon font-medium' : 'text-red-400 font-medium'}>{metrics.protection ? t('metrics.active') : t('metrics.inactive')}</span></span>
        <span>{t('metrics.devices')} : <span className="text-thistle font-medium">{metrics.devices}</span></span>
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between text-xs text-muted">
          <span>{t('metrics.requests')}</span><span>{metrics.pct_requests}%</span>
        </div>
        <ProgressBar value={metrics.pct_requests} warn={70} danger={90} />
      </div>
    </div>
  );

  if (type === 'hms') return (
    <div className="space-y-2">
      {(metrics.vps || []).map(v => (
        <div key={v.id} className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={v.state === 'running' ? 'text-celadon text-xs' : 'text-red-400 text-xs'}>●</span>
              <span className="text-thistle font-medium text-xs truncate">{v.name}</span>
            </div>
            <span className="text-muted text-xs shrink-0">{v.ipv4}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted pl-3">
            {v.datacenter && <span>📍 {v.datacenter}</span>}
            {v.vcores && <span>⚡ {v.vcores} vCore</span>}
            {v.ram_gb && <span>💾 {v.ram_gb} GB RAM</span>}
          </div>
        </div>
      ))}
    </div>
  );

  if (type === 'ultracc') return (
    <div className="space-y-1.5">
      <div className="flex gap-4 text-xs text-muted">
        <span>{t('metrics.free')} : <span className="text-thistle font-medium">{metrics.free_storage} GB</span></span>
        <span>{t('metrics.traffic')} : <span className={metrics.traffic_available < 20 ? 'text-amber-400 font-medium' : 'text-frosted font-medium'}>{metrics.traffic_available}%</span></span>
      </div>
      <ProgressBar value={100 - metrics.free_pct} warn={70} danger={90} />
    </div>
  );

  if (type === 'syncthing') return (
    <div className="space-y-2">
      {(metrics.devices || []).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted uppercase tracking-wider">{t('metrics.devices')}</p>
          {metrics.devices.map(d => (
            <div key={d.id} className="flex items-center gap-1.5 text-xs">
              <span className={d.connected ? 'text-celadon' : 'text-muted'}>●</span>
              <span className={d.connected ? 'text-thistle' : 'text-muted'}>{d.name}</span>
              {!d.connected && <span className="text-muted italic">{t('metrics.disconnected')}</span>}
            </div>
          ))}
        </div>
      )}
      {(metrics.folders || []).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted uppercase tracking-wider">{t('metrics.folders')}</p>
          {metrics.folders.map(f => {
            const synced = f.needBytes === 0 && f.state !== 'error';
            return (
              <div key={f.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={synced ? 'text-celadon' : 'text-amber-400'}>●</span>
                  <span className="text-thistle truncate">{f.label}</span>
                </div>
                <span className="text-muted shrink-0">
                  {synced ? `${f.inSyncFiles} ${t('metrics.files')}` : f.state}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (type === 'http') return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span className={metrics.ok ? 'text-celadon font-medium' : 'text-red-400 font-medium'}>
          {metrics.statusCode ?? '—'}
        </span>
        <span className="text-muted">·</span>
        <span className="text-muted">{metrics.responseTime != null ? `${metrics.responseTime}ms` : '—'}</span>
      </div>
      <p className="text-xs text-muted truncate">{metrics.url}</p>
    </div>
  );

  if (type === 'ping') return (
    <div className="flex gap-4 text-xs text-muted">
      <span>{t('metrics.latency')} <span className={metrics.latency > 200 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.latency != null ? `${metrics.latency}ms` : '—'}</span></span>
      <span>{t('metrics.loss')} <span className={metrics.loss > 0 ? 'text-amber-400 font-medium' : 'text-celadon font-medium'}>{metrics.loss}%</span></span>
      <span className="text-muted/60">:{metrics.port}</span>
    </div>
  );

  if (type === 'proxmox') return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span>CPU <span className={metrics.cpuPct > 80 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.cpuPct}%</span></span>
      <span>{t('metrics.ram')} <span className={metrics.memPct > 80 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.memPct}%</span></span>
      <span>VMs <span className="text-thistle font-medium">{metrics.vmRunning}/{metrics.vmTotal}</span></span>
      <span>LXC <span className="text-thistle font-medium">{metrics.lxcRunning}/{metrics.lxcTotal}</span></span>
    </div>
  );

  if (type === 'immich') return (
    <div className="space-y-1.5">
      <div className="flex gap-4 text-xs text-muted">
        <span>📷 <span className="text-thistle font-medium">{metrics.photos?.toLocaleString()}</span></span>
        <span>🎬 <span className="text-thistle font-medium">{metrics.videos?.toLocaleString()}</span></span>
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between text-xs text-muted">
          <span>{metrics.diskUse} {t('metrics.used')}</span><span>{metrics.diskPct}%</span>
        </div>
        <ProgressBar value={metrics.diskPct} warn={80} danger={90} />
      </div>
    </div>
  );

  if (type === 'portainer') return (
    <div className="flex gap-4 text-xs text-muted">
      <span>{t('metrics.envs')} <span className="text-thistle font-medium">{metrics.environments}</span></span>
      <span><span className="text-celadon font-medium">{metrics.containersRunning}</span> {t('metrics.running')}</span>
      <span><span className="text-muted font-medium">{metrics.containersStopped}</span> {t('metrics.stopped')}</span>
    </div>
  );

  if (type === 'ssh') return (
    <div className="space-y-1">
      {metrics.uptime && <p className="text-xs text-muted">{t('metrics.uptime')} : <span className="text-thistle">{metrics.uptime}</span></p>}
      {metrics.memPct != null && (
        <div className="flex gap-4 text-xs text-muted">
          <span>{t('metrics.ram')} <span className={metrics.memPct > 80 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.memPct}%</span></span>
          {metrics.diskPct != null && <span>{t('metrics.disk')} <span className={metrics.diskPct > 80 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.diskPct}%</span></span>}
        </div>
      )}
    </div>
  );

  return null;
}

function timeAgo(date, t) {
  if (!date) return t('time.never');
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}${t('time.sec')}`;
  if (s < 3600) return `${Math.floor(s / 60)}${t('time.min')}`;
  return `${Math.floor(s / 3600)}${t('time.hour')}`;
}

export default function Dashboard() {
  const { t } = useLang();
  const [data, setData] = useState({ monitors: [] });
  const [hist, setHist] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  async function load() {
    try {
      const [ms, h] = await Promise.all([monitorsApi.list(), historyApi.all(24)]);
      setData({ monitors: ms });
      setHist(h);
    } catch {
      // backend non dispo
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  const counts = {
    total:    data.monitors.length,
    online:   data.monitors.filter(m => m.status === 'online').length,
    warning:  data.monitors.filter(m => ['warning', 'error', 'offline'].includes(m.status)).length,
    disabled: data.monitors.filter(m => !m.enabled).length,
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('dashboard.title')}</h1>
          <p className="text-xs md:text-sm text-muted mt-0.5">{t('dashboard.subtitle')}</p>
        </div>
        <button onClick={load} className="btn-primary text-xs">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{t('dashboard.refresh')}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'dashboard.stats.total',    value: counts.total,    icon: Radio,         color: 'text-periwinkle' },
          { key: 'dashboard.stats.online',   value: counts.online,   icon: CheckCircle,   color: 'text-celadon' },
          { key: 'dashboard.stats.alerts',   value: counts.warning,  icon: AlertTriangle, color: 'text-amber-400' },
          { key: 'dashboard.stats.disabled', value: counts.disabled, icon: Clock,         color: 'text-muted' },
        ].map(({ key, value, icon: Icon, color }) => (
          <div key={key} className="card flex items-center gap-3 p-4">
            <div className={`p-2 rounded-xl bg-granite-3 shrink-0 ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-thistle leading-none">{value}</p>
              <p className="text-xs text-muted mt-0.5">{t(key)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">{t('dashboard.section')}</h2>
        {loading && <p className="text-muted text-sm">{t('dashboard.loading')}</p>}
        {!loading && data.monitors.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-muted text-sm">{t('dashboard.empty')}</p>
          </div>
        )}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.monitors.map(m => {
            const uptime = hist[m._id]?.uptime?.h24;
            return (
              <div key={m._id}
                onClick={() => setSelected(m)}
                className={`card space-y-2.5 cursor-pointer hover:border-periwinkle/40 transition-colors ${!m.enabled ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0"><ServiceIcon type={m.type} size={20} /></span>
                    <div className="min-w-0">
                      <p className="font-medium text-thistle text-sm truncate">{m.name}</p>
                      {m.description && <p className="text-xs text-muted truncate">{m.description}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={m.enabled ? m.status : 'unknown'} />
                    <div className="flex items-center gap-1.5">
                      {uptime != null && (
                        <span className={`text-xs font-medium ${uptime >= 99 ? 'text-celadon' : uptime >= 95 ? 'text-amber-400' : 'text-red-400'}`}>
                          {uptime}%
                        </span>
                      )}
                      <span className="text-xs text-muted">{timeAgo(m.lastChecked, t)}</span>
                    </div>
                  </div>
                </div>
                <MetricsBlock monitor={m} />
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <ServiceDetail monitor={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
