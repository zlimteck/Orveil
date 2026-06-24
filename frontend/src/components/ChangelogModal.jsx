import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Portal from './Portal';
import { useLang } from '../context/LangContext';

function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    if (/^###\s/.test(line)) return <p key={i} className="text-xs font-semibold text-thistle mt-3 mb-1">{line.replace(/^###\s/, '')}</p>;
    if (/^##\s/.test(line))  return <p key={i} className="text-sm font-bold text-thistle mt-4 mb-1">{line.replace(/^##\s/, '')}</p>;
    if (/^#\s/.test(line))   return null;
    if (/^---+$/.test(line.trim())) return <hr key={i} className="border-border my-3" />;
    if (/^\s*[-*]\s/.test(line)) {
      const content = line.replace(/^\s*[-*]\s/, '');
      return <p key={i} className="text-xs text-muted flex gap-1.5 leading-relaxed"><span className="text-muted/50 shrink-0">·</span><span>{inlineFormat(content)}</span></p>;
    }
    if (line.trim() === '') return <div key={i} className="h-1" />;
    if (/^\|/.test(line)) return null;
    return <p key={i} className="text-xs text-muted leading-relaxed">{inlineFormat(line)}</p>;
  });
}

function inlineFormat(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="text-thistle font-semibold">{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part))       return <code key={i} className="text-periwinkle bg-periwinkle/10 px-1 rounded text-[10px]">{part.slice(1, -1)}</code>;
    return part;
  });
}

export default function ChangelogModal({ onClose }) {
  const { lang } = useLang();
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('https://api.github.com/repos/zlimteck/Orveil/releases?per_page=10')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setReleases(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="bg-card border border-border w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl h-[80dvh] sm:h-auto sm:max-h-[80dvh] flex flex-col shadow-2xl overflow-hidden">

          <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-slate-600 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            <div>
              <p className="font-semibold text-thistle text-sm">{lang === 'fr' ? 'Quoi de neuf' : "What's new"}</p>
              <p className="text-xs text-muted">Orveil</p>
            </div>
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4">
            {loading && (
              <div className="space-y-4">
                {[0, 1].map(i => (
                  <div key={i} className="space-y-2 animate-pulse">
                    <div className="skeleton h-4 w-24 rounded" />
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="skeleton h-3 w-5/6 rounded" />
                    <div className="skeleton h-3 w-4/6 rounded" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="text-center py-10">
                <p className="text-sm text-thistle font-medium">{lang === 'fr' ? 'Impossible de charger les notes de version' : 'Could not load release notes'}</p>
                <p className="text-xs text-muted mt-1">{lang === 'fr' ? 'Vérifiez votre connexion internet.' : 'Check your internet connection.'}</p>
              </div>
            )}

            {!loading && !error && (
              <div className="space-y-6">
                {releases.map((release, idx) => (
                  <div key={release.id}>
                    {idx > 0 && <hr className="border-border mb-6" />}
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="text-sm font-bold text-thistle">{release.tag_name}</span>
                      {idx === 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-periwinkle/15 text-periwinkle">{lang === 'fr' ? 'Dernière' : 'Latest'}</span>}
                      <span className="text-xs text-muted">
                        {new Date(release.published_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {renderMarkdown(release.body)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
