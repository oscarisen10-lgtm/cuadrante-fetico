import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Users, Bell, UserCheck, UserX, Plus, Trash2, RefreshCw, X, Mail, Store as StoreIcon, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { fetchAdminOverview, saveDelegado } from '../services/firebaseService';
import { STORES, S_ROMERO_STORES, ECI_STORES } from '../constants/stores';
import { COMPANY_RULES } from '../constants/config';
import { toast, confirm } from '../services/toastBus';
import { LoadingLogo } from './UIComponents';
import { StoreUserManager } from './StoreUserManager';

// Todas las tiendas seleccionables + los valores especiales que puede tener un
// perfil (ECI y cuentas auto-reparadas), para que el admin no pierda a nadie.
const ALL_STORES = [...STORES.map((s) => s.name), "En construcción", "Centro sin definir"];

// Tiendas de cada empresa (mismo filtro que en el registro y en Ajustes).
const storesForCompany = (company) => {
  let list;
  if (company === "ECI") {
    list = STORES.filter((s) => ECI_STORES.includes(s.name));
  } else if (company === "S. Romero") {
    list = STORES.filter((s) => S_ROMERO_STORES.includes(s.name));
  } else {
    list = STORES.filter((s) => !S_ROMERO_STORES.includes(s.name) && !ECI_STORES.includes(s.name));
  }
  return list.map((s) => s.name).sort((a, b) => a.localeCompare(b, 'es'));
};

function StatCard({ icon, label, value, tone = "emerald" }) {
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
    </div>
  );
}

/**
 * AdminView — Panel "Gestión" (sustituye a Agenda cuando el admin está en Modo
 * Admin). Desde aquí el admin: ve los totales (usuarios activos, pendientes,
 * con push), nombra delegados y les asigna tiendas, ve cuántos usuarios y
 * afiliados activos tiene cada delegado, y puede activar cuentas de cualquier
 * tienda directamente.
 */
