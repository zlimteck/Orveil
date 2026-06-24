import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Monitor, Siren, MessageSquare, FileText, X } from 'lucide-react';
import { search as searchApi } from '../api';
import { useLang } from '../context/LangContext';
import Portal from './Portal';

const SEV_COLOR = { P1: 'text-red-400', P2: 'text-amber-400', P3: 'text-periwinkle', P4: 'text-muted' };

function statusDot(status) {
  const c = status === 'online' ? 'bg-celadon' : status === 'warning' ? 'bg-amber-400' : ['error','offline'].includes(status) ? 'bg-red-400' : 'bg-muted';
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${c}`} />;
}

function ResultGroup({ icon: Icon, label, children }) {
  if (!children || children.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
        <Icon size={11} className="text-muted" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      </div>
      {children}
    </div>
  );
}

function ResultItem({ children, active, onClick, onMouseEnter }) {
  const ref = useRef(null);
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: 'nearest' }); }, [active]);
  return (
    <button ref={ref} onMouseDown={e => e.preventDefault()} onClick={onClick} onMouseEnter={onMouseEnter}
      className={`w-full text-left flex items-center gap-3 px-3 py-2 transition-colors ${active ? 'bg-periwinkle/15 text-thistle' : 'text-thistle/80 hover:bg-granite-3'}`}>
      {children}
    </button>
  );
}

export default function GlobalSearch({ onClose }) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const T = t('globalSearch');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim() || query.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const r = await searchApi.query(query.trim());
        setResults(r);
        setActiveIdx(0);
      } catch {}
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  // Flat list of all results for keyboard navigation
  const flat = results ? [
    ...results.monitors.map(m => ({ type: 'monitor', data: m })),
    ...results.incidents.map(i => ({ type: 'incident', data: i })),
    ...results.annotations.map(a => ({ type: 'annotation', data: a })),
    ...results.postmortems.map(p => ({ type: 'postmortem', data: p })),
  ] : [];

  const go = useCallback((item) => {
    if (!item) return;
    onClose();
    if (item.type === 'monitor') {
      navigate('/', { state: { openMonitorId: item.data._id } });
    } else if (item.type === 'incident') {
      navigate('/incidents', { state: { openIncidentId: item.data._id } });
    } else if (item.type === 'annotation') {
      navigate('/', { state: { openMonitorId: item.data.monitorId } });
    } else if (item.type === 'postmortem') {
      navigate('/incidents', { state: { openIncidentId: item.data._id, openPostmortem: true } });
    }
  }, [navigate, onClose]);

  function handleKey(e) {
    if (e.key === 'Escape') { onClose(); return; }
    if (flat.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(flat[activeIdx]); }
  }

  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short' }) : '';

  let globalIdx = -1;
  function item(type, data, content) {
    globalIdx++;
    const idx = globalIdx;
    return (
      <ResultItem key={`${type}-${data._id}`} active={activeIdx === idx}
        onClick={() => go({ type, data })} onMouseEnter={() => setActiveIdx(idx)}>
        {content}
      </ResultItem>
    );
  }

  const hasResults = results && (results.monitors.length + results.incidents.length + results.annotations.length + results.postmortems.length) > 0;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Input */}
          <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border">
            {loading
              ? <div className="w-4 h-4 border-2 border-periwinkle/40 border-t-periwinkle rounded-full animate-spin shrink-0" />
              : <Search size={16} className="text-muted shrink-0" />}
            <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
              onKeyDown={handleKey}
              placeholder={T.placeholder}
              className="flex-1 bg-transparent text-sm text-thistle placeholder:text-muted outline-none" />
            {query && <button onClick={onClose} className="text-muted hover:text-thistle transition-colors"><X size={14} /></button>}
          </div>

          {/* Results */}
          {hasResults && (
            <div className="overflow-y-auto max-h-[60vh] py-1">
              <ResultGroup icon={Monitor} label={T.monitors}>
                {results.monitors.map(m => item('monitor', m, <>
                  {statusDot(m.status)}
                  <span className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{m.name}</span>
                    {m.category && <span className="text-xs text-muted">{m.category}</span>}
                  </span>
                  <span className="text-xs text-muted uppercase shrink-0">{m.type}</span>
                </>))}
              </ResultGroup>

              <ResultGroup icon={Siren} label={T.incidents}>
                {results.incidents.map(i => item('incident', i, <>
                  <span className={`text-xs font-semibold shrink-0 ${SEV_COLOR[i.severity] || 'text-muted'}`}>{i.severity}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{i.monitorName}</span>
                    {i.reason && <span className="text-xs text-muted truncate block">{i.reason}</span>}
                  </span>
                  <span className="text-xs text-muted shrink-0">{fmtDate(i.startedAt)}</span>
                </>))}
              </ResultGroup>

              <ResultGroup icon={MessageSquare} label={T.annotations}>
                {results.annotations.map(a => item('annotation', a, <>
                  <MessageSquare size={13} className="text-muted shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{a.label}</span>
                    <span className="text-xs text-muted">{a.monitorName}</span>
                  </span>
                  <span className="text-xs text-muted shrink-0">{fmtDate(a.ts)}</span>
                </>))}
              </ResultGroup>

              <ResultGroup icon={FileText} label={T.postmortems}>
                {results.postmortems.map(p => item('postmortem', p, <>
                  <FileText size={13} className="text-periwinkle shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{p.monitorName}</span>
                    {p.postmortem?.summary && <span className="text-xs text-muted truncate block">{p.postmortem.summary}</span>}
                  </span>
                  <span className="text-xs text-muted shrink-0">{fmtDate(p.startedAt)}</span>
                </>))}
              </ResultGroup>
            </div>
          )}

          {results && !hasResults && query.length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-muted">
              {T.noResults} <span className="text-thistle">"{query}"</span>
            </div>
          )}

          {/* Footer hint */}
          {(hasResults || (!results && !loading)) && (
            <div className="px-3.5 py-2 border-t border-border text-[10px] text-muted flex justify-between items-center">
              <span>{T.hint}</span>
              <kbd className="bg-granite-3 border border-border rounded px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
