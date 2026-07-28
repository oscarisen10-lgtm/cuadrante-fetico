import { Lock } from 'lucide-react';

/**
 * ActivationGateModal — Aviso para cuentas PENDIENTES DE ACTIVACIÓN.
 *
 * Ya NO se bloquean pantallas enteras: Fichar está abierto del todo, y la Agenda
 * y los Permisos SE VEN — este modal aparece solo al intentar USAR lo bloqueado
 * (registrar un libre/vacaciones/horas, o abrir el detalle de un permiso).
 * La cuenta no se borra nunca: cuando el administrador la active, la app se
 * desbloquea al momento (el estado llega en vivo por el snapshot del perfil).
 */
export function ActivationGateModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in"
      role="dialog" aria-modal="true" aria-label="Cuenta pendiente de activación"
      onClick={onClose}
    >
      <div
        className="rounded-[2rem] p-6 w-full max-w-xs text-center animate-in zoom-in-95"
        style={{ background: 'linear-gradient(180deg,#ffffff,#f4f5f7)', boxShadow: '0 24px 60px rgba(0,0,0,0.4), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.05)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-full"
          style={{ background: 'linear-gradient(180deg,#f1f3f5,#e2e5e9)', boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.9), 0 8px 18px rgba(15,40,30,0.14)' }}
          aria-hidden="true"
        >
          <Lock size={30} className="text-slate-400" />
        </div>
        <h3 className="text-base font-black text-slate-800 mb-3 uppercase italic leading-tight tracking-tight">
          Cuenta pendiente<br />de activación
        </h3>
        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-2">
          Esta sección se desbloquea verificando el usuario.
        </p>
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-6">
          Habla con el administrador<br />para activar la cuenta
        </p>
        <button
          onClick={onClose}
          className="btn3d w-full text-white font-black py-3.5 rounded-2xl uppercase text-xs"
          style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 8px 18px rgba(5,150,105,0.4), inset 0 1.5px 1px rgba(255,255,255,0.45)' }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
