import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { SplashScreen } from '@capacitor/splash-screen';
import { Network } from '@capacitor/network';
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { useAuth } from './hooks/useAuth';
import { useNews } from './hooks/useNews';
import { useTimer } from './hooks/useTimer';
import { useShifts } from './hooks/useShifts';
import { useNotifications } from './hooks/useNotifications';
import { Clock, Calendar as CalendarIcon, PieChart, FileText, Settings, LogOut, WifiOff, Fingerprint } from 'lucide-react';
import { getFormattedDate } from './utils/dateUtils';
import { NavItem } from './components/UIComponents';
import AuthView from './components/AuthView';
import { ToastContainer, ConfirmDialog } from './components/Toast';

const DashboardView = lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const TrackerView = lazy(() => import('./components/TrackerView').then(m => ({ default: m.TrackerView })));
const CalendarView = lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const LicenciasView = lazy(() => import('./components/LicenciasView').then(m => ({ default: m.LicenciasView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));

/**
 * NavigationBar — Bottom tab bar with React Router integration.
 * Each tab navigates to a route, and the browser back button works correctly.
 */
function NavigationBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { path: '/dashboard', icon: <PieChart />, label: 'Resumen' },
    { path: '/track',     icon: <Clock />,    label: 'Fichar' },
    { path: '/calendar',  icon: <CalendarIcon />, label: 'Agenda' },
    { path: '/licencias', icon: <FileText />,  label: 'Permisos' },
    { path: '/settings',  icon: <Settings />,  label: 'Ajustes' },
  ];

  return (
    <nav 
      className="h-20 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center px-3 shrink-0 fixed bottom-0 left-0 right-0 z-50 pb-5"
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
    logoutUser, saveToCloud,
    settings, shifts, activeShift, workTimeAccumulated, isBreakActive, breakStartTime 
  } = authHook;

  const { token: pushToken, tokenError: pushTokenError, permissionState, requestTokenManually } = useNotifications(user);
  const { newsList, addNews, deleteNews } = useNews();
  const { showBreakFinishedMsg, setShowBreakFinishedMsg, stopAlarm } = useTimer(activeShift, isBreakActive, workTimeAccumulated, breakStartTime, settings);
  const { shiftsMap, stats } = useShifts(shifts, user);

  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

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
  }, [saveToCloud]);

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
    <div className="h-[100dvh] bg-slate-50 flex justify-center font-sans overflow-hidden text-slate-800 relative">
      <div className="w-full max-w-md bg-white h-full flex flex-col relative overflow-hidden">
        
        <header className="bg-emerald-600 text-white p-3 rounded-b-[1.5rem] shadow-lg shrink-0 z-10 relative" role="banner">
          <div className="flex justify-between items-center px-1">
            <div>
              <h1 className="font-black text-base italic leading-tight">Hola, {user.fullName?.split(' ')[0]}</h1>
              <span className="text-[8px] uppercase font-bold opacity-80 tracking-widest leading-none" aria-label="Estado de sincronización: conectado">Datos sincronizados ☁️</span>
            </div>
            <button onClick={() => setShowConfirmLogout(true)} className="bg-white/10 p-2 rounded-lg hover:bg-white/20" aria-label="Cerrar sesión"><LogOut size={16} /></button>
          </div>
          
          {isOffline && (
            <div className="mt-2 bg-orange-500/90 backdrop-blur text-white text-[10px] font-bold py-1.5 px-3 rounded-full flex items-center justify-center gap-2 animate-in slide-in-from-top-2" role="alert">
              <WifiOff size={12} aria-hidden="true" />
              <span>Estás sin conexión. Usando datos guardados.</span>
            </div>
          )}
        </header>

        <main className="flex-1 p-4 overflow-y-auto scrollbar-hide flex flex-col min-h-0 relative z-0" role="main">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-emerald-500 font-bold text-xs italic" role="status" aria-label="Cargando contenido">Cargando...</div>}>
            <Routes>
              <Route path="/dashboard" element={
                <DashboardView user={user} stats={stats} newsList={newsList} addNews={addNews} deleteNews={deleteNews} permissionState={permissionState} requestTokenManually={requestTokenManually} />
              } />
              <Route path="/track" element={
                <TrackerView 
                  activeShift={activeShift} isBreakActive={isBreakActive} workTimeAccumulated={workTimeAccumulated} breakStartTime={breakStartTime}
                  showBreakFinishedMsg={showBreakFinishedMsg} settings={settings}
                  cerrarTurno={cerrarTurno} toggleDescanso={toggleDescanso} iniciarTurno={iniciarTurno}
                />
              } />
              <Route path="/calendar" element={
                <CalendarView shifts={shifts} shiftsMap={shiftsMap} saveToCloud={saveToCloud} user={user} />
              } />
              <Route path="/licencias" element={
                <LicenciasView user={user} />
              } />
              <Route path="/settings" element={
                <SettingsView user={user} settings={settings} saveToCloud={saveToCloud} stopAlarm={stopAlarm} pushToken={pushToken} pushTokenError={pushTokenError} permissionState={permissionState} requestTokenManually={requestTokenManually} />
              } />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>

        <NavigationBar />

        {showConfirmLogout && (
          <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" role="dialog" aria-modal="true" aria-label="Confirmar cierre de sesión">
            <div className="bg-white rounded-[2rem] p-6 shadow-2xl w-full max-w-xs text-center border border-emerald-50 animate-in zoom-in-95">
              <div className="mb-4 text-emerald-600 flex justify-center" aria-hidden="true"><LogOut size={40}/></div>
              <h3 className="text-base font-black text-slate-800 mb-2 uppercase italic leading-none tracking-tight">¿Cerrar sesión?</h3>
              <p className="text-[11px] text-slate-500 mb-6 uppercase font-bold tracking-widest leading-relaxed">Tus registros están<br/>seguros en la nube.</p>
              <div className="flex gap-3">
                <button onClick={handleLogout} className="flex-1 bg-rose-500 text-white py-3.5 rounded-xl font-black text-xs uppercase shadow-md active:scale-95 transition-all">SALIR</button>
                <button onClick={() => setShowConfirmLogout(false)} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-black text-xs uppercase active:scale-95 transition-all hover:bg-slate-200">CANCELAR</button>
              </div>
            </div>
          </div>
        )}
      </div>
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
  const { user, loading, settings } = authHook;

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [biometricError, setBiometricError] = useState(false);

  useEffect(() => {
    if (!loading) {
      SplashScreen.hide().catch(() => {});
      
      if (user && settings?.useBiometric && !isUnlocked) {
        verifyBiometric();
      } else if (user && !settings?.useBiometric) {
        setIsUnlocked(true);
      }
    }
  }, [loading, user, settings?.useBiometric]);

  const verifyBiometric = async () => {
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
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center text-emerald-600 font-bold italic text-sm" role="status" aria-label="Cargando aplicación">
      <span className="animate-pulse">Sincronizando Google...</span>
    </div>
  );

  if (!user) return <AuthView />;

  if (settings?.useBiometric && !isUnlocked) {
    return (
      <div className="h-[100dvh] bg-emerald-700 flex flex-col items-center justify-center p-6 text-white text-center" role="dialog" aria-label="Pantalla de bloqueo biométrico">
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 shadow-xl backdrop-blur-md animate-pulse" aria-hidden="true">
           <Fingerprint size={48} className="text-white"/>
        </div>
        <h1 className="text-2xl font-black italic mb-2">Aplicación Bloqueada</h1>
        <p className="text-sm font-medium text-emerald-100 mb-8 max-w-xs">Usa tu huella dactilar o FaceID para acceder a tu información privada.</p>
        
        {biometricError && (
           <p className="text-xs text-rose-300 font-bold bg-rose-900/30 px-4 py-2 rounded-xl mb-6" role="alert">Error al verificar identidad. Inténtalo de nuevo.</p>
        )}

        <button onClick={verifyBiometric} className="bg-white text-emerald-700 font-black px-8 py-3.5 rounded-full uppercase text-sm shadow-xl hover:scale-105 active:scale-95 transition-all" aria-label="Desbloquear aplicación con biometría">
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
