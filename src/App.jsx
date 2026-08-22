import { useState, useEffect, useMemo, Suspense, lazy, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { SplashScreen } from '@capacitor/splash-screen';
import { Network } from '@capacitor/network';
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { useAuth } from './hooks/useAuth';
import { useNews } from './hooks/useNews';
import { useTimer } from './hooks/useTimer';
import { useShifts } from './hooks/useShifts';
import { useNotifications } from './hooks/useNotifications';
import { Clock, Calendar as CalendarIcon, PieChart, FileText, Settings, LogOut, WifiOff, Fingerprint, X, Newspaper, ShieldCheck, ClipboardList, BarChart3 } from 'lucide-react';
import { getFormattedDate } from './utils/dateUtils';
import { isAdminUser } from './constants/config';
import { markFichado } from './services/firebaseService';
import { NavItem, LoadingLogo } from './components/UIComponents';
import AuthView from './components/AuthView';
import { ToastContainer, ConfirmDialog } from './components/Toast';
import { DashboardView } from './components/DashboardView';
import { useScreenTips } from './hooks/useScreenTips';

const TrackerView = lazy(() => import('./components/TrackerView').then(m => ({ default: m.TrackerView })));
const CalendarView = lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const LicenciasView = lazy(() => import('./components/LicenciasView').then(m => ({ default: m.LicenciasView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));
const DelegadoNoticiasView = lazy(() => import('./components/DelegadoNoticiasView').then(m => ({ default: m.DelegadoNoticiasView })));
const AdminView = lazy(() => import('./components/AdminView').then(m => ({ default: m.AdminView })));
const CensoView = lazy(() => import('./components/CensoView').then(m => ({ default: m.CensoView })));
const EstadisticasView = lazy(() => import('./components/EstadisticasView').then(m => ({ default: m.EstadisticasView })));
// El bocadillo del tutorial solo sale la primera vez que se abre cada pantalla:
// cargarlo aparte deja el arranque de siempre intacto para quien ya lo ha visto.
const TipBubble = lazy(() => import('./components/TipBubble').then(m => ({ default: m.TipBubble })));

/**
 * NavigationBar — Bottom tab bar with React Router integration.
 * Each tab navigates to a route, and the browser back button works correctly.
 *
 * El hueco de "Fichar" es por rol: delegado (en Modo Delegado) → Noticias;
 * admin (en Modo Admin) → Estadísticas; resto → Fichar. En Modo Admin, "Agenda"
 * pasa a ser el panel "Gestión". Las cuentas PENDIENTES navegan con normalidad
 * (Fichar abierto; Agenda y Permisos se ven, y el aviso de activación salta solo
 * al intentar registrar o abrir un permiso).
 */
function NavigationBar({ adminMode, delegadoMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { path: '/dashboard', icon: <PieChart />, label: 'Resumen' },
    delegadoMode
      ? { path: '/delegados', icon: <Newspaper />, label: 'Noticias' }
      : adminMode
        ? { path: '/estadisticas', icon: <BarChart3 />, label: 'Estadísticas' }
        : { path: '/track', icon: <Clock />, label: 'Fichar' },
    adminMode
      ? { path: '/gestion', icon: <ShieldCheck />, label: 'Gestión' }
      : delegadoMode
        ? { path: '/censo', icon: <ClipboardList />, label: 'Censo' }
        : { path: '/calendar', icon: <CalendarIcon />, label: 'Agenda' },
    { path: '/licencias', icon: <FileText />,  label: 'Permisos' },
    { path: '/settings',  icon: <Settings />,  label: 'Ajustes' },
  ];

  return (
    <nav
      className="flex justify-around items-center px-3 shrink-0"
      /* La barra se come el safe area inferior (indicador de inicio del iPhone): crece
         esa altura de más y la reserva como padding, así el blanco llega al borde de la
         pantalla y los iconos siguen centrados en sus 5rem, por encima del indicador. */
      style={{ height: 'calc(5rem + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)', background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,249,0.96))', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 -1px 0 rgba(255,255,255,0.9) inset, 0 -8px 22px rgba(15,40,30,0.07)' }}
      role="tablist"
      aria-label="Navegación principal"
    >
      {tabs.map(tab => (
        <NavItem 
          key={tab.path}
          icon={tab.icon} 
          label={tab.label} 
          isActive={currentPath === tab.path} 
          onClick={() => navigate(tab.path)} 
        />
      ))}
    </nav>
  );
}

/**
 * AppContent — Main authenticated app shell with routing.
 */
function AppContent({ user, authHook }) {
  const {
    logoutUser, saveToCloud, isActive: memberActive, delegado,
    settings, shifts, activeShift, workTimeAccumulated, isBreakActive, breakStartTime
  } = authHook;

  const { token: pushToken, tokenError: pushTokenError, permissionState, requestTokenManually } = useNotifications(user);
  // Feed fusionado: noticias globales (admin) + las de la tienda del usuario
  // (su delegado). Las de delegado llegan con isStoreNews:true.
  const { newsList, addNews, deleteNews } = useNews(user);
  const { showBreakFinishedMsg, setShowBreakFinishedMsg, stopAlarm } = useTimer(activeShift, isBreakActive, workTimeAccumulated, breakStartTime, settings);
  const { shiftsMap, stats } = useShifts(shifts, user);

  const isAdmin = isAdminUser(user);
  // Modo Admin (interruptor en Ajustes): con él activo, el admin ve el panel
  // Gestión y el Resumen solo con noticias. Apagado = app de usuario normal.
  const adminMode = isAdmin && settings?.adminMode !== false;
  const isDelegado = !!delegado;
  // Modo Delegado (interruptor en Ajustes): con él activo, el delegado ve la
  // pestaña "Usuarios" y el Resumen solo con noticias. Apagado = usuario normal.
  const delegadoMode = isDelegado && !adminMode && settings?.delegadoMode !== false;
  // El admin y los delegados nunca quedan bloqueados por membership.
  const isActive = memberActive || isAdmin || isDelegado;

  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // ── Cartel flotante ──
  // El cartel = la noticia más reciente que lleva imagen. Aparece a pantalla casi
  // completa (flotando) una vez por cada cartel nuevo; al cerrarlo se marca como visto
  // en el dispositivo y se vuelve a Resumen, donde el cartel sigue en "Noticias".
  const navigate = useNavigate();
  const activeCartel = useMemo(() => newsList.find(n => n.imageUrl && !n.isPushRequest) || null, [newsList]);
  const [seenCartelId, setSeenCartelId] = useState(() => { try { return localStorage.getItem('cartelSeenId'); } catch { return null; } });
  const [manualImg, setManualImg] = useState(null); // imagen ampliada manualmente desde Resumen { url, title }
  // Estable entre renders: si se creara en línea dentro de <DashboardView ...>, esa
  // vista (envuelta en React.memo) se re-renderizaría en cada render de AppContent.
  const openImage = useCallback((url, title) => setManualImg({ url, title }), []);

  // ── Tutorial ──
  // Cada pantalla explica lo suyo la primera vez que se abre; el botón de Ajustes
  // lo devuelve al principio para verlo las veces que haga falta.
  const { tip, dismiss: dismissTip, restart: restartTips } = useScreenTips();

  // El cartel salta solo (una vez por cartel nuevo). Ampliar manualmente desde Resumen tiene prioridad.
  // Con un aviso del tutorial abierto NO se auto-abre: taparía la pantalla que se
  // está explicando. Al cerrar el aviso, el cartel salta a continuación.
  const autoCartelOpen = !tip && !!activeCartel && String(activeCartel.id) !== String(seenCartelId);
  const lightbox = manualImg || (autoCartelOpen ? { url: activeCartel.imageUrl, title: activeCartel.title, isAuto: true } : null);
  const closeLightbox = useCallback(() => {
    if (lightbox?.isAuto && activeCartel?.id != null) {
      try { localStorage.setItem('cartelSeenId', String(activeCartel.id)); } catch { /* almacenamiento no disponible */ }
      setSeenCartelId(String(activeCartel.id));
      navigate('/dashboard'); // el cartel "vuelve a su sitio" en Resumen
    }
    setManualImg(null);
  }, [lightbox, activeCartel, navigate]);

  useEffect(() => {
    const checkNetwork = async () => {
      const status = await Network.getStatus();
      setIsOffline(!status.connected);
    };
    checkNetwork();

    const listener = Network.addListener('networkStatusChange', status => {
      setIsOffline(!status.connected);
    });
    
    return () => { listener.then(l => l?.remove?.()).catch(() => {}); };
  }, []);

  const toggleDescanso = useCallback(() => {
    const isNowActive = !isBreakActive;
    const newWorkTime = isNowActive ? workTimeAccumulated + Math.floor((Date.now() - activeShift.startTime) / 1000) : workTimeAccumulated;
    const newBreakStart = isNowActive ? Date.now() : null;
    const newActiveShift = isNowActive ? activeShift : { startTime: Date.now() };
    
    if (!isNowActive) {
      setShowBreakFinishedMsg(false);
      stopAlarm(); 
    }

    saveToCloud({ workTimeAccumulated: newWorkTime, breakStartTime: newBreakStart, isBreakActive: isNowActive, activeShift: newActiveShift });
  }, [isBreakActive, workTimeAccumulated, activeShift, saveToCloud, setShowBreakFinishedMsg, stopAlarm]);

  const iniciarTurno = useCallback(() => {
    saveToCloud({ activeShift: { startTime: Date.now() } });
    // Analítica (admin): marca que este usuario usa "Fichar" (mejor esfuerzo).
    if (user?.uid) markFichado(user.uid);
  }, [saveToCloud, user?.uid]);

  const cerrarTurno = useCallback((esHA, totalElapsedSeconds) => {
    const hoyStr = getFormattedDate(new Date());
    const filtered = shifts.filter(s => s.date !== hoyStr);
    const newShifts = [...filtered, { id: Date.now(), date: hoyStr, type: 'work', hours: totalElapsedSeconds / 3600, isHA: esHA }];
    
    setShowBreakFinishedMsg(false);
    stopAlarm(); 

    saveToCloud({ shifts: newShifts, activeShift: null, workTimeAccumulated: 0, isBreakActive: false, breakStartTime: null });
  }, [shifts, saveToCloud, setShowBreakFinishedMsg, stopAlarm]);

  const handleLogout = useCallback(async () => {
    await logoutUser();
    setShowConfirmLogout(false);
  }, [logoutUser]);

  return (
    /* Armazón de la app. En móvil la columna ocupa el 100% y el degradado de detrás no
       se llega a ver nunca; a partir de 640px (tablets, y el móvil en horizontal) la
       columna se ensancha por tramos en vez de quedarse clavada en el ancho de un
       teléfono, y lo que asoma a los lados es el mismo verde del arranque, no un gris
       vacío. No se estira sin límite a propósito: la tipografía de la app es de 8-10px
       y a lo ancho de un iPad de 13" las tarjetas quedarían desparramadas. */
    <div className="h-full flex justify-center font-sans overflow-hidden text-slate-800 relative" style={{ background: 'radial-gradient(circle at 50% 35%, #ecfdf5, #d1fae5 60%, #a7f3d0)' }}>
      <div className="w-full max-w-md sm:max-w-2xl lg:max-w-3xl bg-white h-full flex flex-col relative overflow-hidden sm:shadow-[0_0_60px_rgba(6,78,59,0.22)]">
        
        <header className="text-white pb-3 px-4 rounded-b-[1.5rem] shrink-0 z-10 relative overflow-hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)', background: 'linear-gradient(160deg, #10b981 0%, #059669 55%, #047857 100%)', boxShadow: '0 8px 22px rgba(5,120,87,0.35), inset 0 2px 2px rgba(255,255,255,0.3)' }} role="banner">
          <div className="pointer-events-none absolute -top-10 -right-4 w-40 h-40 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)' }} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.16), transparent)' }} />
          <div className="relative z-10 flex justify-between items-center px-1">
            <h1 className="font-black text-lg italic leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.18)' }}>Hola, {user.fullName?.split(' ')[0]}</h1>
            <button onClick={() => setShowConfirmLogout(true)} className="btn3d p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.16)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.15)' }} aria-label="Cerrar sesión"><LogOut size={16} /></button>
          </div>

          {isOffline && (
            <div className="relative z-10 mt-2 bg-orange-500/90 backdrop-blur text-white text-[10px] font-bold py-1.5 px-3 rounded-full flex items-center justify-center gap-2 animate-in slide-in-from-top-2" role="alert">
              <WifiOff size={12} aria-hidden="true" />
              <span>Estás sin conexión. Usando datos guardados.</span>
            </div>
          )}
        </header>

        <main className="flex-1 p-4 overflow-y-auto scrollbar-hide flex flex-col min-h-0 relative z-0" role="main">
          {/* Sin key={location.pathname}: antes forzaba desmontar/re-montar Suspense+Routes
              en CADA navegación (reseteaba el boundary y volvía a mostrar "Cargando..."
              de chunks ya en caché). React Router ya intercambia solo la ruta activa, y
              cada vista trae su propia animación de entrada. */}
          <div className="flex-1 flex flex-col min-h-0">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><LoadingLogo label="Cargando..." /></div>}>
            <Routes>
              <Route path="/dashboard" element={
                <DashboardView user={user} stats={stats} newsOnly={!isActive || adminMode || delegadoMode} newsList={newsList} addNews={addNews} deleteNews={deleteNews} permissionState={permissionState} requestTokenManually={requestTokenManually} onImageClick={openImage} />
              } />
              {/* Cuentas PENDIENTES: Fichar totalmente abierto; Agenda y Permisos se
                  VEN y el aviso de activación salta dentro, solo al intentar usar
                  lo bloqueado (registrar días / abrir un permiso). */}
              <Route path="/track" element={
                <TrackerView
                  activeShift={activeShift} isBreakActive={isBreakActive} workTimeAccumulated={workTimeAccumulated} breakStartTime={breakStartTime}
                  showBreakFinishedMsg={showBreakFinishedMsg} settings={settings}
                  cerrarTurno={cerrarTurno} toggleDescanso={toggleDescanso} iniciarTurno={iniciarTurno}
                />
              } />
              <Route path="/calendar" element={
                <CalendarView shifts={shifts} shiftsMap={shiftsMap} saveToCloud={saveToCloud} user={user} permissionState={permissionState} requestTokenManually={requestTokenManually} isActive={isActive} />
              } />
              <Route path="/licencias" element={
                <LicenciasView user={user} permissionState={permissionState} requestTokenManually={requestTokenManually} isActive={isActive} />
              } />
              <Route path="/settings" element={
                <SettingsView user={user} settings={settings} saveToCloud={saveToCloud} stopAlarm={stopAlarm} pushToken={pushToken} pushTokenError={pushTokenError} permissionState={permissionState} requestTokenManually={requestTokenManually} isDelegado={isDelegado} onOpenGuide={restartTips} />
              } />
              <Route path="/delegados" element={
                isDelegado ? <DelegadoNoticiasView user={user} delegado={delegado} /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/gestion" element={
                isAdmin ? <AdminView /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/censo" element={
                isDelegado ? <CensoView user={user} delegado={delegado} /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/estadisticas" element={
                isAdmin ? <EstadisticasView /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
          </div>
        </main>

        <NavigationBar adminMode={adminMode} delegadoMode={delegadoMode} />

        {showConfirmLogout && (
          <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" role="dialog" aria-modal="true" aria-label="Confirmar cierre de sesión">
            <div className="rounded-[2rem] p-6 w-full max-w-xs text-center animate-in zoom-in-95" style={{ background: 'linear-gradient(180deg,#ffffff,#f4f5f7)', boxShadow: '0 24px 60px rgba(0,0,0,0.4), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-full text-white" aria-hidden="true" style={{ background: 'linear-gradient(180deg,#fb7185,#e11d48)', boxShadow: '0 8px 18px rgba(225,29,72,0.45), inset 0 2px 2px rgba(255,255,255,0.5)' }}><LogOut size={30}/></div>
              <h3 className="text-base font-black text-slate-800 mb-2 uppercase italic leading-none tracking-tight">¿Cerrar sesión?</h3>
              <p className="text-[11px] text-slate-500 mb-6 uppercase font-bold tracking-widest leading-relaxed">Tus registros están<br/>seguros en la nube.</p>
              <div className="flex gap-3">
                <button onClick={handleLogout} className="btn3d flex-1 text-white py-3.5 rounded-2xl font-black text-xs uppercase" style={{ background: 'linear-gradient(180deg,#fb7185,#e11d48)', boxShadow: '0 6px 14px rgba(225,29,72,0.4), inset 0 1.5px 1px rgba(255,255,255,0.4)' }}>SALIR</button>
                <button onClick={() => setShowConfirmLogout(false)} className="btn3d flex-1 text-slate-600 py-3.5 rounded-2xl font-black text-xs uppercase" style={{ background: 'linear-gradient(180deg,#f1f3f5,#e2e5e9)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.08)' }}>CANCELAR</button>
              </div>
            </div>
          </div>
        )}

        {lightbox && (
          <div
            className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            role="dialog" aria-modal="true" aria-label="Cartel"
            onClick={closeLightbox}
          >
            <button
              onClick={closeLightbox}
              className="absolute right-4 z-10 bg-white/15 text-white p-2.5 rounded-full backdrop-blur active:scale-90 transition-transform"
              style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
              aria-label="Cerrar cartel"
            >
              <X size={22} />
            </button>
            <div className="flex flex-col items-center max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <img
                src={lightbox.url}
                alt={lightbox.title || 'Cartel'}
                className="max-w-full max-h-[82vh] w-auto rounded-2xl shadow-2xl object-contain animate-in zoom-in-95"
              />
              {lightbox.title && (
                <p className="text-white font-black uppercase tracking-tight text-center mt-4 px-4 text-sm">{lightbox.title}</p>
              )}
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-3">Toca fuera o ✕ para cerrar</p>
            </div>
          </div>
        )}
      </div>
      {/* fallback={null}: el bocadillo aparece cuando esté listo, sin un "Cargando…"
          a pantalla completa por delante de la app recién pintada. */}
      {tip && (
        <Suspense fallback={null}>
          {/* key: al cambiar de aviso se monta uno nuevo, así el recorrido por
              partes (Agenda) siempre empieza por su primer paso. */}
          <TipBubble key={tip.id} tip={tip} onDismiss={dismissTip} />
        </Suspense>
      )}
      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
}

/**
 * App — Root component with auth flow, biometric lock, and router.
 */
export default function App() {
  const authHook = useAuth();
  // logoutUser lo usa el botón de escape de la pantalla de bloqueo biométrico
  // ("Acceder con correo y contraseña"). Estaba disponible en AppContent pero NO
  // aquí, así que pulsarlo lanzaba un ReferenceError justo cuando más falta hace.
  const { user, loading, settings, logoutUser } = authHook;

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [biometricError, setBiometricError] = useState(false);

  const verifyBiometric = useCallback(async () => {
    try {
      const result = await NativeBiometric.isAvailable();
      if (result.isAvailable) {
        await NativeBiometric.verifyIdentity({
          reason: "Desbloquea Mi Cuadrante",
          title: "Inicio de Sesión Biométrico",
        });
        setIsUnlocked(true);
        setBiometricError(false);
      } else {
        setIsUnlocked(true);
      }
    } catch (e) {
      console.error(e);
      setBiometricError(true);
    }
  }, []);

  // Retirada del splash nativo. Depende SOLO de que la sesión esté resuelta, y
  // va en su propio efecto para que los cambios de biometría no lo re-disparen.
  //
  // Doble requestAnimationFrame: `useEffect` corre tras el commit de React, pero
  // el navegador puede no haber PINTADO todavía. Si se ocultara ahí, el splash
  // se retiraría un instante antes de que haya contenido en pantalla y se vería
  // un fogonazo vacío — justo lo que hace que el arranque parezca "varias
  // pantallas". Con dos frames encadenados, cuando el logo desaparece la app ya
  // está dibujada debajo.
  useEffect(() => {
    if (loading) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        SplashScreen.hide().catch(() => {});
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner) cancelAnimationFrame(inner);
    };
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      if (user && settings?.useBiometric && !isUnlocked) {
        verifyBiometric();
      } else if (user && !settings?.useBiometric) {
        setIsUnlocked(true);
      }
    }
  }, [loading, user, settings?.useBiometric, isUnlocked, verifyBiometric]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center" style={{ background: 'radial-gradient(circle at 50% 35%, #ecfdf5, #d1fae5 60%, #a7f3d0)' }} role="status" aria-label="Cargando aplicación">
      <LoadingLogo size={84} label="Sincronizando…" />
    </div>
  );

  if (!user) return <AuthView />;

  if (settings?.useBiometric && !isUnlocked) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center p-6 text-white text-center relative overflow-hidden" style={{ background: 'radial-gradient(120% 90% at 50% -10%, #10b981 0%, #047857 50%, #064e3b 100%)' }} role="dialog" aria-label="Pantalla de bloqueo biométrico">
        <div className="pointer-events-none absolute -top-20 -left-16 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)' }} />
        <div className="pointer-events-none absolute bottom-0 -right-16 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%)' }} />
        <div className="relative w-28 h-28 mb-7 grid place-items-center rounded-full breathe" aria-hidden="true" style={{ background: 'rgba(255,255,255,0.16)', boxShadow: '0 0 40px rgba(255,255,255,0.25), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -6px 12px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
           <Fingerprint size={52} className="text-white"/>
        </div>
        <h1 className="relative text-2xl font-black italic mb-2" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Aplicación Bloqueada</h1>
        <p className="relative text-sm font-medium text-emerald-50/90 mb-8 max-w-xs">Usa tu huella dactilar o FaceID para acceder a tu información privada.</p>

        {biometricError && (
           <div className="flex flex-col items-center gap-3 mb-6">
             <p className="relative text-xs text-white font-bold px-4 py-2 rounded-xl" style={{ background: 'rgba(190,18,60,0.5)', border: '1px solid rgba(251,113,133,0.4)' }} role="alert">Error al verificar identidad. Inténtalo de nuevo.</p>
             <button onClick={logoutUser} className="relative z-10 text-xs text-emerald-100 font-medium underline opacity-90 p-2 active:scale-95 transition-transform" aria-label="Volver a inicio de sesión">Acceder con correo y contraseña</button>
           </div>
        )}

        <button onClick={verifyBiometric} className={`btn3d relative z-10 text-emerald-700 font-black px-9 py-4 rounded-full uppercase text-sm ${!biometricError ? 'mb-6' : ''}`} style={{ background: 'linear-gradient(180deg,#ffffff,#e8efe9)', boxShadow: '0 10px 24px rgba(0,0,0,0.3), inset 0 2px 2px rgba(255,255,255,0.9)' }} aria-label="Desbloquear aplicación con biometría">
          Desbloquear
        </button>
      </div>
    );
  }

  return (
    <HashRouter>
      <AppContent user={user} authHook={authHook} />
    </HashRouter>
  );
}
