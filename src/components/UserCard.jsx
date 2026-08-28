import React, { useState } from 'react';
import { Phone, Mail, Bell, BellOff, UserCheck, UserX, ChevronDown, ChevronUp, Activity, UserMinus } from 'lucide-react';
import { formatStoreName } from '../constants/stores';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Cómo se resume "cuándo abrió la app por última vez".
 *
 * `null` NO es "hace mucho": es que su app no sella actividad (anteriores a agosto
 * de 2026). Pintarlo como abandono acusaría de baja a gente que quizá entra a
 * diario, así que tiene su propia etiqueta gris.
 */
const resumenActividad = (lastActiveAt) => {
  if (typeof lastActiveAt !== 'number') {
    return {
      label: 'Sin datos',
      tone: 'text-slate-400 bg-slate-50',
      title: 'Su versión de la app no registra actividad (anterior a agosto de 2026). No significa que no la use.',
    };
  }
  const dias = Math.floor((Date.now() - lastActiveAt) / DIA_MS);
  const fecha = new Date(lastActiveAt).toLocaleDateString('es-ES');
  const title = `Última vez que abrió la app: ${fecha}`;
  if (dias <= 7) return { label: 'Activo', tone: 'text-emerald-600 bg-emerald-50', title };
  if (dias <= 30) return { label: `Hace ${dias} días`, tone: 'text-slate-500 bg-slate-50', title };
  if (dias <= 60) return { label: `Hace ${dias} días`, tone: 'text-amber-600 bg-amber-50', title };
  return { label: `Hace ${dias} días`, tone: 'text-rose-600 bg-rose-50', title };
};

/**
 * UserCard — Ficha de usuario compartida por la pestaña "Usuarios" (delegado y
 * admin) y por el Censo: nombre + estado, tienda · sección, interruptor de
 * activación, contacto (teléfono/email/push) y expulsar/readmitir.
 *
 * `collapsible`: empieza plegada (solo nombre, estado y el interruptor) y se
 * abre al tocar el nombre — así el Censo puede listar tiendas enteras sin
 * ocupar media pantalla por usuario. En "Usuarios" va siempre abierta.
 *
 * React.memo: se pinta en listas de tienda entera bajo un buscador con estado
 * local (StoreUserManager). Sin memo, cada pulsación en ese buscador volvía a
 * renderizar TODAS las fichas, aunque sus props no hubieran cambiado.
 */
export const UserCard = React.memo(function UserCard({ u, collapsible = false, busy = false, onToggleActive, onExpel }) {
  const [open, setOpen] = useState(!collapsible);
  const actividad = resumenActividad(u.lastActiveAt);

  const meta = (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="text-sm font-black text-slate-800 leading-tight truncate">{u.fullName}</h4>
        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-tight ${u.expelled ? 'bg-rose-500/10 text-rose-600' : u.active ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
          {u.expelled ? 'Expulsado' : u.active ? 'Activo' : 'Pendiente'}
        </span>
      </div>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">
        {formatStoreName(u.store)} · {u.section}
      </p>
    </>
  );

  return (
    <div
      className="rounded-3xl p-4"
      style={{ background: 'linear-gradient(180deg,#ffffff,#f8f9fb)', boxShadow: '0 8px 20px -10px rgba(30,41,59,0.2), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: `1px solid ${u.active ? 'rgba(16,185,129,0.25)' : 'rgba(15,23,42,0.07)'}` }}
    >
      <div className="flex justify-between items-start gap-3">
        {collapsible ? (
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
            aria-expanded={open}
            aria-label={`${open ? 'Cerrar' : 'Ver'} la ficha de ${u.fullName}`}
          >
            {meta}
          </button>
        ) : (
          <div className="flex-1 min-w-0">{meta}</div>
        )}
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {!u.expelled && onToggleActive && (
            <button
              onClick={() => onToggleActive(u)}
              disabled={busy}
              aria-label={u.active ? `Desactivar la cuenta de ${u.fullName}` : `Activar la cuenta de ${u.fullName}`}
              className={`w-12 h-6 rounded-full relative transition-colors ${u.active ? 'bg-emerald-500' : 'bg-slate-300'} ${busy ? 'opacity-50' : ''}`}
            >
              <div className={`absolute top-1 size-4 bg-white rounded-full shadow transition-all ${u.active ? 'left-7' : 'left-1'}`}></div>
            </button>
          )}
          {collapsible && (
            <button onClick={() => setOpen((o) => !o)} className="text-slate-300 p-0.5 active:scale-90 transition-transform" tabIndex={-1} aria-hidden="true">
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className={collapsible ? 'animate-in fade-in slide-in-from-top-1' : ''}>
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            {u.phone ? (
              <a href={`tel:${u.phone}`} className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-xl active:scale-95 transition-all">
                <Phone size={11} /> {u.phone}
              </a>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-slate-50 px-2.5 py-1.5 rounded-xl">
                <Phone size={11} /> Sin teléfono
              </span>
            )}
            {u.email && (
              <a href={`mailto:${u.email}`} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-xl active:scale-95 transition-all min-w-0">
                <Mail size={11} className="shrink-0" /> <span className="truncate max-w-[160px]">{u.email}</span>
              </a>
            )}
            <span
              className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-1.5 rounded-xl ml-auto ${u.hasPush ? 'text-emerald-600 bg-emerald-50' : 'text-slate-300 bg-slate-50'}`}
              title={u.hasPush ? 'Notificaciones push activadas' : 'Sin notificaciones push'}
            >
              {u.hasPush ? <Bell size={11} /> : <BellOff size={11} />} Push
            </span>
          </div>

          {/* Última vez que abrió la app, y si sus dispositivos ya no existen para
              Firebase. Es lo más cerca que se puede estar de saber quién la ha
              desinstalado: nadie lo notifica. */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={`flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-1.5 rounded-xl ${actividad.tone}`}
              title={actividad.title}
            >
              <Activity size={11} /> {actividad.label}
            </span>
            {u.pushMuerto && (
              <span
                className="flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-1.5 rounded-xl text-rose-600 bg-rose-50"
                title="Firebase rechazó sus dispositivos al enviarle un aviso: probablemente desinstaló la app. Se corrige solo si vuelve a abrirla."
              >
                <UserMinus size={11} /> Posible baja
              </span>
            )}
          </div>

          {/* Expulsar (se fue de la empresa) / Readmitir (solo la ve el admin) */}
          {onExpel && (
            <button
              onClick={() => onExpel(u)}
              disabled={busy}
              className={`w-full mt-2.5 py-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all ${u.expelled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-100'} ${busy ? 'opacity-50' : ''}`}
            >
              {u.expelled ? <><UserCheck size={11} /> Readmitir</> : <><UserX size={11} /> Expulsar (se fue de la empresa)</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
});
