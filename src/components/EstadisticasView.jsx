import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Users, Bell, Activity, Newspaper, Send, RefreshCw, Apple, Smartphone, Globe, Timer, UserMinus, Layers } from 'lucide-react';
import { fetchAdminStats } from '../services/firebaseService';
import { toast } from '../services/toastBus';
import { LoadingLogo } from './UIComponents';

function StatCard({ icon, label, value, sub, tone = "emerald" }) {
  const tones = {
    emerald: { bg: 'rgba(16,185,129,0.12)', text: '#047857', iconBg: 'linear-gradient(180deg,#34d399,#059669)' },
    slate:   { bg: 'rgba(100,116,139,0.10)', text: '#334155', iconBg: 'linear-gradient(180deg,#94a3b8,#64748b)' },
    amber:   { bg: 'rgba(245,158,11,0.12)', text: '#b45309', iconBg: 'linear-gradient(180deg,#fbbf24,#d97706)' },
    indigo:  { bg: 'rgba(99,102,241,0.12)', text: '#4338ca', iconBg: 'linear-gradient(180deg,#818cf8,#4f46e5)' },
  };
  const t = tones[tone] || tones.emerald;
  return (
    <div className="rounded-3xl p-4 flex flex-col gap-2" style={{ background: t.bg, border: '1px solid rgba(15,23,42,0.05)' }}>
      <span className="grid place-items-center w-8 h-8 rounded-xl text-white" style={{ background: t.iconBg, boxShadow: '0 4px 10px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.5)' }}>
        {icon}
      </span>
      <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: t.text }}>{value ?? '—'}</span>
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-tight">{label}</span>
      {sub && <span className="text-[9px] font-bold uppercase tracking-tight text-slate-500 leading-tight">{sub}</span>}
    </div>
  );
}

/** Fila iOS / Android de una métrica que se mira por plataforma. */
function PlatformSplit({ ios, android }) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      <div className="flex items-center justify-between bg-white/70 rounded-xl px-2.5 py-2 ring-1 ring-slate-200">
        <span className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-1.5"><Apple size={11} /> iOS</span>
        <span className="text-[11px] font-black text-slate-700">{ios ?? '—'}</span>
      </div>
      <div className="flex items-center justify-between bg-white/70 rounded-xl px-2.5 py-2 ring-1 ring-slate-200">
        <span className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-1.5"><Smartphone size={11} /> Android</span>
        <span className="text-[11px] font-black text-slate-700">{android ?? '—'}</span>
      </div>
    </div>
  );
}

// Las versiones anteriores a la 3.4.0 leen los turnos en el formato diario antiguo:
// mientras alguien las use, la app tiene que seguir guardándolos también así
// (LEGACY_SHIFTS_DUAL_WRITE en services/firebaseService.js).
const necesitaFormatoAntiguo = (version) => {
  if (!/^\d+\.\d+/.test(version)) return true; // "anterior a 3.3.0"
  const [ma, mi] = version.split('.').map((n) => parseInt(n, 10) || 0);
  return ma < 3 || (ma === 3 && mi < 4);
};

