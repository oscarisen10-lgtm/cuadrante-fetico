import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Users, Bell, Activity, Newspaper, Send, RefreshCw, Apple, Smartphone, Globe, Timer } from 'lucide-react';
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
      {sub && <span className="text-[8px] font-bold uppercase tracking-tight text-slate-400 leading-tight">{sub}</span>}
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
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-relaxed">
              Usuarios que han abierto la app. Las versiones anteriores a agosto de 2026 no
              registraban actividad: cuentan como inactivas hasta que se actualicen.
            </p>
            <PlatformSplit ios={stats?.activos7dIos} android={stats?.activos7dAndroid} />
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
                <div className="text-[8px] font-black uppercase text-slate-400">iOS</div>
              </div>
              <div className="bg-slate-100 rounded-xl px-2 py-2.5 text-center">
                <Smartphone size={13} className="mx-auto text-slate-500 mb-1" />
                <div className="text-sm font-black text-slate-700">{stats?.android ?? '—'}</div>
                <div className="text-[8px] font-black uppercase text-slate-400">Android</div>
              </div>
              <div className="bg-slate-100 rounded-xl px-2 py-2.5 text-center">
                <Globe size={13} className="mx-auto text-slate-500 mb-1" />
                <div className="text-sm font-black text-slate-700">{stats?.web ?? '—'}</div>
                <div className="text-[8px] font-black uppercase text-slate-400">Web</div>
              </div>
            </div>
            {stats?.desconocido > 0 && (
              <p className="text-[8px] text-slate-400 uppercase font-bold text-center tracking-tight mt-2.5">
                {stats.desconocido} sin plataforma aún (apps antiguas; se registrará al actualizar)
              </p>
            )}
          </Panel>

          <Panel icon={<Newspaper size={14} className="text-emerald-600" />} title="Actividad de delegados">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard icon={<Newspaper size={15} />} label="Han publicado noticia" value={stats?.delegadosConNoticia} sub={`de ${stats?.totalDelegados ?? '—'} delegados`} tone="emerald" />
              <StatCard icon={<Send size={15} />} label="Han lanzado push" value={stats?.delegadosConPush} sub={`de ${stats?.totalDelegados ?? '—'} delegados`} tone="indigo" />
            </div>

            {delegados.length === 0 ? (
              <div className="py-6 flex flex-col items-center opacity-40">
                <Newspaper size={30} className="text-slate-300 mb-2" />
                <p className="text-[10px] text-slate-400 italic uppercase font-bold tracking-widest">Ningún delegado ha publicado aún</p>
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