export const AdminView = React.memo(function AdminView() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);        // uid del delegado desplegado
  // modal: null | { email, stores, isNew, company, storePick } — company/storePick
  // son los desplegables Empresa → Centro/Tienda con los que se añaden tiendas.
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  // `refresh` distingue la carga automática al entrar (puede servirse de la caché
  // del backend) de una recarga pedida a mano (recalcula siempre).
  const load = useCallback(async ({ refresh = false } = {}) => {
    setLoading(true);
    try {
      setOverview(await fetchAdminOverview({ refresh }));
    } catch (e) {
      toast("No se pudo cargar el panel: " + (e?.message || e), "error");
    }
    setLoading(false);
  }, []);

  const reload = useCallback(() => load({ refresh: true }), [load]);

  useEffect(() => { load(); }, [load]);

  const handleSaveDelegado = async (e) => {
    e.preventDefault();
    const email = modal.email.trim().toLowerCase();
    if (!email || !email.includes('@')) { toast("Escribe el email del delegado.", "warning"); return; }
    if (modal.stores.length === 0) { toast("Selecciona al menos una tienda.", "warning"); return; }
    setSaving(true);
    try {
      const res = await saveDelegado({ email, stores: modal.stores });
      toast(`${res.fullName || email} es delegado de ${modal.stores.length} tienda(s).`, "success");
      setModal(null);
      reload(); // acaba de cambiar el dato: hay que saltarse la caché
    } catch (err) {
      toast("Error: " + (err?.message || err), "error");
    }
    setSaving(false);
  };

  const handleRemoveDelegado = async (d) => {
    const ok = await confirm(`¿Retirar a ${d.fullName} como delegado? Su cuenta de usuario NO se toca.`);
    if (!ok) return;
    try {
      await saveDelegado({ email: d.email, remove: true });
      toast("Delegado retirado.", "success");
      reload(); // acaba de cambiar el dato: hay que saltarse la caché
    } catch (err) {
      toast("Error: " + (err?.message || err), "error");
    }
  };

  const addStoreToModal = () => {
    setModal((m) => {
      if (!m.storePick || m.stores.includes(m.storePick)) return m;
      return { ...m, stores: [...m.stores, m.storePick], storePick: "" };
    });
  };

  const removeStoreFromModal = (store) => {
    setModal((m) => ({ ...m, stores: m.stores.filter((s) => s !== store) }));
  };

  const totals = overview?.totals;
  const delegados = overview?.delegados || [];

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300 pb-20">
      {/* Cabecera */}
      <div className="rounded-[2rem] p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#1e293b,#0f172a)', boxShadow: '0 14px 30px -12px rgba(15,23,42,0.6), inset 0 1.5px 1px rgba(255,255,255,0.08)' }}>
        <div className="pointer-events-none absolute -top-8 -right-4 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)' }} />
        <div className="relative flex justify-between items-center">
          <h2 className="text-sm font-black uppercase italic tracking-widest flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0"><ShieldCheck size={16} /></span>
            Gestión
          </h2>
          <button onClick={reload} disabled={loading} className="bg-white/10 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 active:scale-95 transition-all">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Users size={15} />} label="Usuarios totales" value={totals?.total} tone="slate" />
        <StatCard icon={<UserCheck size={15} />} label="Cuentas activas" value={totals?.activos} tone="emerald" />
        <StatCard icon={<UserX size={15} />} label="Pendientes" value={totals?.pendientes} tone="amber" />
        <StatCard icon={<Bell size={15} />} label="Con push activo" value={totals?.conPush} tone="indigo" />
      </div>

      {/* Delegados */}
      <div className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(180deg,#ffffff,#f8f9fb)', boxShadow: '0 14px 34px -16px rgba(30,41,59,0.25), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(15,23,42,0.05)' }}>
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-xs font-black text-slate-800 uppercase italic tracking-widest flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600" /> Delegados
          </h3>
          <button
            onClick={() => setModal({ email: "", stores: [], isNew: true, company: "Supercor", storePick: "" })}
            className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 active:scale-95 transition-all shadow-md"
          >
            <Plus size={13} /> Nombrar
          </button>
        </div>

        {loading && !overview ? (
          <div className="py-8"><LoadingLogo label="Cargando…" /></div>
        ) : delegados.length === 0 ? (
          <div className="py-8 flex flex-col items-center opacity-40">
            <ShieldCheck size={32} className="text-slate-300 mb-2" />
            <p className="text-[10px] text-slate-400 italic uppercase font-bold tracking-widest">Aún no hay delegados nombrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {delegados.map((d) => (
              <div key={d.uid} className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <button onClick={() => setExpanded(expanded === d.uid ? null : d.uid)} className="w-full text-left p-3.5 active:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-slate-800 truncate">{d.fullName}</h4>
                      <p className="text-[9px] text-slate-400 font-bold truncate mt-0.5">{d.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-black text-emerald-700">{d.activeCount} <span className="text-slate-300 font-bold">/ {d.userCount}</span></p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">afiliados</p>
                    </div>
                    {expanded === d.uid ? <ChevronUp size={14} className="text-slate-300 shrink-0" /> : <ChevronDown size={14} className="text-slate-300 shrink-0" />}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {d.stores.map((s) => (
                      <span key={s} className="text-[8px] font-black uppercase text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-md tracking-tight">{s}</span>
                    ))}
                  </div>
                </button>

                {expanded === d.uid && (
                  <div className="px-3.5 pb-3.5 animate-in fade-in slide-in-from-top-1">
                    <div className="space-y-1.5 bg-slate-50 rounded-xl p-3">
                      {d.perStore.map((s) => (
                        <div key={s.store} className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><StoreIcon size={10} className="text-emerald-600" /> {s.store}</span>
                          <span className="text-[10px] font-black text-slate-700">{s.activos} activos <span className="text-slate-300">/ {s.users}</span></span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setModal({ email: d.email, stores: [...d.stores], isNew: false, company: "Supercor", storePick: "" })}
                        className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
                        <Pencil size={11} /> Editar tiendas
                      </button>
                      <button
                        onClick={() => handleRemoveDelegado(d)}
                        className="flex-1 bg-rose-50 text-rose-600 border border-rose-100 py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
                        <Trash2 size={11} /> Retirar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activación de cuentas por tienda (admin ve TODAS las tiendas) */}
      <div className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(180deg,#ffffff,#f8f9fb)', boxShadow: '0 14px 34px -16px rgba(30,41,59,0.25), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(15,23,42,0.05)' }}>
        <h3 className="text-xs font-black text-slate-800 uppercase italic tracking-widest flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
          <Users size={14} className="text-emerald-600" /> Cuentas por tienda
        </h3>
        <StoreUserManager stores={ALL_STORES} showTotal admin />
      </div>

      {/* Modal nombrar/editar delegado */}
      {modal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl w-full max-w-sm border border-emerald-50 animate-in zoom-in-95 flex flex-col max-h-[90dvh]">
            <div className="flex justify-between items-center mb-5 shrink-0 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-emerald-700 uppercase italic tracking-widest">
                {modal.isNew ? 'Nombrar Delegado' : 'Editar Tiendas'}
              </h3>
              <button onClick={() => setModal(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveDelegado} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide space-y-4 pb-2">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-xs font-black text-emerald-600 uppercase ml-1 tracking-tight">Email del delegado</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="email"
                      value={modal.email}
                      disabled={!modal.isNew}
                      onChange={(e) => setModal((m) => ({ ...m, email: e.target.value }))}
                      placeholder="delegado@email.com"
                      className={`w-full pl-10 p-3 text-sm border-none rounded-2xl outline-none ring-1 ring-slate-200 text-slate-800 ${!modal.isNew ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 focus:ring-2 focus:ring-emerald-500'}`}
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase ml-1 tracking-tight">Debe tener ya una cuenta en la app</p>
                </div>

                {/* Empresa → Centro/Tienda → Añadir (se pueden añadir varias tiendas) */}
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-xs font-black text-emerald-600 uppercase ml-1 tracking-tight">Añadir tienda</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <select
                        value={modal.company}
                        onChange={(e) => setModal((m) => ({ ...m, company: e.target.value, storePick: "" }))}
                        className="w-full bg-slate-50 border-none p-2.5 pr-7 rounded-xl text-xs outline-none ring-1 ring-slate-200 appearance-none font-bold text-slate-700"
                        aria-label="Empresa"
                      >
                        {Object.keys(COMPANY_RULES).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronDown size={13} /></div>
                    </div>
                    <div className="relative">
                      <select
                        value={modal.storePick}
                        onChange={(e) => setModal((m) => ({ ...m, storePick: e.target.value }))}
                        className="w-full bg-slate-50 border-none p-2.5 pr-7 rounded-xl text-xs outline-none ring-1 ring-slate-200 appearance-none font-bold text-slate-700"
                        aria-label="Centro / Tienda"
                      >
                        <option value="" disabled>Centro / Tienda...</option>
                        {storesForCompany(modal.company).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronDown size={13} /></div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addStoreToModal}
                    disabled={!modal.storePick}
                    className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all ${modal.storePick ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-300'}`}
                  >
                    <Plus size={13} /> Añadir tienda
                  </button>
                </div>

                <div className="space-y-1.5 flex flex-col">
                  <label className="text-xs font-black text-emerald-600 uppercase ml-1 tracking-tight">
                    Tiendas autorizadas ({modal.stores.length})
                  </label>
                  {modal.stores.length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight bg-slate-50 rounded-xl p-3 text-center ring-1 ring-slate-200">
                      Aún no has añadido ninguna tienda
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-2xl ring-1 ring-slate-200">
                      {modal.stores.map((s) => (
                        <span key={s} className="flex items-center gap-1.5 bg-emerald-600 text-white pl-2.5 pr-1.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tight shadow-sm">
                          {s}
                          <button
                            type="button"
                            onClick={() => removeStoreFromModal(s)}
                            className="bg-white/20 rounded-full p-0.5 active:scale-90 transition-all"
                            aria-label={`Quitar ${s}`}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className={`w-full bg-emerald-600 text-white font-black py-3.5 rounded-2xl uppercase text-xs active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2 ${saving ? 'opacity-70' : ''}`}
                >
                  {saving ? 'GUARDANDO…' : <><ShieldCheck size={16} /> {modal.isNew ? 'NOMBRAR DELEGADO' : 'GUARDAR CAMBIOS'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
