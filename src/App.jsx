import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useNews } from './hooks/useNews';
import { useLicencias } from './hooks/useLicencias';
import { useTimer } from './hooks/useTimer';
import { useShifts } from './hooks/useShifts';
import { useNotifications } from './hooks/useNotifications';
import { Clock, Calendar as CalendarIcon, PieChart, FileText, Settings, LogOut } from 'lucide-react';
import { getFormattedDate } from './utils/dateUtils';
import { NavItem } from './components/UIComponents';
import AuthView from './components/AuthView';

import { DashboardView } from './components/DashboardView';
import { TrackerView } from './components/TrackerView';
import { CalendarView } from './components/CalendarView';
import { LicenciasView } from './components/LicenciasView';
import { SettingsView } from './components/SettingsView';

export default function App() {
  const { 
    user, loading, logoutUser, saveToCloud,
    settings, shifts, activeShift, workTimeAccumulated, isBreakActive, breakStartTime 
  } = useAuth();
  
  const { token: pushToken, tokenError: pushTokenError } = useNotifications(user);
  
  const { newsList, addNews, deleteNews, isLoading: isNewsLoading } = useNews();
  const { licenciasList, addLicencia, updateLicencia, deleteLicencia } = useLicencias();
  const { elapsed, breakTimeLeft, showBreakFinishedMsg, setShowBreakFinishedMsg, stopAlarm } = useTimer(activeShift, isBreakActive, workTimeAccumulated, breakStartTime, settings);
  const { shiftsMap, stats } = useShifts(shifts, user);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);

  useEffect(() => {
    if (newsList.length > 0) {
      const latestNews = newsList[0];
      const lastSeenTime = localStorage.getItem('lastSeenNewsTime');
      
      if (!lastSeenTime || latestNews.createdAt > parseInt(lastSeenTime)) {
        setActiveTab('dashboard'); 
        localStorage.setItem('lastSeenNewsTime', latestNews.createdAt.toString()); 
      }
    }
  }, [newsList]);

  const handleLogout = async () => {
    await logoutUser();
    setShowConfirmLogout(false);
  };

  const toggleDescanso = () => {
    const isNowActive = !isBreakActive;
    const newWorkTime = isNowActive ? workTimeAccumulated + Math.floor((Date.now() - activeShift.startTime) / 1000) : workTimeAccumulated;
    const newBreakStart = isNowActive ? Date.now() : null;
    const newActiveShift = isNowActive ? activeShift : { startTime: Date.now() };
    
    if (!isNowActive) {
      setShowBreakFinishedMsg(false);
      stopAlarm(); 
    }

    saveToCloud({ workTimeAccumulated: newWorkTime, breakStartTime: newBreakStart, isBreakActive: isNowActive, activeShift: newActiveShift });
  };

  const iniciarTurno = () => {
    const ns = { startTime: Date.now() };
    saveToCloud({ activeShift: ns });
  };

  const cerrarTurno = (esHA) => {
    const hoyStr = getFormattedDate(new Date());
    const filtered = shifts.filter(s => s.date !== hoyStr);
    const newShifts = [...filtered, { id: Date.now(), date: hoyStr, type: 'work', hours: elapsed / 3600, isHA: esHA }];
    
    setShowBreakFinishedMsg(false);
    stopAlarm(); 

    saveToCloud({ shifts: newShifts, activeShift: null, workTimeAccumulated: 0, isBreakActive: false, breakStartTime: null });
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-emerald-600 font-bold italic text-sm">Sincronizando Google...</div>;

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex justify-center font-sans overflow-hidden text-slate-800 relative">
      <div className="w-full max-w-md bg-white h-full flex flex-col relative overflow-hidden">
        
        <header className="bg-emerald-600 text-white p-3 rounded-b-[1.5rem] shadow-lg shrink-0 z-10 relative">
          <div className="flex justify-between items-center px-1">
            <div>
              <h1 className="font-black text-base italic leading-tight">Hola, {user.fullName?.split(' ')[0]}</h1>
              <span className="text-[7px] uppercase font-bold opacity-80 tracking-widest leading-none">Datos sincronizados ☁️</span>
            </div>
            <button onClick={() => setShowConfirmLogout(true)} className="bg-white/10 p-2 rounded-lg hover:bg-white/20"><LogOut size={16} /></button>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-y-auto scrollbar-hide flex flex-col min-h-0 relative z-0">
          {activeTab === 'dashboard' && (
             <DashboardView user={user} stats={stats} newsList={newsList} addNews={addNews} deleteNews={deleteNews} />
          )}

          {activeTab === 'track' && (
             <TrackerView 
               activeShift={activeShift} isBreakActive={isBreakActive} elapsed={elapsed} breakTimeLeft={breakTimeLeft}
               showBreakFinishedMsg={showBreakFinishedMsg} settings={settings}
               cerrarTurno={cerrarTurno} toggleDescanso={toggleDescanso} iniciarTurno={iniciarTurno}
             />
          )}

          {activeTab === 'calendar' && (
             <CalendarView shifts={shifts} shiftsMap={shiftsMap} saveToCloud={saveToCloud} />
          )}

          {activeTab === 'licencias' && (
             <LicenciasView user={user} licenciasList={licenciasList} addLicencia={addLicencia} updateLicencia={updateLicencia} deleteLicencia={deleteLicencia} />
          )}

          {activeTab === 'support' && (
             <SettingsView user={user} settings={settings} saveToCloud={saveToCloud} stopAlarm={stopAlarm} pushToken={pushToken} pushTokenError={pushTokenError} />
          )}
        </main>

        <nav className="h-20 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center px-3 shrink-0 fixed bottom-0 left-0 right-0 z-50 pb-5">
          <NavItem icon={<PieChart />} label="Resumen" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Clock />} label="Fichar" isActive={activeTab === 'track'} onClick={() => setActiveTab('track')} />
          <NavItem icon={<CalendarIcon />} label="Agenda" isActive={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
          <NavItem icon={<FileText />} label="Permisos" isActive={activeTab === 'licencias'} onClick={() => setActiveTab('licencias')} />
          <NavItem icon={<Settings />} label="Ajustes" isActive={activeTab === 'support'} onClick={() => setActiveTab('support')} />
        </nav>

        {showConfirmLogout && (
          <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-6 shadow-2xl w-full max-w-xs text-center border border-emerald-50 animate-in zoom-in-95">
              <div className="mb-4 text-emerald-600 flex justify-center"><LogOut size={40}/></div>
              <h3 className="text-base font-black text-slate-800 mb-2 uppercase italic leading-none tracking-tight">¿Cerrar sesión?</h3>
              <p className="text-[10px] text-slate-500 mb-6 uppercase font-bold tracking-widest leading-relaxed">Tus registros están<br/>seguros en la nube.</p>
              <div className="flex gap-3">
                <button onClick={handleLogout} className="flex-1 bg-rose-500 text-white py-3.5 rounded-xl font-black text-xs uppercase shadow-md active:scale-95 transition-all">SALIR</button>
                <button onClick={() => setShowConfirmLogout(false)} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-black text-xs uppercase active:scale-95 transition-all hover:bg-slate-200">CANCELAR</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
