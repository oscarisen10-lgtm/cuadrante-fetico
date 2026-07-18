import React, { useState } from 'react';
import { User, Settings, Building2, Bell, RefreshCw, Trash2, AlertTriangle, Fingerprint, Store, ChevronDown, BarChart3, ShieldCheck, Users } from 'lucide-react';
import { COMPANY_RULES, isAdminUser } from '../constants/config';
import { STORES, S_ROMERO_STORES, ECI_STORES } from '../constants/stores';
import { deleteUserAccount, checkRankAvailability, fetchAdminStats } from '../services/firebaseService';
import { firestoreCacheMode } from '../firebase';
import { toast } from './Toast';
import { setHapticsEnabled, isHapticsEnabled, hapticLight } from '../utils/haptics';

export const SettingsView = React.memo(function SettingsView({ user, settings, saveToCloud, stopAlarm, pushToken, pushTokenError, permissionState, requestTokenManually, isDelegado = false }) {
  const isAdmin = isAdminUser(user);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [haptics, setHaptics] = useState(isHapticsEnabled());
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await fetchAdminStats();
      setStats(data);
    } catch (e) {
      toast('No se pudieron cargar las estadísticas: ' + (e?.message || e), 'error');
    }
    setStatsLoading(false);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount();
      // Auth state will automatically redirect to login
    } catch (error) {
      toast('Error al eliminar la cuenta: ' + error.message, 'error');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };
  const currentCompany = user?.company || "Supercor";
  const currentRank = user?.rank || "Personal de fresco";
  const currentStore = user?.store || "";

  const handleProfileChange = async (updates) => {
    const newCompany = updates.company || currentCompany;
    const newStore = updates.store !== undefined ? updates.store : currentStore;
    const newSection = updates.section !== undefined ? updates.section : (user?.section || "Sin especificar");
    const newRank = updates.rank || currentRank;

    // Solo validamos si cambia algún campo que afecte a la ubicación o el rango
    if (updates.rank !== undefined || updates.store !== undefined || updates.section !== undefined || updates.company !== undefined) {
      try {
        await checkRankAvailability(newCompany, newStore, newSection, newRank, user.uid);
      } catch (err) {
        toast(err.message, "error");
        // Revertimos el select localmente forzando un re-render sin guardar
        return; 
      }
    }
    
    saveToCloud({ profile: { ...user, ...updates } });
  };

  const tokenStatus = pushToken
    ? "OK - GENERADO CON EXITO"
    : pushTokenError
    ? "ERROR: " + pushTokenError
    : "Generando...";

  const tokenColor = pushToken ? '#4ade80' : pushTokenError ? '#f87171' : '#ffffff50';

  let filteredStores = STORES;
  if (currentCompany === "S. Romero") {
    filteredStores = STORES.filter(s => S_ROMERO_STORES.includes(s.name));
  } else if (currentCompany === "ECI") {
    filteredStores = STORES.filter(s => ECI_STORES.includes(s.name));
  } else if (currentCompany === "Supercor" || currentCompany === "S. Express") {
    filteredStores = STORES.filter(s => !S_ROMERO_STORES.includes(s.name) && !ECI_STORES.includes(s.name));
  }
  const sortedStores = [...filteredStores].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col space-y-5 animate-in fade-in duration-300 pb-20">
      <div className="rounded-[2rem] p-6 flex flex-col" style={{ background: 'linear-gradient(180deg,#1e293b,#0f172a)', boxShadow: '0 16px 38px -14px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-white/5 pb-3"><Settings size={16}/> Preferencias</h3>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-4 rounded-2xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.07)]">
             <div className="flex items-center gap-2 mb-1">
                <Building2 size={14} className="text-emerald-500" />
                <span className="text-xs font-bold text-white uppercase leading-none">Mi Puesto</span>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
               <div className="flex flex-col space-y-1">
                  <span className="text-[9px] text-white/40 uppercase font-black tracking-widest ml-1">Empresa</span>
                  <select 
                    value={currentCompany} 
                    onChange={(e) => {
                      const newCompany = e.target.value;
                      const firstRank = Object.keys(COMPANY_RULES[newCompany] || {})[0];
                      handleProfileChange({ company: newCompany, rank: firstRank, store: "" });
                    }}
                    className="w-full bg-white/10 border border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] p-2 rounded-xl text-xs outline-none text-white appearance-none"
                  >
                    {Object.keys(COMPANY_RULES).map(c => <option key={c} value={c} className="text-slate-800">{c}</option>)}
                  </select>
               </div>
               <div className="flex flex-col space-y-1">
                  <span className="text-[9px] text-white/40 uppercase font-black tracking-widest ml-1">Rango</span>
                  <select 
                    value={currentRank} 
                    onChange={(e) => handleProfileChange({ rank: e.target.value })}
                    className="w-full bg-white/10 border border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] p-2 rounded-xl text-xs outline-none text-white appearance-none"
                  >
                    {Object.keys(COMPANY_RULES[currentCompany] || {}).map(r => <option key={r} value={r} className="text-slate-800">{r}</option>)}
                  </select>
               </div>
             </div>

                <div className="flex flex-col space-y-1 mt-1">
                  <span className="text-[9px] text-white/40 uppercase font-black tracking-widest ml-1 flex items-center gap-1">
                    <Store size={10} className="text-emerald-500"/> Centro / Tienda
                  </span>
                  <div className="relative">
                    <select 
                      value={currentStore} 
                      onChange={(e) => handleProfileChange({ store: e.target.value })}
                      className="w-full bg-white/10 border border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] p-2.5 pr-8 rounded-xl text-xs outline-none text-white appearance-none font-medium"
                    >
                      <option value="" disabled className="text-slate-800">Selecciona tu tienda...</option>
                      {sortedStores.map(s => (
                        <option key={s.name} value={s.name} className="text-slate-800">{s.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col space-y-1 mt-1">
                  <span className="text-[9px] text-white/40 uppercase font-black tracking-widest ml-1 flex items-center gap-1">
                    <Store size={10} className="text-emerald-500"/> Sección
                  </span>
                  <div className="relative">
                    <select 
                      value={user?.section || "Sin especificar"} 
                      onChange={(e) => handleProfileChange({ section: e.target.value })}
                      className="w-full bg-white/10 border border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] p-2.5 pr-8 rounded-xl text-xs outline-none text-white appearance-none font-medium"
                    >
                      <option value="Sin especificar" className="text-slate-800">Sin especificar</option>
                      <option value="Charcutería" className="text-slate-800">Charcutería</option>
                      <option value="Carnicería" className="text-slate-800">Carnicería</option>
                      <option value="Pescadería" className="text-slate-800">Pescadería</option>
                      <option value="Panadería" className="text-slate-800">Panadería/Platos</option>
                      <option value="Frutería" className="text-slate-800">Frutería</option>
                      <option value="Sala" className="text-slate-800">Sala</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>
          </div>

          <div className="flex justify-between items-center bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-4 rounded-2xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.07)]">
             <div className="flex flex-col">
                <span className="text-xs font-bold text-white uppercase leading-none flex items-center gap-1.5"><RefreshCw size={14} className="text-emerald-500"/> Sincronización</span>
                <span className="text-[9px] text-white/40 uppercase mt-1.5 font-medium tracking-tight">Sincroniza las noticias y avisos</span>
             </div>
             {permissionState === 'granted' ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg font-black uppercase">Activada</span>
             ) : (
                <button onClick={requestTokenManually} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase active:scale-95 shadow-md">
                   Permitir
                </button>
             )}
          </div>

          <div className="flex justify-between items-center bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-4 rounded-2xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.07)]">
            <div className="flex flex-col">
                <span className="text-xs font-bold text-white uppercase leading-none">Alarmas Locales</span>
                <span className="text-[9px] text-white/40 uppercase mt-1.5 font-medium tracking-tight">Vibracion al terminar descanso</span>
            </div>
            <button onClick={() => {
                const newSettings = {...settings, notifications: !settings.notifications};
                saveToCloud({settings: newSettings});
                if(!newSettings.notifications) stopAlarm?.();
            }} className={`w-12 h-6 rounded-full relative transition-colors ${settings.notifications ? 'bg-emerald-500' : 'bg-white/20'}`}>
               <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${settings.notifications ? 'left-7' : 'left-1'}`}></div>
            </button>
          </div>

          <div className="flex justify-between items-center bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-4 rounded-2xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.07)]">
            <div className="flex flex-col">
                <span className="text-xs font-bold text-white uppercase leading-none">Vibración</span>
                <span className="text-[9px] text-white/40 uppercase mt-1.5 font-medium tracking-tight">Vibración al pulsar botones</span>
            </div>
            <button onClick={() => {
                const v = !haptics;
                setHaptics(v);
                setHapticsEnabled(v);
                if (v) hapticLight();
            }} className={`w-12 h-6 rounded-full relative transition-colors ${haptics ? 'bg-emerald-500' : 'bg-white/20'}`}>
               <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${haptics ? 'left-7' : 'left-1'}`}></div>
            </button>
          </div>

          <div className="flex justify-between items-center bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-4 rounded-2xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.07)]">
            <div className="flex flex-col">
                <span className="text-xs font-bold text-white uppercase leading-none flex items-center gap-1.5"><Fingerprint size={14} className="text-emerald-500"/> Bloqueo Biométrico</span>
                <span className="text-[9px] text-white/40 uppercase mt-1.5 font-medium tracking-tight">Exigir FaceID/Huella al abrir app</span>
            </div>
            <button onClick={() => {
                const newSettings = {...settings, useBiometric: !settings.useBiometric};
                saveToCloud({settings: newSettings});
            }} className={`w-12 h-6 rounded-full relative transition-colors ${settings?.useBiometric ? 'bg-emerald-500' : 'bg-white/20'}`}>
               <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${settings?.useBiometric ? 'left-7' : 'left-1'}`}></div>
            </button>
          </div>

          <div className="space-y-4 flex flex-col">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Minutos de Descanso</span>
            <div className="grid grid-cols-5 gap-2">
              {[15, 20, 30, 45, 60].map(m => (
                <button key={m} onClick={() => {
                    const newSettings = {...settings, breakDuration: m};
                    saveToCloud({settings: newSettings});
                }}
                  className={`py-3 rounded-xl text-xs font-black transition-all active:scale-95 ${settings.breakDuration === m ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white scale-105 shadow-[0_4px_10px_rgba(5,150,105,0.4)]' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}>{m}m</button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
             <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-400 uppercase leading-none">Versión App</span>
                <span className="text-[9px] text-white/40 uppercase mt-1.5 font-medium tracking-tight">Versión {__APP_VERSION__} (Estable)</span>
             </div>
          </div>

          {/* Interruptor Modo Delegado ↔ Modo Usuario. Con el modo delegado activo:
              Resumen solo noticias y pestaña "Usuarios" en el hueco de Fichar.
              Apagado, el delegado ve la app como un usuario normal. */}
          {isDelegado && (
            <div className="flex justify-between items-center bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/25 mt-2">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-300 uppercase leading-none flex items-center gap-1.5">
                  <Users size={14} className="text-emerald-400"/> Modo Delegado
                </span>
                <span className="text-[9px] text-white/40 uppercase mt-1.5 font-medium tracking-tight">
                  {settings?.delegadoMode !== false ? 'Gestión de usuarios y noticias' : 'Viendo la app como usuario normal'}
                </span>
              </div>
              <button
                onClick={() => saveToCloud({ settings: { ...settings, delegadoMode: !(settings?.delegadoMode !== false) } })}
                className={`w-12 h-6 rounded-full relative transition-colors ${settings?.delegadoMode !== false ? 'bg-emerald-500' : 'bg-white/20'}`}
                aria-label={settings?.delegadoMode !== false ? 'Cambiar a modo usuario' : 'Cambiar a modo delegado'}
              >
                <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${settings?.delegadoMode !== false ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>
          )}

          {/* Panel de diagnostico de Notificaciones Push y Minijuego - Solo Admin */}
          {isAdmin && (
            <>
              {/* Interruptor Modo Admin ↔ Modo Usuario. Con el modo admin activo:
                  Resumen solo noticias y Agenda → panel Gestión. Apagado, el
                  admin ve la app como un usuario normal. */}
              <div className="flex justify-between items-center bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/25 mt-2">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-indigo-300 uppercase leading-none flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-indigo-400"/> Modo Admin
                  </span>
                  <span className="text-[9px] text-white/40 uppercase mt-1.5 font-medium tracking-tight">
                    {settings?.adminMode !== false ? 'Gestión y noticias' : 'Viendo la app como usuario normal'}
                  </span>
                </div>
                <button
                  onClick={() => saveToCloud({ settings: { ...settings, adminMode: !(settings?.adminMode !== false) } })}
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings?.adminMode !== false ? 'bg-indigo-500' : 'bg-white/20'}`}
                  aria-label={settings?.adminMode !== false ? 'Cambiar a modo usuario' : 'Cambiar a modo admin'}
                >
                  <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${settings?.adminMode !== false ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="bg-black/30 rounded-2xl p-4 border border-white/10 mt-2">
                 <div className="flex items-center gap-2 mb-3">
                    <Bell size={14} className="text-emerald-400" />
                    <span className="text-[10px] font-black text-white uppercase italic">Estado del Push</span>
                 </div>
                 <div className="space-y-2">
                    <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-xl">
                       <span className="text-[9px] text-white/50 uppercase font-bold">Permiso:</span>
                       <span className="text-[9px] text-emerald-400 font-black uppercase">{permissionState}</span>
                    </div>
                    {/* Diagnóstico de la prueba de caché persistente en iOS (TestFlight):
                        "persistente" = la optimización está activa en este dispositivo. */}
                    <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-xl">
                       <span className="text-[9px] text-white/50 uppercase font-bold">Caché Firestore:</span>
                       <span className="text-[9px] text-emerald-400 font-black uppercase">{firestoreCacheMode}</span>
                    </div>
                    <div className="flex flex-col bg-white/5 p-2.5 rounded-xl gap-1">
                       <span className="text-[9px] text-white/50 uppercase font-bold">Token FCM:</span>
                       <span className="text-[7px] font-mono break-all leading-tight" style={{ color: tokenColor }}>
                          {tokenStatus}
                       </span>
                    </div>
                    <button 
                      onClick={() => window.location.reload()} 
                      className="w-full bg-emerald-600 text-white py-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 mt-1"
                    >
                      <RefreshCw size={10} /> RECARGAR PARA ACTIVAR
                    </button>
                 </div>
              </div>
              {/* Estadísticas de instalación y uso (solo admin) */}
              <div className="bg-black/30 rounded-2xl p-4 border border-white/10 mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-black text-white uppercase italic">Estadísticas de uso</span>
                </div>
                {stats ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-xl">
                      <span className="text-[9px] text-white/50 uppercase font-bold">Usuarios totales</span>
                      <span className="text-[11px] text-white font-black">{stats.total}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white/5 p-2.5 rounded-xl text-center">
                        <div className="text-[8px] text-white/50 uppercase font-bold"> iOS</div>
                        <div className="text-sm text-white font-black">{stats.ios}</div>
                      </div>
                      <div className="bg-white/5 p-2.5 rounded-xl text-center">
                        <div className="text-[8px] text-white/50 uppercase font-bold">Android</div>
                        <div className="text-sm text-white font-black">{stats.android}</div>
                      </div>
                      <div className="bg-white/5 p-2.5 rounded-xl text-center">
                        <div className="text-[8px] text-white/50 uppercase font-bold">Web</div>
                        <div className="text-sm text-white font-black">{stats.web}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-xl">
                      <span className="text-[9px] text-white/50 uppercase font-bold">Usan «Fichar»</span>
                      <span className="text-[11px] text-emerald-400 font-black">{stats.fichadores} <span className="text-white/30">/ {stats.total}</span></span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-xl">
                      <span className="text-[9px] text-white/50 uppercase font-bold">Con push activo</span>
                      <span className="text-[11px] text-white font-black">{stats.conPush}</span>
                    </div>
                    {stats.desconocido > 0 && (
                      <p className="text-[8px] text-white/30 uppercase font-bold text-center pt-1">
                        {stats.desconocido} sin plataforma aún (apps antiguas; se registrará al actualizar)
                      </p>
                    )}
                    <button onClick={loadStats} disabled={statsLoading} className="w-full bg-white/10 text-white py-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 mt-1">
                      <RefreshCw size={10} /> {statsLoading ? 'Actualizando…' : 'Actualizar'}
                    </button>
                  </div>
                ) : (
                  <button onClick={loadStats} disabled={statsLoading} className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                    <BarChart3 size={14} /> {statsLoading ? 'Cargando…' : 'Ver estadísticas'}
                  </button>
                )}
              </div>

            </>
          )}

           {/* Zona peligrosa — Eliminar cuenta (Requisito Apple App Store) */}
           <div className="flex justify-between items-center bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 mt-2">
              <div className="flex flex-col">
                 <span className="text-xs font-bold text-rose-400 uppercase leading-none">Eliminar Cuenta</span>
                 <span className="text-[9px] text-white/40 uppercase mt-1.5 font-medium tracking-tight">Borrar todos tus datos permanentemente</span>
              </div>
              <button onClick={() => setShowDeleteModal(true)} className="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase active:scale-95 shadow-md flex items-center gap-1.5">
                 <Trash2 size={14}/> Eliminar
              </button>
           </div>
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-[2rem] p-6 shadow-2xl w-full max-w-xs text-center border border-rose-50 animate-in zoom-in-95">
            <div className="mb-4 text-rose-500 flex justify-center"><AlertTriangle size={40}/></div>
            <h3 className="text-base font-black text-slate-800 mb-2 uppercase italic leading-none tracking-tight">¿Eliminar tu cuenta?</h3>
            <p className="text-[10px] text-slate-500 mb-6 uppercase font-bold tracking-widest leading-relaxed">Esta acción es irreversible.<br/>Se borrarán todos tus datos,<br/>turnos y configuración.</p>
            <div className="flex gap-3">
              <button onClick={handleDeleteAccount} disabled={isDeleting} className={`flex-1 bg-rose-500 text-white py-3.5 rounded-xl font-black text-xs uppercase shadow-md active:scale-95 transition-all ${isDeleting ? 'opacity-70' : ''}`}>
                {isDeleting ? 'ELIMINANDO...' : 'SÍ, ELIMINAR'}
              </button>
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-black text-xs uppercase active:scale-95 transition-all hover:bg-slate-200">CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
