import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { registerToastHandler, registerConfirmHandler, resolvePendingConfirm } from '../services/toastBus';

// Este fichero exporta SOLO componentes. La API imperativa (`toast`, `confirm`) vive
// en services/toastBus.js para no romper el Fast Refresh — impórtala desde allí.

const ICONS = {
  success: <CheckCircle size={17} className="text-white" />,
  error: <XCircle size={17} className="text-white" />,
  warning: <AlertTriangle size={17} className="text-white" />,
  info: <Info size={17} className="text-white" />,
};

const ACCENT = {
  success: { bar: '5,150,105', chip: 'linear-gradient(180deg,#34d399,#059669)' },
  error: { bar: '225,29,72', chip: 'linear-gradient(180deg,#fb7185,#e11d48)' },
  warning: { bar: '217,119,6', chip: 'linear-gradient(180deg,#fbbf24,#d97706)' },
  info: { bar: '2,132,199', chip: 'linear-gradient(180deg,#38bdf8,#0284c7)' },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => registerToastHandler((t) => setToasts(prev => [...prev, t])), []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => remove(toasts[0].id), 3500);
      return () => clearTimeout(timer);
    }
  }, [toasts, remove]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map(t => {
        const a = ACCENT[t.type] || ACCENT.info;
        return (
          <div key={t.id}
            className="pointer-events-auto relative flex items-center gap-3 pl-4 pr-2.5 py-3 rounded-2xl overflow-hidden animate-in slide-in-from-top-3 fade-in zoom-in-95 duration-300"
            style={{ background: 'linear-gradient(180deg, rgba(28,30,38,0.97), rgba(16,18,25,0.97))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: `0 14px 32px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.08)`, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: a.chip }} />
            <div className="grid place-items-center w-8 h-8 rounded-xl shrink-0" style={{ background: a.chip, boxShadow: `0 4px 9px rgba(${a.bar},0.45), inset 0 1px 1px rgba(255,255,255,0.45)` }}>
              {ICONS[t.type] || ICONS.info}
            </div>
            <span className="text-white text-xs font-bold flex-1 leading-snug">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-white/40 hover:text-white/80 shrink-0 p-1.5">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// --- Confirm Modal (replaces window.confirm) ---
export function ConfirmDialog() {
  const [msg, setMsg] = useState(null);

  useEffect(() => registerConfirmHandler((m) => setMsg(m)), []);

  if (!msg) return null;

  const handle = (val) => {
    setMsg(null);
    resolvePendingConfirm(val);
  };

  return (
    <div className="fixed inset-0 z-[210] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
      <div className="rounded-[2rem] p-6 w-full max-w-xs text-center animate-in zoom-in-95" style={{ background: 'linear-gradient(180deg,#ffffff,#f4f5f7)', boxShadow: '0 24px 60px rgba(0,0,0,0.4), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-full text-white" style={{ background: 'linear-gradient(180deg,#fbbf24,#d97706)', boxShadow: '0 8px 18px rgba(217,119,6,0.45), inset 0 2px 2px rgba(255,255,255,0.55)' }}><AlertTriangle size={32}/></div>
        <p className="text-sm font-bold text-slate-700 mb-6 leading-relaxed">{msg}</p>
        <div className="flex gap-3">
          <button onClick={() => handle(true)} className="btn3d flex-1 text-white py-3.5 rounded-2xl font-black text-xs uppercase" style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 6px 14px rgba(5,150,105,0.4), inset 0 1.5px 1px rgba(255,255,255,0.45)' }}>CONFIRMAR</button>
          <button onClick={() => handle(false)} className="btn3d flex-1 text-slate-600 py-3.5 rounded-2xl font-black text-xs uppercase" style={{ background: 'linear-gradient(180deg,#f1f3f5,#e2e5e9)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.08)' }}>CANCELAR</button>
        </div>
      </div>
    </div>
  );
}
