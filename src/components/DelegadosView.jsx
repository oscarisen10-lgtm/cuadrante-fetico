import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Search, Phone, Mail, Bell, BellOff, RefreshCw, Store as StoreIcon, ChevronDown, UserCheck, UserX } from 'lucide-react';
import { fetchStoreUsers, setUserActiveStatus, setUserExpelled } from '../services/firebaseService';
import { toast, confirm } from './Toast';
import { LoadingLogo } from './UIComponents';

// Opción especial del selector: ver juntos TODOS los usuarios (los de todas las
// tiendas del delegado, o todos los de la app si es el admin). El backend la
// entiende y lo resuelve en UNA sola llamada. Solo con showTotal.
const TOTAL = '__ALL__';

/**
 * StoreUserManager — Gestor de usuarios por tienda. Lo usan la vista de
 * Usuarios del delegado (con sus tiendas autorizadas y la opción "Total") y el
 * panel de Gestión del admin (con todas las tiendas, prop admin). Lista a los
 * usuarios con sus datos de contacto, permite activar/desactivar su cuenta y
 * EXPULSAR a quien se fue de la empresa (desaparece de las vistas del delegado
 * sin borrar ni bloquear su cuenta; el admin ve a los expulsados y puede
 * readmitirlos).
 */
export function StoreUserManager({ stores, showTotal = false, admin = false }) {
  const sortedStores = useMemo(
    () => [...(stores || [])].sort((a, b) => a.localeCompare(b, 'es')),
    [stores]
  );
  // "Total" solo tiene sentido con más de una tienda.
  const hasTotal = showTotal && sortedStores.length > 1;
  const options = useMemo(
    () => (hasTotal ? [TOTAL, ...sortedStores] : sortedStores),
    [hasTotal, sortedStores]
  );
  const [selectedStore, setSelectedStore] = useState(options[0] || "");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [togglingUid, setTogglingUid] = useState(null);

  // Si cambian las tiendas autorizadas y la selección ya no existe, volver a la primera opción.
  useEffect(() => {
    if (options.length > 0 && !options.includes(selectedStore)) {
      setSelectedStore(options[0]);
    }
  }, [options, selectedStore]);

  const loadUsers = useCallback(async (store) => {
    if (!store) return;
    setLoading(true);
    try {
      // El valor TOTAL también lo entiende el backend (todas las tiendas en una llamada).
      setUsers(await fetchStoreUsers(store));
    } catch (e) {
      toast("No se pudo cargar la tienda: " + (e?.message || e), "error");
      setUsers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(selectedStore); }, [selectedStore, loadUsers]);

  const handleToggle = async (u) => {
    const ok = await confirm(
      u.active
        ? `¿Desactivar la cuenta de ${u.fullName}? Solo podrá ver las noticias. No se borra ningún dato.`
        : `¿Activar la cuenta de ${u.fullName}? Podrá usar toda la app.`
    );
    if (!ok) return;
    setTogglingUid(u.uid);
    try {
      await setUserActiveStatus(u.uid, !u.active);
      setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, active: !u.active } : x)));
      toast(u.active ? "Cuenta desactivada." : "¡Cuenta activada!", "success");
    } catch (e) {
      toast("Error: " + (e?.message || e), "error");
    }
    setTogglingUid(null);
  };

  const handleExpel = async (u) => {
    const ok = await confirm(
      u.expelled
        ? `¿Readmitir a ${u.fullName}? Volverá a aparecer en las listas y el censo del delegado.`
        : `¿Expulsar a ${u.fullName}? Desaparecerá de tus listas y del censo (se fue de la empresa), pero su cuenta seguirá activa por si quiere seguir usando la app. No se borra nada.`
    );
    if (!ok) return;
    setTogglingUid(u.uid);
    try {
      await setUserExpelled(u.uid, !u.expelled);
      if (admin) {
        // El admin sigue viéndolo, con su etiqueta actualizada (puede deshacer).
        setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, expelled: !u.expelled, active: true } : x)));
      } else {
        setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
      }
      toast(u.expelled ? "Usuario readmitido." : "Usuario expulsado de tus listas.", "success");
    } catch (e) {
      toast("Error: " + (e?.message || e), "error");
    }
    setTogglingUid(null);
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) =>
        [u.fullName, u.email, u.section, u.phone].some((f) => (f || "").toLowerCase().includes(q))
      )
    : users;
  const activos = users.filter((u) => u.active).length;

  if (sortedStores.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de tienda: chips si son pocas opciones, desplegable si son muchas (admin) */}
      {options.length > 5 ? (
        <div className="relative">
          <StoreIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none" />
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-full bg-white border-none p-3 pl-9 pr-8 rounded-2xl text-sm outline-none ring-1 ring-slate-200 appearance-none font-bold text-slate-700 shadow-sm"
          >
            {options.map((s) => <option key={s} value={s}>{s === TOTAL ? 'Total (todas las tiendas)' : s}</option>)}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown size={14} />
          </div>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {options.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStore(s)}
              className={`shrink-0 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all active:scale-95 ${
                selectedStore === s ? 'text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
              }`}
              style={selectedStore === s ? { background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 5px 12px rgba(5,150,105,0.4), inset 0 1px 1px rgba(255,255,255,0.5)' } : {}}
            >
              <span className="flex items-center gap-1.5">
                {s === TOTAL ? <><Users size={12} /> Total</> : <><StoreIcon size={12} /> {s}</>}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Contador + refrescar */}
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <UserCheck size={13} className="text-emerald-600" />
          {activos} activos <span className="text-slate-300">/</span> {users.length} usuarios
        </span>
        <button
          onClick={() => loadUsers(selectedStore)}
          disabled={loading}
          className="text-[9px] font-black text-emerald-700 uppercase bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, sección..."
          className="w-full bg-white border-none p-3 pl-10 rounded-2xl text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm text-slate-700"
        />
      </div>

      {/* Lista de usuarios */}
      {loading ? (
        <div className="py-12"><LoadingLogo label="Cargando usuarios…" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-12 flex flex-col items-center opacity-40">
          <Users size={36} className="text-slate-300 mb-3" />
          <p className="text-[10px] text-slate-400 italic uppercase font-bold tracking-widest">
            {users.length === 0 ? 'No hay usuarios en esta tienda' : 'Sin resultados para la búsqueda'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div
              key={u.uid}
              className="rounded-3xl p-4"
              style={{ background: 'linear-gradient(180deg,#ffffff,#f8f9fb)', boxShadow: '0 8px 20px -10px rgba(30,41,59,0.2), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: `1px solid ${u.active ? 'rgba(16,185,129,0.25)' : 'rgba(15,23,42,0.07)'}` }}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-black text-slate-800 leading-tight truncate">{u.fullName}</h4>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-tight ${u.expelled ? 'bg-rose-500/10 text-rose-600' : u.active ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                      {u.expelled ? 'Expulsado' : u.active ? 'Activo' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">
                    {u.store} · {u.section}
                  </p>
                </div>
                {!u.expelled && (
                  <button
                    onClick={() => handleToggle(u)}
                    disabled={togglingUid === u.uid}
                    aria-label={u.active ? `Desactivar la cuenta de ${u.fullName}` : `Activar la cuenta de ${u.fullName}`}
                    className={`w-12 h-6 rounded-full relative transition-colors shrink-0 mt-1 ${u.active ? 'bg-emerald-500' : 'bg-slate-300'} ${togglingUid === u.uid ? 'opacity-50' : ''}`}
                  >
                    <div className={`absolute top-1 size-4 bg-white rounded-full shadow transition-all ${u.active ? 'left-7' : 'left-1'}`}></div>
                  </button>
                )}
              </div>

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

              {/* Expulsar (se fue de la empresa) / Readmitir (solo la ve el admin) */}
              <button
                onClick={() => handleExpel(u)}
                disabled={togglingUid === u.uid}
                className={`w-full mt-2.5 py-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all ${u.expelled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-100'} ${togglingUid === u.uid ? 'opacity-50' : ''}`}
              >
                {u.expelled ? <><UserCheck size={11} /> Readmitir</> : <><UserX size={11} /> Expulsar (se fue de la empresa)</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * DelegadosView — Espacio "Usuarios" (ocupa el hueco de Fichar solo para los
 * delegados). Cada delegado controla los usuarios de las tiendas que el admin
 * le haya autorizado: verlos con sus datos de contacto y activar/desactivar
 * sus cuentas según estén o no afiliados a FETICO. Incluye la opción "Total"
 * para ver juntos todos los usuarios que lleva.
 */
export const DelegadosView = React.memo(function DelegadosView({ delegado }) {
  const stores = Array.isArray(delegado?.stores) ? delegado.stores : [];

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300 pb-20">
      <div className="rounded-[2rem] p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#10b981,#059669 55%,#047857)', boxShadow: '0 14px 30px -12px rgba(5,120,87,0.5), inset 0 1.5px 1px rgba(255,255,255,0.3)' }}>
        <div className="pointer-events-none absolute -top-8 -right-4 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%)' }} />
        <h2 className="relative text-sm font-black uppercase italic tracking-widest flex items-center gap-2.5">
          <span className="grid place-items-center w-8 h-8 rounded-xl bg-white/20 shrink-0"><Users size={16} /></span>
          Usuarios
        </h2>
        <p className="relative text-[10px] text-emerald-50/90 font-bold uppercase tracking-tight mt-2 leading-relaxed">
          Activa las cuentas de tus afiliados y desactiva las bajas.
          {stores.length > 0 && <> Tiendas autorizadas: {stores.length}.</>}
        </p>
      </div>

      {stores.length === 0 ? (
        <div className="py-14 flex flex-col items-center opacity-50 text-center px-6">
          <Users size={40} className="text-slate-300 mb-3" />
          <p className="text-[10px] text-slate-400 italic uppercase font-bold tracking-widest leading-relaxed">
            Aún no tienes tiendas autorizadas.<br />El administrador debe asignártelas.
          </p>
        </div>
      ) : (
        <StoreUserManager stores={stores} showTotal />
      )}
    </div>
  );
});
