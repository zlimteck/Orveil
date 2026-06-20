import React, { useState, useEffect, useMemo } from 'react';
import { stats as api, incidents as incidentsApi } from '../api';
import { useLang } from '../context/LangContext';
import { Activity, AlertTriangle, CheckCircle, TrendingUp, Bell } from 'lucide-react';

function duration(ms) {
  if (!ms) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}min` : `${h}h`;
}

function StatCard({ icon: Icon, label, value, color = 'text-thistle' }) {
  return (
    <div className="card flex items-center gap-3 py-3 px-4">
      <Icon size={18} className={`shrink-0 ${color}`} />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value ?? '—'}</p>
      </div>
    </div>
  );
}

function TrendBadge({ trend }) {
  if (trend == null) return null;
  if (trend > 2)  return <span className="text-xs font-mono text-celadon w-14 text-right shrink-0">↑ +{trend}%</span>;
  if (trend < -2) return <span className="text-xs font-mono text-red-400 w-14 text-right shrink-0">↓ {trend}%</span>;
  return <span className="text-xs font-mono text-muted w-14 text-right shrink-0">→</span>;
}

function UptimeRow({ monitor }) {
  const uptime = monitor.uptime;
  const color = uptime == null ? 'bg-granite/30' : uptime >= 99 ? 'bg-celadon/70' : uptime >= 90 ? 'bg-amber-400/70' : 'bg-red-400/70';
  const textColor = uptime == null ? 'text-muted' : uptime >= 99 ? 'text-celadon' : uptime >= 90 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-sm text-thistle truncate flex-1 min-w-0">{monitor.name}</span>
      <div className="w-32 h-2 bg-granite-3 rounded-full overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${uptime ?? 0}%` }} />
      </div>
      <span className={`text-xs font-mono w-10 text-right shrink-0 ${textColor}`}>
        {uptime != null ? `${uptime}%` : '—'}
      </span>
      <TrendBadge trend={monitor.trend} />
    </div>
  );
}