function Panel({ icon, title, children }) {
  return (
    <div className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(180deg,#ffffff,#f8f9fb)', boxShadow: '0 14px 34px -16px rgba(30,41,59,0.25), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(15,23,42,0.05)' }}>
      <h3 className="text-xs font-black text-slate-800 uppercase italic tracking-widest flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * EstadisticasView — Pestaña "Estadísticas" del ADMIN (ocupa el hueco de "Fichar"
 * en Modo Admin). Reúne las cifras de uso que antes vivían escondidas en Ajustes
 * más la actividad de publicación de los delegados. Todo viene de la callable
 * adminStats, que el backend cachea unos minutos; "Actualizar" fuerza el recálculo.
 */
export const EstadisticasView = React.memo(function EstadisticasView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async ({ refresh = false } = {}) => {
    setLoading(true);
    try {
      setStats(await fetchAdminStats({ refresh }));
    } catch (e) {
      toast('No se pudieron cargar las estadísticas: ' + (e?.message || e), 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const delegados = stats?.delegadosActividad || [];
  const ventana = stats?.ventanaDias ?? 7;
  const ventanasInactividad = stats?.ventanasInactividad ?? [30, 60];

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300 pb-20">
      <div className="rounded-[2rem] p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#1e293b,#0f172a)', boxShadow: '0 14px 30px -12px rgba(15,23,42,0.6), inset 0 1.5px 1px rgba(255,255,255,0.08)' }}>
        <div className="pointer-events-none absolute -top-8 -right-4 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)' }} />
        <div className="relative flex justify-between items-center">
          <h2 className="text-sm font-black uppercase italic tracking-widest flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0"><BarChart3 size={16} /></span>
            Estadísticas
          </h2>
          <button onClick={() => load({ refresh: true })} disabled={loading} className="bg-white/10 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 active:scale-95 transition-all">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="py-10"><LoadingLogo label="Cargando…" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<Users size={15} />} label="Usuarios totales" value={stats?.total} tone="slate" />
            <StatCard icon={<Activity size={15} />} label={`Activos (${ventana} días)`} value={stats?.activos7d} tone="emerald" />
          </div>

          <Panel icon={<Activity size={14} className="text-emerald-600" />} title={`Uso en los últimos ${ventana} días`}>
            <p className="text-[11px] font-medium text-slate-500 leading-snug">
              Usuarios que han abierto la app. Las versiones anteriores a agosto de 2026 no
              registraban actividad: cuentan como inactivas hasta que se actualicen.
            </p>
            <PlatformSplit ios={stats?.activos7dIos} android={stats?.activos7dAndroid} />
          </Panel>

          {/* Abandono. A propósito NO se llama "desinstalaciones": no existe ninguna
              señal fiable de eso (ni Google ni Apple la mandan), así que se enseñan
              los dos indicios por separado y se dice qué significa cada uno. */}
          <Panel icon={<UserMinus size={14} className="text-rose-600" />} title="Posibles bajas">
            <div className="space-y-2">
              {ventanasInactividad.map((dias) => (
                <div key={dias} className="flex justify-between items-center bg-rose-500/10 rounded-2xl px-3.5 py-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    Sin abrir la app en {dias} días
                  </span>
                  <span className="text-lg font-black tracking-tighter text-rose-700">
                    {stats?.inactivos?.[dias]?.total ?? '—'}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center bg-slate-500/10 rounded-2xl px-3.5 py-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Push muerto (sin ningún dispositivo)
                </span>
                <span className="text-lg font-black tracking-tighter text-slate-700">{stats?.pushMuerto ?? '—'}</span>
              </div>
              <PlatformSplit ios={stats?.pushMuertoIos} android={stats?.pushMuertoAndroid} />
            </div>
            <p className="text-[11px] font-medium text-slate-500 leading-snug mt-3">
              Ni Apple ni Google avisan cuando alguien desinstala. «Push muerto» es lo más
              parecido: sus dispositivos ya no existen para Firebase. También sale al
              reinstalar o tras meses sin abrirla, así que es un indicio, no una baja
              confirmada. Se descubre al enviarle un aviso, no antes.
            </p>
            {stats?.sinActividad > 0 && (
              <p className="text-[11px] text-slate-500 font-medium mt-2 leading-snug">
                {stats.sinActividad} sin registro de actividad (apps anteriores a agosto de 2026): no cuentan como inactivos
              </p>
            )}
          </Panel>

          <Panel icon={<Timer size={14} className="text-amber-600" />} title="Uso de Fichar">
            <div className="flex justify-between items-center bg-amber-500/10 rounded-2xl px-3.5 py-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Han fichado alguna vez</span>
              <span className="text-lg font-black tracking-tighter text-amber-700">
                {stats?.fichadores ?? '—'}{stats?.total ? ` / ${stats.total}` : ''}
              </span>
            </div>
          </Panel>

          <Panel icon={<Bell size={14} className="text-indigo-600" />} title="Push activo">
            <div className="flex justify-between items-center bg-indigo-500/10 rounded-2xl px-3.5 py-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Dispositivos con push</span>
              <span className="text-lg font-black tracking-tighter text-indigo-700">{stats?.conPush ?? '—'}</span>
            </div>
            <PlatformSplit ios={stats?.pushIos} android={stats?.pushAndroid} />
          </Panel>

          <Panel icon={<Smartphone size={14} className="text-slate-600" />} title="Dispositivos instalados">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-100 rounded-xl px-2 py-2.5 text-center">
                <Apple size={13} className="mx-auto text-slate-500 mb-1" />
                <div className="text-sm font-black text-slate-700">{stats?.ios ?? '—'}</div>
                <div className="text-[9px] font-black uppercase text-slate-500">iOS</div>
              </div>
              <div className="bg-slate-100 rounded-xl px-2 py-2.5 text-center">
                <Smartphone size={13} className="mx-auto text-slate-500 mb-1" />
                <div className="text-sm font-black text-slate-700">{stats?.android ?? '—'}</div>
                <div className="text-[9px] font-black uppercase text-slate-500">Android</div>
              </div>
              <div className="bg-slate-100 rounded-xl px-2 py-2.5 text-center">
                <Globe size={13} className="mx-auto text-slate-500 mb-1" />
                <div className="text-sm font-black text-slate-700">{stats?.web ?? '—'}</div>
                <div className="text-[9px] font-black uppercase text-slate-500">Web</div>
              </div>
            </div>
            {stats?.desconocido > 0 && (
              <p className="text-[11px] text-slate-500 font-medium text-center mt-2.5">
                {stats.desconocido} sin plataforma aún (apps antiguas; se registrará al actualizar)
              </p>
            )}
          </Panel>

          {/* Versiones instaladas (auditoría 25-oct-2026): dice cuándo se puede retirar
              lo que solo existe por las apps viejas. Requiere la function adminStats
              actualizada; con la anterior, este panel no sale. */}
          {Array.isArray(stats?.versiones) && stats.versiones.length > 0 && (
            <Panel icon={<Layers size={14} className="text-slate-600" />} title="Versiones instaladas">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 items-center text-[10px]">
                <span className="font-black uppercase tracking-widest text-slate-400">Versión</span>
                <span className="font-black uppercase tracking-widest text-slate-400 text-right">Usuarios</span>
                <span className="font-black uppercase tracking-widest text-slate-400 text-right">Activos {stats.ventanaVersionesDias ?? 30} d</span>
                {stats.versiones.map((v) => {
                  const vieja = necesitaFormatoAntiguo(v.version);
                  return (
                    <React.Fragment key={v.version}>
                      <span className={`font-black ${vieja ? 'text-amber-700' : 'text-slate-700'}`}>{v.version}</span>
                      <span className="font-black text-slate-700 text-right tabular-nums">{v.total}</span>
                      <span className="font-bold text-slate-500 text-right tabular-nums">{v.activos ?? '—'}</span>
                    </React.Fragment>
                  );
                })}
              </div>
              <p className="text-[11px] font-medium text-slate-500 leading-snug mt-3">
                En ámbar, las versiones anteriores a la 3.4.0: mientras alguien las use, los
                turnos se siguen guardando también en el formato antiguo. «—» = esa versión
                aún no registraba actividad (anteriores a la 3.6.0), así que no se sabe si la abren.
              </p>
            </Panel>
          )}

          <Panel icon={<Newspaper size={14} className="text-emerald-600" />} title="Actividad de delegados">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard icon={<Newspaper size={15} />} label="Han publicado noticia" value={stats?.delegadosConNoticia} sub={`de ${stats?.totalDelegados ?? '—'} delegados`} tone="emerald" />
              <StatCard icon={<Send size={15} />} label="Han lanzado push" value={stats?.delegadosConPush} sub={`de ${stats?.totalDelegados ?? '—'} delegados`} tone="indigo" />
            </div>

            {delegados.length === 0 ? (
              <div className="py-6 flex flex-col items-center opacity-40">
                <Newspaper size={30} className="text-slate-300 mb-2" />
                <p className="text-[10px] text-slate-500 italic uppercase font-bold tracking-widest">Ningún delegado ha publicado aún</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {delegados.map((d) => (
                  <div key={d.uid} className="flex justify-between items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 ring-1 ring-slate-100">
                    <span className="text-[10px] font-black text-slate-700 truncate">{d.nombre}</span>
                    <span className="flex gap-2 shrink-0">
                      <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Newspaper size={9} /> {d.noticias}
                      </span>
                      <span className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Send size={9} /> {d.pushes}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
});
