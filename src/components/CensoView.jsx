import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Plus, Trash2, RefreshCw, Store as StoreIcon, ChevronDown, ChevronUp, Users, UserPlus, Phone, Target } from 'lucide-react';
import { fetchCensusCounts, getCenso, saveCenso, fetchStoreUsers, setUserActiveStatus, setUserExpelled } from '../services/firebaseService';
import { toast, confirm } from '../services/toastBus';
import { LoadingLogo } from './UIComponents';
import { UserCard } from './UserCard';

// Objetivo de afiliación: con este % o más, el indicador se pone en verde.
const OBJETIVO_PCT = 30;

// Opciones de los desplegables al apuntar un futuro usuario. Las secciones son
// las mismas que usa el perfil de la app (Ajustes).
const SECCIONES = ['Sin especificar', 'Charcutería', 'Carnicería', 'Pescadería', 'Panadería/Platos', 'Frutería', 'Sala'];
const SINDICATOS = ['Sin sindicato', 'Fetico', 'Fasga', 'UGT', 'CCOO', 'Otro'];

const pctColor = (pct) => (pct === null ? '#94a3b8' : pct >= OBJETIVO_PCT ? '#059669' : '#e11d48');

/** % de afiliación: usuarios con app / (usuarios con app + futuros apuntados). */
const calcPct = (activos, futuros) => {
  const censo = activos + futuros;
  return censo === 0 ? null : Math.round((activos / censo) * 100);
};

function PctBadge({ pct, large = false }) {
  return (
    <span
      className={`font-black leading-none ${large ? 'text-3xl tracking-tighter' : 'text-sm'}`}
      style={{ color: pctColor(pct) }}
    >
      {pct === null ? '—' : `${pct}%`}
    </span>
  );
}

/**
 * CensoView — Pestaña "Censo" del delegado (sustituye a Agenda en Modo
 * Delegado). Control de afiliación por tienda y total: usuarios con la app
 * (recuentos por agregación, 2 lecturas por tienda) + "futuros usuarios"
 * apuntados a mano (todo el censo vive en UN doc: 1 lectura al cargar y
 * 1 escritura por cambio — coste mínimo a propósito).
 */
