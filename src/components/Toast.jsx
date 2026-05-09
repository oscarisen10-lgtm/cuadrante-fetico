import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// --- Toast System ---
let toastId = 0;
let addToastGlobal = null;

export function toast(message, type = 'info') {
  if (addToastGlobal) addToastGlobal({ id: ++toastId, message, type });
}

const ICONS = {
  success: <CheckCircle size={18} className="text-emerald-400 shrink-0" />,
  error: <XCircle size={18} className="text-rose-400 shrink-0" />,
  warning: <AlertTriangle size={18} className="text-amber-400 shrink-0" />,
  info: <Info size={18} className="text-sky-400 shrink-0" />,
};

const BG = {
  success: 'bg-emerald-900/95 border-emerald-700/50',
  error: 'bg-rose-900/95 border-rose-700/50',
  warning: 'bg-amber-900/95 border-amber-700/50',
  info: 'bg-slate-800/95 border-slate-600/50',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    addToastGlobal = (t) => setToasts(prev => [...prev, t]);
    return () => { addToastGlobal = null; };
  }, []);

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
      {toasts.map(t => (
        <div key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-top-2 fade-in duration-300 ${BG[t.type] || BG.info}`}
        >
          {ICONS[t.type] || ICONS.info}
          <span className="text-white text-xs font-bold flex-1 leading-snug">{t.message}</span>
          <button onClick={() => remove(t.id)} className="text-white/40 hover:text-white/80 shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Confirm Modal (replaces window.confirm) ---
let resolveConfirm = null;
let showConfirmGlobal = null;

export function confirm(message) {
  return new Promise((resolve) => {
    resolveConfirm = resolve;
    if (showConfirmGlobal) showConfirmGlobal(message);
  });
}

export function ConfirmDialog() {
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    showConfirmGlobal = (m) => setMsg(m);
    return () => { showConfirmGlobal = null; };
  }, []);

  if (!msg) return null;

  const handle = (val) => {
    setMsg(null);
    if (resolveConfirm) resolveConfirm(val);
  };

  return (
    <div className="fixed inset-0 z-[210] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white rounded-[2rem] p-6 shadow-2xl w-full max-w-xs text-center border border-slate-100 animate-in zoom-in-95">
        <div className="mb-4 text-amber-500 flex justify-center"><AlertTriangle size={40}/></div>
        <p className="text-sm font-bold text-slate-700 mb-6 leading-relaxed">{msg}</p>
        <div className="flex gap-3">
          <button onClick={() => handle(true)} className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-black text-xs uppercase shadow-md active:scale-95 transition-all">CONFIRMAR</button>
          <button onClick={() => handle(false)} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-black text-xs uppercase active:scale-95 transition-all hover:bg-slate-200">CANCELAR</button>
        </div>
      </div>
    </div>
  );
}
