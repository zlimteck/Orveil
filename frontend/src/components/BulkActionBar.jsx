import { useEffect, useState } from 'react';
import { Pin, Power, PowerOff, Trash2, X } from 'lucide-react';
import { useLang } from '../context/LangContext';

export default function BulkActionBar({ selected, items, onAction, onClear }) {
  const { t } = useLang();
  const count = selected.size;
  const allPinned = count > 0 && [...selected].every(id => items.find(m => m._id === id)?.pinned);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setConfirmDelete(false); }, [count]);

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ${count > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
      <div className="flex items-center gap-1 sm:gap-2 bg-card border border-border rounded-2xl shadow-2xl px-3 sm:px-4 py-2.5">
        {confirmDelete ? (
          <>
            <span className="text-xs text-red-400 font-medium mr-1 hidden sm:inline">
              {t('dashboard.bulkDeleteConfirm', { count })}
            </span>
            <span className="text-xs text-red-400 font-medium mr-1 sm:hidden">
              {count} ×
            </span>
            <button onClick={() => { setConfirmDelete(false); onAction('delete'); }}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors">
              <Trash2 size={13} /> {t('dashboard.bulkConfirmDelete')}
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-thistle hover:bg-granite-3 transition-colors">
              {t('dashboard.bulkCancel')}
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-thistle mr-1">
              {count} <span className="hidden sm:inline">{t('dashboard.bulkSelected')}</span>
            </span>
            <div className="w-px h-5 bg-border mx-0.5 sm:mx-1" />
            <button onClick={() => onAction(allPinned ? 'unpin' : 'pin')} title={allPinned ? t('dashboard.bulkUnpin') : t('dashboard.bulkPin')}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-periwinkle hover:bg-periwinkle/10 transition-colors">
              <Pin size={13} /> <span className="hidden sm:inline">{allPinned ? t('dashboard.bulkUnpin') : t('dashboard.bulkPin')}</span>
            </button>
            <button onClick={() => onAction('enable')} title={t('dashboard.bulkEnable')}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-celadon hover:bg-celadon/10 transition-colors">
              <Power size={13} /> <span className="hidden sm:inline">{t('dashboard.bulkEnable')}</span>
            </button>
            <button onClick={() => onAction('disable')} title={t('dashboard.bulkDisable')}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:bg-granite-3 transition-colors">
              <PowerOff size={13} /> <span className="hidden sm:inline">{t('dashboard.bulkDisable')}</span>
            </button>
            <button onClick={() => setConfirmDelete(true)} title={t('dashboard.bulkDelete')}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-400/10 transition-colors">
              <Trash2 size={13} /> <span className="hidden sm:inline">{t('dashboard.bulkDelete')}</span>
            </button>
            <div className="w-px h-5 bg-border mx-0.5 sm:mx-1" />
            <button onClick={onClear}
              className="p-1.5 rounded-lg text-muted hover:text-thistle hover:bg-granite-3 transition-colors">
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