export const CensoView = React.memo(function CensoView({ user, delegado }) {
  const stores = useMemo(
    () => [...(Array.isArray(delegado?.stores) ? delegado.stores : [])].sort((a, b) => a.localeCompare(b, 'es')),
    [delegado]
  );

  const [counts, setCounts] = useState(null);      // { tienda: { users, activos } }
  const [prospects, setProspects] = useState({});  // { tienda: [{ name, phone }] }
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);
  // El formulario "Apuntar futuro usuario" va plegado: al abrir una tienda lo
  // primero que se ve son sus USUARIOS creados (petición de producto).
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSection, setNewSection] = useState(SECCIONES[0]);
  const [newSindicato, setNewSindicato] = useState(SINDICATOS[0]);
  const [busyUid, setBusyUid] = useState(null); // usuario con activación/expulsión en curso
  // Usuarios con app por tienda, cargados al ABRIR la tienda y cacheados en la
  // sesión (volver a abrirla no repite la llamada; "Actualizar" limpia la caché).
  const [storeUsers, setStoreUsers] = useState({}); // { tienda: [users] | 'loading' }

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setStoreUsers({}); // invalidar la caché de usuarios por tienda
    try {
      const [c, p] = await Promise.all([fetchCensusCounts(), getCenso(user.uid)]);
      setCounts(c);
      setProspects(p);
    } catch (e) {
      toast("No se pudo cargar el censo: " + (e?.message || e), "error");
    }
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  /** Carga (o recarga con force) los usuarios con app de una tienda. */
  const loadStoreUsers = async (store, force = false) => {
    if (!force && storeUsers[store]) return; // ya cargados o cargando
    setStoreUsers((prev) => ({ ...prev, [store]: 'loading' }));
    try {
      const list = await fetchStoreUsers(store);
      setStoreUsers((prev) => ({ ...prev, [store]: list }));
    } catch (e) {
      setStoreUsers((prev) => { const n = { ...prev }; delete n[store]; return n; });
      toast("No se pudieron cargar los usuarios: " + (e?.message || e), "error");
    }
  };

  const persist = async (next, prev) => {
    setSaving(true);
    setProspects(next);
    try {
      await saveCenso(user.uid, next);
    } catch (e) {
      setProspects(prev); // revertir si falla la escritura
      toast("No se pudo guardar: " + (e?.message || e), "error");
    }
    setSaving(false);
  };

  const addProspect = async (store) => {
    const name = newName.trim();
    if (!name) { toast("Escribe el nombre del futuro usuario.", "warning"); return; }
    const list = prospects[store] || [];
    if (list.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
      toast("Ese nombre ya está apuntado en esta tienda.", "warning");
      return;
    }
    const next = { ...prospects, [store]: [...list, { name, section: newSection, sindicato: newSindicato }] };
    setNewName("");
    setNewSection(SECCIONES[0]);
    setNewSindicato(SINDICATOS[0]);
    await persist(next, prospects);
  };

  // Expulsar desde la lista de usuarios creados: se fue de la empresa →
  // desaparece del censo y de las listas (su cuenta sigue activa, no se borra).
  const expelUser = async (store, u) => {
    const ok = await confirm(
      `¿Expulsar a ${u.fullName}? Desaparecerá de tus listas y del censo (se fue de la empresa), pero su cuenta seguirá activa por si quiere seguir usando la app. No se borra nada.`
    );
    if (!ok) return;
    setBusyUid(u.uid);
    try {
      await setUserExpelled(u.uid, true);
      setStoreUsers((prev) => ({
        ...prev,
        [store]: (Array.isArray(prev[store]) ? prev[store] : []).filter((x) => x.uid !== u.uid),
      }));
      // Descontarlo de los recuentos en local (sin gastar otra consulta).
      setCounts((prev) => prev && prev[store] ? {
        ...prev,
        [store]: {
          users: Math.max(0, prev[store].users - 1),
          activos: Math.max(0, prev[store].activos - (u.active ? 1 : 0)),
        },
      } : prev);
      toast("Usuario expulsado de tus listas.", "success");
    } catch (e) {
      toast("Error: " + (e?.message || e), "error");
    }
    setBusyUid(null);
  };

  // Activar/desactivar la cuenta desde la ficha del usuario (igual que en la
  // pestaña "Usuarios"); actualiza la lista y el recuento de activos en local.
  const toggleUserActive = async (store, u) => {
    const ok = await confirm(
      u.active
        ? `¿Desactivar la cuenta de ${u.fullName}? Solo podrá ver las noticias. No se borra ningún dato.`
        : `¿Activar la cuenta de ${u.fullName}? Podrá usar toda la app.`
    );
    if (!ok) return;
    setBusyUid(u.uid);
    try {
      await setUserActiveStatus(u.uid, !u.active);
      setStoreUsers((prev) => ({
        ...prev,
        [store]: (Array.isArray(prev[store]) ? prev[store] : []).map((x) => (x.uid === u.uid ? { ...x, active: !u.active } : x)),
      }));
      setCounts((prev) => prev && prev[store] ? {
        ...prev,
        [store]: { ...prev[store], activos: Math.max(0, prev[store].activos + (u.active ? -1 : 1)) },
      } : prev);
      toast(u.active ? "Cuenta desactivada." : "¡Cuenta activada!", "success");
    } catch (e) {
      toast("Error: " + (e?.message || e), "error");
    }
    setBusyUid(null);
  };

  const removeProspect = async (store, name) => {
    const ok = await confirm(`¿Quitar a ${name} de los futuros usuarios de ${store}?`);
    if (!ok) return;
    const next = { ...prospects, [store]: (prospects[store] || []).filter((x) => x.name !== name) };
    await persist(next, prospects);
  };

  // Totales
  const perStore = stores.map((s) => {
    const activos = counts?.[s]?.activos ?? 0;
    const futuros = (prospects[s] || []).length;
    return { store: s, activos, futuros, pct: counts ? calcPct(activos, futuros) : null };
  });
  const totalActivos = perStore.reduce((acc, s) => acc + s.activos, 0);
  const totalFuturos = perStore.reduce((acc, s) => acc + s.futuros, 0);
  const totalPct = counts ? calcPct(totalActivos, totalFuturos) : null;

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300 pb-20">
      {/* Cabecera */}
      <div className="rounded-[2rem] p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#10b981,#059669 55%,#047857)', boxShadow: '0 14px 30px -12px rgba(5,120,87,0.5), inset 0 1.5px 1px rgba(255,255,255,0.3)' }}>
        <div className="pointer-events-none absolute -top-8 -right-4 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%)' }} />
        <div className="relative flex justify-between items-center">
          <h2 className="text-sm font-black uppercase italic tracking-widest flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-white/20 shrink-0"><ClipboardList size={16} /></span>
            Censo
          </h2>
          <button onClick={load} disabled={loading} className="bg-white/15 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 active:scale-95 transition-all">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
        <p className="relative text-[10px] text-emerald-50/90 font-bold uppercase tracking-tight mt-2 leading-relaxed flex items-center gap-1.5">
          <Target size={12} /> Objetivo de afiliación: {OBJETIVO_PCT}%
        </p>
      </div>

      {/* Total */}
      <div className="rounded-[2rem] p-5" style={{ background: 'linear-gradient(180deg,#ffffff,#f8f9fb)', boxShadow: '0 14px 34px -16px rgba(30,41,59,0.25), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(15,23,42,0.05)' }}>
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Afiliación total</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
              {totalActivos} usuarios · {totalFuturos} futuros · censo {totalActivos + totalFuturos}
            </span>
          </div>
          <PctBadge pct={totalPct} large />
        </div>
        {/* Barra de progreso hacia el objetivo */}
        <div className="relative w-full h-3.5 rounded-full overflow-hidden mt-4" style={{ background: 'linear-gradient(180deg,#e6e8eb,#f1f3f5)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.14)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${Math.min(totalPct || 0, 100)}%`, background: totalPct !== null && totalPct >= OBJETIVO_PCT ? 'linear-gradient(180deg,#34d399,#059669)' : 'linear-gradient(180deg,#fb7185,#e11d48)' }}
          />
          {/* Marca del objetivo */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-slate-500/60" style={{ left: `${OBJETIVO_PCT}%` }} title={`Objetivo ${OBJETIVO_PCT}%`} />
        </div>
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 text-right">La marca es el objetivo del {OBJETIVO_PCT}%</p>
      </div>

      {/* Por tienda */}
      {loading && !counts ? (
        <div className="py-10"><LoadingLogo label="Cargando censo…" /></div>
      ) : stores.length === 0 ? (
        <div className="py-14 flex flex-col items-center opacity-50 text-center px-6">
          <ClipboardList size={40} className="text-slate-300 mb-3" />
          <p className="text-[10px] text-slate-400 italic uppercase font-bold tracking-widest leading-relaxed">
            Aún no tienes tiendas autorizadas.<br />El administrador debe asignártelas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {perStore.map(({ store, activos, futuros, pct }) => {
            const isOpen = expanded === store;
            const list = prospects[store] || [];
            const usersLoaded = storeUsers[store];
            return (
              <div key={store} className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(180deg,#ffffff,#f8f9fb)', boxShadow: '0 8px 20px -10px rgba(30,41,59,0.2), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(15,23,42,0.07)' }}>
                <button
                  onClick={() => {
                    const next = isOpen ? null : store;
                    setExpanded(next);
                    setShowAddForm(false);
                    setNewName(""); setNewSection(SECCIONES[0]); setNewSindicato(SINDICATOS[0]);
                    // Al abrir la tienda se cargan directamente sus usuarios (petición
                    // de producto: los usuarios se ven primero, sin botón intermedio).
                    if (next) loadStoreUsers(store);
                  }}
                  className="w-full text-left p-4 active:bg-slate-50 transition-colors"
                >
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                        <StoreIcon size={12} className="text-emerald-600 shrink-0" /> {store}
                      </h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-1">
                        {activos} usuarios · {futuros} futuros
                      </p>
                    </div>
                    <PctBadge pct={pct} />
                    {isOpen ? <ChevronUp size={14} className="text-slate-300 shrink-0" /> : <ChevronDown size={14} className="text-slate-300 shrink-0" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 space-y-3">
                    {/* 1) USUARIOS con la app — lo primero que se ve al abrir la
                        tienda. Cada uno con su ficha completa desplegable (misma
                        tarjeta que la pestaña "Usuarios": contacto, activación,
                        push y expulsar). */}
                    <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5">
                      <Users size={11} /> Usuarios creados ({counts?.[store]?.users ?? 0})
                    </span>
                    {!Array.isArray(usersLoaded) ? (
                      <div className="py-3"><LoadingLogo size={36} label="Cargando usuarios…" /></div>
                    ) : usersLoaded.length === 0 ? (
                      <p className="text-[9px] text-slate-400 font-bold uppercase text-center py-2">No hay usuarios en esta tienda</p>
                    ) : (
                      <div className="space-y-2 animate-in fade-in">
                        {usersLoaded.map((u) => (
                          <UserCard
                            key={u.uid}
                            u={u}
                            collapsible
                            busy={busyUid === u.uid}
                            onToggleActive={(x) => toggleUserActive(store, x)}
                            onExpel={(x) => expelUser(store, x)}
                          />
                        ))}
                      </div>
                    )}

                    {/* 2) Futuros ya apuntados */}
                    {list.length > 0 && (
                      <>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 pt-1">
                          <UserPlus size={11} /> Futuros apuntados ({list.length})
                        </span>
                        <div className="space-y-1.5">
                          {list.map((p) => (
                            <div key={p.name} className="flex items-center justify-between bg-white ring-1 ring-slate-100 rounded-xl px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-slate-700 truncate">{p.name}</p>
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                  {p.section && p.section !== 'Sin especificar' && (
                                    <span className="text-[8px] font-black uppercase text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded tracking-tight">{p.section}</span>
                                  )}
                                  {p.sindicato && p.sindicato !== 'Sin sindicato' && (
                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-tight ${p.sindicato === 'Fetico' ? 'text-emerald-700 bg-emerald-500/10' : 'text-indigo-600 bg-indigo-500/10'}`}>{p.sindicato}</span>
                                  )}
                                  {p.phone && (
                                    <a href={`tel:${p.phone}`} className="text-[9px] font-bold text-emerald-700 flex items-center gap-1"><Phone size={9} /> {p.phone}</a>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => removeProspect(store, p.name)}
                                disabled={saving}
                                className="text-rose-500 p-1.5 bg-rose-500/10 rounded-lg active:scale-90 transition-all shrink-0 ml-2"
                                aria-label={`Quitar a ${p.name}`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* 3) Apuntar futuro usuario — plegado en un desplegable
                        (antes era lo primero; ahora los usuarios van primero). */}
                    <button
                      onClick={() => setShowAddForm((v) => !v)}
                      className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all ${showAddForm ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-50 border border-emerald-100 text-emerald-700'}`}
                      aria-expanded={showAddForm}
                    >
                      <UserPlus size={11} /> Apuntar futuro usuario
                      {showAddForm ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                    {showAddForm && (
                      <div className="bg-slate-50 rounded-2xl p-3 ring-1 ring-slate-200 space-y-2 animate-in fade-in slide-in-from-top-1">
                        <input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Nombre y apellidos"
                          className="w-full bg-white border-none p-2.5 rounded-xl text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 text-slate-700"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <select
                              value={newSection}
                              onChange={(e) => setNewSection(e.target.value)}
                              aria-label="Sección"
                              className="w-full bg-white border-none p-2.5 pr-7 rounded-xl text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 text-slate-700 appearance-none font-medium"
                            >
                              {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronDown size={12} /></div>
                          </div>
                          <div className="relative">
                            <select
                              value={newSindicato}
                              onChange={(e) => setNewSindicato(e.target.value)}
                              aria-label="Sindicato"
                              className="w-full bg-white border-none p-2.5 pr-7 rounded-xl text-xs outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 text-slate-700 appearance-none font-medium"
                            >
                              {SINDICATOS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronDown size={12} /></div>
                          </div>
                        </div>
                        <button
                          onClick={() => addProspect(store)}
                          disabled={saving || !newName.trim()}
                          className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 active:scale-95 transition-all ${newName.trim() ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}
                        >
                          <Plus size={13} /> Añadir
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
