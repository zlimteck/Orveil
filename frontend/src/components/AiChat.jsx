import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, Trash2 } from 'lucide-react';
import { ai as aiApi } from '../api';
import { useLang } from '../context/LangContext';

function Message({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-periwinkle/20 border border-periwinkle/30 flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={13} className="text-periwinkle" />
        </div>
      )}
      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-periwinkle/20 text-ink border border-periwinkle/30 rounded-tr-sm'
          : 'bg-surface border border-border text-ink rounded-tl-sm'
      }`}>
        {content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full bg-periwinkle/20 border border-periwinkle/30 flex items-center justify-center shrink-0">
        <Bot size={13} className="text-periwinkle" />
      </div>
      <div className="px-3 py-2.5 rounded-xl rounded-tl-sm bg-surface border border-border flex items-center gap-1">
        {[0,1,2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

export default function AiChat({ configured }) {
  const { t } = useLang();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef  = useRef();
  const inputRef   = useRef();

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);


  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const { reply } = await aiApi.chat(history);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${err.response?.data?.error || err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  if (!configured) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-4 right-4 z-[150] w-11 h-11 rounded-full border shadow-lg flex items-center justify-center transition-all duration-300 ${
          open
            ? 'bg-periwinkle border-periwinkle text-white opacity-100'
            : 'bg-card border-border text-periwinkle opacity-30 hover:opacity-100 hover:border-periwinkle/50'
        }`}
        title={t('ai.toggle')}
      >
        {open ? <X size={18} /> : <Bot size={18} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-16 right-4 z-[150] w-[min(360px,calc(100vw-2rem))] h-[min(500px,calc(100vh-6rem))] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
            <div className="w-7 h-7 rounded-full bg-periwinkle/20 border border-periwinkle/30 flex items-center justify-center">
              <Bot size={14} className="text-periwinkle" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-thistle">{t('ai.title')}</p>
              <p className="text-xs text-muted">{t('ai.subtitle')}</p>
            </div>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} title={t('ai.clear')} className="p-1.5 rounded-lg text-muted hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
                <Bot size={28} className="text-muted/40" />
                <p className="text-sm text-muted">{t('ai.empty')}</p>
                <div className="flex flex-col gap-1.5 w-full mt-2">
                  {(t('ai.suggestions') || []).map((s, i) => (
                    <button key={i} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                      className="text-xs text-left px-3 py-2 rounded-lg border border-border hover:border-periwinkle/40 hover:bg-periwinkle/5 text-muted hover:text-ink transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => <Message key={i} {...m} />)}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-border shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={t('ai.placeholder')}
                rows={1}
                className="flex-1 resize-none input text-sm py-2 max-h-24 overflow-y-auto"
                style={{ height: 'auto' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'; }}
                disabled={loading}
              />
              <button onClick={send} disabled={!input.trim() || loading}
                className="btn-primary p-2 h-9 w-9 shrink-0 disabled:opacity-40">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-muted/50 mt-1.5 text-center">{t('ai.hint')}</p>
          </div>
        </div>
      )}
    </>
  );
}
