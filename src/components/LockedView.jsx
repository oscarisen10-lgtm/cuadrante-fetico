import React from 'react';
import { Lock, Newspaper } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * LockedView — Pantalla que ven las cuentas PENDIENTES DE ACTIVACIÓN en las
 * secciones bloqueadas (Fichar, Agenda, Permisos). La cuenta no se borra nunca:
 * un delegado de FETICO la activa (o reactiva) y la app se desbloquea al momento
 * (el estado llega en vivo por el snapshot del perfil).
 */
export function LockedView() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 animate-in fade-in duration-300">
      <div
        className="w-24 h-24 mb-6 grid place-items-center rounded-full"
        style={{ background: 'linear-gradient(180deg,#f1f3f5,#e2e5e9)', boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.9), 0 10px 24px rgba(15,40,30,0.12)' }}
        aria-hidden="true"
      >
        <Lock size={40} className="text-slate-400" />
      </div>
      <h2 className="text-lg font-black text-slate-800 uppercase italic tracking-tight leading-none mb-3">
        Cuenta pendiente<br />de activación
      </h2>
      <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mb-2">
        Esta sección se desbloquea cuando tu <span className="font-black text-emerald-700">delegado de FETICO</span> verifique
        tu afiliación y active tu cuenta.
      </p>
      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-8">
        Habla con el delegado de tu tienda
      </p>
      <button
        onClick={() => navigate('/dashboard')}
        className="btn3d flex items-center gap-2 text-white font-black px-7 py-3.5 rounded-2xl uppercase text-xs"
        style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 8px 18px rgba(5,150,105,0.4), inset 0 1.5px 1px rgba(255,255,255,0.45)' }}
      >
        <Newspaper size={16} /> Ver Noticias
      </button>
    </div>
  );
}
