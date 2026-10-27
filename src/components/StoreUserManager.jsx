import { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Search, RefreshCw, Store as StoreIcon, ChevronDown, UserCheck, BellOff, UserMinus, Clock } from 'lucide-react';
import { fetchStoreUsers, setUserActiveStatus, setUserExpelled, setUserNoticias, adminDeleteUserAccount } from '../services/firebaseService';
import { toast, confirm } from '../services/toastBus';
import { LoadingLogo } from './UIComponents';
import { UserCard } from './UserCard';
import { formatStoreName } from '../constants/stores';

// Opción especial del selector: ver juntos TODOS los usuarios (los de todas las
// tiendas del delegado, o todos los de la app si es el admin). El backend la
// entiende y lo resuelve en UNA sola llamada. Solo con showTotal.
const TOTAL = '__ALL__';

/**
 * Filtros por ESTADO, que se aplican sobre la tienda ya elegida (o sobre el Total).
 *
 * El buscador de abajo solo sirve cuando ya sabes a quién buscas. Esto es lo
 * contrario: a quien no tiene push no se le puede avisar de nada, y a quien lleva
 * meses "Pendiente" no lo ha verificado ningún delegado — son justo las personas
 * cuyo nombre no te sabes de antemano, y sin filtro había que ir bajando tienda
 * por tienda para dar con ellas.
 *
 * "Activos" y "Pendientes" excluyen a los expulsados a propósito: en su ficha esa
 * etiqueta manda sobre las otras dos (ver UserCard), así que meterlos aquí
 * enseñaría como activa a gente que ya se fue de la empresa.
 */
const FILTROS = [
  { id: 'todos', label: 'Todos', Icon: Users, test: () => true },
  { id: 'activos', label: 'Activos', Icon: UserCheck, test: (u) => u.active && !u.expelled },
  { id: 'pendientes', label: 'Pendientes', Icon: Clock, test: (u) => !u.active && !u.expelled },
  { id: 'sinpush', label: 'Sin push', Icon: BellOff, test: (u) => !u.hasPush },
  { id: 'baja', label: 'Posible baja', Icon: UserMinus, test: (u) => u.pushMuerto },
];