function Heatmap({ incidents, lang }) {
  const days = lang === 'fr'
    ? ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
    : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  const [tooltip, setTooltip] = useState(null);

  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const inc of incidents) {
      const d = new Date(inc.startedAt);
      const day = (d.getDay() + 6) % 7;
      const hour = d.getHours();
      g[day][hour]++;
    }
    return g;
  }, [incidents]);

  const maxCount = useMemo(() => Math.max(...grid.flat(), 1), [grid]);

  return (
    <div className="card px-4 py-3 overflow-x-auto relative">
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 px-2 py-1 rounded text-xs text-thistle bg-surface border border-border shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -110%)' }}
        >
          <span className="font-semibold">{tooltip.day} {tooltip.hour}h</span>
          {' — '}
          {tooltip.count} incident{tooltip.count > 1 ? 's' : ''}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '2rem repeat(24, 1fr)', gap: '2px', minWidth: '480px' }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center" style={{ fontSize: '9px', color: 'var(--color-muted, #888)' }}>
            {h % 3 === 0 ? `${h}h` : ''}
          </div>
        ))}
        {grid.map((row, dayIdx) => (
          <React.Fragment key={dayIdx}>
            <div className="flex items-center justify-end pr-1" style={{ fontSize: '10px', color: 'var(--color-muted, #888)' }}>
              {days[dayIdx]}
            </div>
            {row.map((count, hour) => {
              const intensity = count === 0 ? 0 : 0.15 + (count / maxCount) * 0.85;
              const bg = count === 0
                ? 'rgba(96,165,250,0.07)'
                : `rgba(228,87,87,${intensity.toFixed(2)})`;
              return (
                <div
                  key={hour}
                  style={{ background: bg, borderRadius: '2px', aspectRatio: '1', cursor: count > 0 ? 'default' : undefined }}
                  onMouseEnter={count > 0 ? (e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const parent = e.currentTarget.closest('.card').getBoundingClientRect();
                    setTooltip({ day: days[dayIdx], hour, count, x: rect.left - parent.left + rect.width / 2, y: rect.top - parent.top });
                  } : undefined}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default function Stats() {
  const { t, lang } = useLang();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allIncidents, setAllIncidents] = useState([]);

  useEffect(() => {
    api.get().then(setData).catch(() => {}).finally(() => setLoading(false));
    incidentsApi.list({ limit: 1000 }).then(setAllIncidents).catch(() => {});
  }, []);

  if (loading) return <div className="p-6 text-muted text-sm">{t('stats.loading')}</div>;
  if (!data)   return <div className="p-6 text-red-400 text-sm">Erreur de chargement</div>;
  const past90 = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const heatmapIncidents = allIncidents.filter(i => new Date(i.startedAt) >= past90);

  const { monitors, incidents, uptimeByMonitor, logsByLevel } = data;
  const totalSev = Object.values(incidents.severityCount || {}).reduce((s, v) => s + v, 0);
  const totalNotifs = Object.values(logsByLevel).reduce((s, v) => s + v, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('stats.title')}</h1>
        <p className="text-xs md:text-sm text-muted mt-0.5">{t('stats.subtitle')}</p>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.monitors')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Activity} label={t('dashboard.stats.total')} value={monitors.total} />
          <StatCard icon={CheckCircle} label={t('stats.online')} value={monitors.online} color="text-celadon" />
          <StatCard icon={AlertTriangle} label={t('stats.alerting')} value={monitors.alerting} color={monitors.alerting > 0 ? 'text-red-400' : 'text-muted'} />
          <StatCard icon={Activity} label={t('stats.disabled')} value={monitors.total - monitors.enabled} color="text-muted" />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.incidents')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={AlertTriangle} label={t('stats.open')} value={incidents.open} color={incidents.open > 0 ? 'text-red-400' : 'text-muted'} />
          <StatCard icon={CheckCircle} label={t('stats.resolved')} value={incidents.resolved} color="text-celadon" />
          <StatCard icon={TrendingUp} label="MTTR" value={duration(incidents.mttr)} />
          <StatCard icon={TrendingUp} label={t('stats.avgDuration')} value={duration(incidents.avgDuration)} color="text-muted" />
        </div>

        {totalSev > 0 && (
          <div className="card px-4 py-3 mt-3 space-y-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">{t('stats.severityBreakdown')}</p>
            {[
              { key: 'P1', color: 'bg-red-400',     label: t('stats.severity.P1') },
              { key: 'P2', color: 'bg-amber-400',   label: t('stats.severity.P2') },
              { key: 'P3', color: 'bg-periwinkle',  label: t('stats.severity.P3') },
              { key: 'P4', color: 'bg-granite',     label: t('stats.severity.P4') },
            ].map(({ key, color, label }) => {
              const count = incidents.severityCount?.[key] || 0;
              const mttr  = incidents.mttrBySeverity?.[key];
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className={`text-xs font-semibold w-6 shrink-0 ${color.replace('bg-','text-')}`}>{key}</span>
                  <div className="flex-1 h-1.5 bg-granite-3 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: totalSev > 0 ? `${(count / totalSev) * 100}%` : '0%' }} />
                  </div>
                  <span className="text-xs text-muted w-4 text-right shrink-0">{count}</span>
                  {mttr
                    ? <span className="text-xs text-muted/50 w-20 text-right shrink-0">MTTR {duration(mttr)}</span>
                    : <span className="w-20 shrink-0" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.notifications')}</h2>
        <div className="card px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Total</span>
            <span className="font-bold text-thistle">{totalNotifs}</span>
          </div>
          {Object.entries(logsByLevel).map(([level, count]) => (
            <div key={level} className="flex items-center gap-3">
              <span className="text-xs text-muted w-16 capitalize">{level}</span>
              <div className="flex-1 h-1.5 bg-granite-3 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${
                  level === 'error'   ? 'bg-red-400' :
                  level === 'warning' ? 'bg-amber-400' :
                  level === 'success' ? 'bg-celadon' :
                  'bg-periwinkle/50'
                }`} style={{ width: totalNotifs > 0 ? `${(count / totalNotifs) * 100}%` : '0%' }} />
              </div>
              <span className="text-xs font-mono text-muted w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.uptimeTitle')}</h2>
        {uptimeByMonitor.length === 0 ? (
          <p className="text-sm text-muted">{t('stats.noData')}</p>
        ) : (
          <div className="card px-4 divide-y divide-border">
            {uptimeByMonitor.map(m => <UptimeRow key={m.id} monitor={m} />)}
          </div>
        )}
      </div>

      {heatmapIncidents.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.heatmapTitle')}</h2>
          <Heatmap incidents={heatmapIncidents} lang={lang} />
        </div>
      )}
    </div>
  );
}