/**
 * StoreUserManager — Gestor de usuarios por tienda. Hoy lo usa el panel de
 * Gestión del ADMIN (con todas las tiendas, prop admin); el delegado gestiona a
 * sus usuarios desde el CENSO (su antigua pestaña "Usuarios" ahora es
 * "Noticias", ver DelegadoNoticiasView). Lista a los usuarios con sus datos de
 * contacto, permite activar/desactivar su cuenta y EXPULSAR a quien se fue de
 * la empresa (desaparece de las vistas del delegado sin borrar ni bloquear su
 * cuenta; el admin ve a los expulsados y puede readmitirlos).
 *
 * Con `admin` aparece además el corte de NOTICIAS por usuario: elige a quién le
 * llegan las noticias y los push, sin tocarle la cuenta. Solo el admin, porque
 * también corta las suyas (las globales), no solo las del delegado.
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
  const [filtro, setFiltro] = useState('todos');
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

  // useCallback en los dos handlers: viajan como props a UserCard (memoizada) por
  // cada usuario de la lista. Recrearlos en cada render anularía ese memo justo
  // donde más importa — al teclear en el buscador de aquí arriba.
  const handleToggle = useCallback(async (u) => {
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
  }, []);

  const handleExpel = useCallback(async (u) => {
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
  }, [admin]);

  // Borrado de la cuenta: SOLO admin (la callable lo exige). Ocupa el sitio del
  // antiguo "expulsar" en este panel, y NO tiene vuelta atrás: se van el perfil,
  // los turnos y la cuenta de Auth. Por eso el aviso dice el nombre y el correo —
  // en una lista de tienda entera las fichas se parecen mucho— y avisa de que la
  // persona tendría que registrarse de nuevo.
  const handleDelete = useCallback(async (u) => {
    const ok = await confirm(
      `¿ELIMINAR la cuenta de ${u.fullName} (${u.email})? Se borran su perfil, sus turnos y su acceso. ` +
      `Esto NO se puede deshacer: si quisiera volver a usar la app, tendría que registrarse de nuevo.`
    );
    if (!ok) return;
    setTogglingUid(u.uid);
    try {
      await adminDeleteUserAccount(u.uid);
      setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
      toast(`Cuenta de ${u.fullName} eliminada.`, "success");
    } catch (e) {
      toast("Error: " + (e?.message || e), "error");
    }
    setTogglingUid(null);
  }, []);

  // Corte de noticias: SOLO admin (la callable lo exige). Es lo que decide a quién
  // llega cada noticia — el interruptor de arriba activa la CUENTA, esto el envío.
  const handleToggleNoticias = useCallback(async (u) => {
    const ok = await confirm(
      u.noticias === false
        ? `¿Volver a enviarle noticias a ${u.fullName}? Recibirá otra vez las tuyas y las de su delegado, con su push.`
        : `¿Dejar de enviarle noticias a ${u.fullName}? No recibirá ni las tuyas ni las de su delegado, ni sus push. Su cuenta no se toca: sigue usando la app.`
    );
    if (!ok) return;
    setTogglingUid(u.uid);
    try {
      const siguiente = u.noticias === false;
      await setUserNoticias(u.uid, siguiente);
      setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, noticias: siguiente } : x)));
      toast(siguiente ? "Volverá a recibir noticias." : "No recibirá más noticias ni push.", "success");
    } catch (e) {
      toast("Error: " + (e?.message || e), "error");
    }
    setTogglingUid(null);
  }, []);

  // Los contadores de cada chip salen de la tienda entera, no de lo ya filtrado:
  // son los que dicen si merece la pena pulsarlo (un "Sin push · 0" ahorra el clic).
  const conteos = useMemo(() => {
    const c = {};
    for (const f of FILTROS) c[f.id] = users.filter(f.test).length;
    return c;
  }, [users]);

  const q = search.trim().toLowerCase();
  const testFiltro = (FILTROS.find((f) => f.id === filtro) || FILTROS[0]).test;
  const filtered = users.filter(
    (u) =>
      testFiltro(u) &&
      (!q || [u.fullName, u.email, u.section, u.phone, u.rank].some((f) => (f || "").toLowerCase().includes(q)))
  );
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
            {options.map((s) => <option key={s} value={s}>{s === TOTAL ? 'Total (todas las tiendas)' : formatStoreName(s)}</option>)}
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
                {s === TOTAL ? <><Users size={12} /> Total</> : <><StoreIcon size={12} /> {formatStoreName(s)}</>}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Filtros por estado. Van en su propia fila y con el relieve "hundido" del
          resto de secundarios (fondo claro + aro) para que no compitan con los
          chips de tienda de arriba, que son los que mandan. */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" role="group" aria-label="Filtrar usuarios por estado">
        {FILTROS.map(({ id, label, Icon }) => {
          const activo = filtro === id;
          return (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              aria-pressed={activo}
              className={`shrink-0 px-3 py-2 rounded-2xl text-[9px] font-black uppercase tracking-tight flex items-center gap-1.5 transition-all active:scale-95 ring-1 ${
                activo ? 'bg-emerald-50 text-emerald-700 ring-emerald-300' : 'bg-white text-slate-400 ring-slate-200'
              }`}
            >
              <Icon size={11} /> {label}
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${activo ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {conteos[id]}
              </span>
            </button>
          );
        })}
      </div>

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
          <p className="text-[10px] text-slate-500 italic uppercase font-bold tracking-widest">
            {users.length === 0
              ? 'No hay usuarios en esta tienda'
              : q
                ? 'Sin resultados para la búsqueda'
                : 'Nadie en este filtro'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <UserCard
              key={u.uid}
              u={u}
              busy={togglingUid === u.uid}
              onToggleActive={handleToggle}
              /* Para el admin, "expulsar" ya no se ofrece: en su sitio está borrar.
                 Se conserva SOLO para READMITIR a los que expulsó un delegado antes
                 de esto — si no, se quedarían escondidos del censo para siempre. */
              onExpel={admin ? (u.expelled ? handleExpel : undefined) : handleExpel}
              onDelete={admin ? handleDelete : undefined}
              onToggleNoticias={admin ? handleToggleNoticias : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

