import React from 'react';
import { User, Settings, Building2, Bell, RefreshCw } from 'lucide-react';
import { COMPANY_RULES, ADMIN_EMAIL } from '../constants/config';

export function SettingsView({ user, settings, saveToCloud, stopAlarm, pushToken, pushTokenError }) {
  const isAdmin = user?.email === ADMIN_EMAIL.toLowerCase();
  const currentCompany = user?.company || "Supercor";
  const currentRank = user?.rank || "Personal de fresco";

  const tokenStatus = pushToken
    ? "OK - GENERADO CON EXITO"
    : pushTokenError
    ? "ERROR: " + pushTokenError
    : "Generando...";

  const tokenColor = pushToken ? '#4ade80' : pushTokenError ? '#f87171' : '#ffffff50';

  return (
    <div className="flex flex-col space-y-5 animate-in fade-in duration-300 pb-20">
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center gap-5">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm shrink-0"><User className="text-emerald-700" size={32}/></div>
        <div className="flex-1">
          <h3 className="text-sm font-black text-slate-800 uppercase italic">Soporte Tecnico</h3>
          <p className="text-[11px] text-slate-500 font-bold mt-1 tracking-wide leading-relaxed">Contacta con tu delegado de zona para consultas o sugerencias.</p>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2rem] p-6 flex flex-col">
        <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-white/5 pb-3"><Settings size={16}/> Preferencias</h3>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
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
                      saveToCloud({ profile: { ...user, company: newCompany, rank: firstRank } });
                    }}
                    className="w-full bg-white/10 border-none p-2 rounded-xl text-xs outline-none text-white appearance-none"
                  >
                    {Object.keys(COMPANY_RULES).map(c => <option key={c} value={c} className="text-slate-800">{c}</option>)}
                  </select>
               </div>
               <div className="flex flex-col space-y-1">
                  <span className="text-[9px] text-white/40 uppercase font-black tracking-widest ml-1">Rango</span>
                  <select 
                    value={currentRank} 
                    onChange={(e) => saveToCloud({ profile: { ...user, rank: e.target.value } })}
                    className="w-full bg-white/10 border-none p-2 rounded-xl text-xs outline-none text-white appearance-none"
                  >
                    {Object.keys(COMPANY_RULES[currentCompany] || {}).map(r => <option key={r} value={r} className="text-slate-800">{r}</option>)}
                  </select>
               </div>
             </div>
          </div>

          <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
            <div className="flex flex-col">
                <span className="text-xs font-bold text-white uppercase leading-none">Notificaciones</span>
                <span className="text-[9px] text-white/40 uppercase mt-1.5 font-medium tracking-tight">Vibracion y alarma al terminar descanso</span>
            </div>
            <button onClick={() => {
                const newSettings = {...settings, notifications: !settings.notifications};
                saveToCloud({settings: newSettings});
                if(!newSettings.notifications) stopAlarm();
            }} className={`w-12 h-6 rounded-full relative transition-colors ${settings.notifications ? 'bg-emerald-500' : 'bg-white/20'}`}>
               <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${settings.notifications ? 'left-7' : 'left-1'}`}></div>
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
                  className={`py-3 rounded-xl text-xs font-black transition-all active:scale-95 ${settings.breakDuration === m ? 'bg-emerald-600 text-white scale-105 shadow-md' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}>{m}m</button>
              ))}
            </div>
          </div>

          {/* Panel de diagnostico de Notificaciones Push - Solo Admin */}
          {isAdmin && (
          <div className="bg-black/30 rounded-2xl p-4 border border-white/10 mt-2">
             <div className="flex items-center gap-2 mb-3">
                <Bell size={14} className="text-emerald-400" />
                <span className="text-[10px] font-black text-white uppercase italic">Estado del Push</span>
             </div>
             <div className="space-y-2">
                <div className="flex justify-between items-center bg-white/5 p-2.5 rounded-xl">
                   <span className="text-[9px] text-white/50 uppercase font-bold">Permiso:</span>
                   <span className="text-[9px] text-emerald-400 font-black uppercase">{typeof Notification !== 'undefined' ? Notification.permission : 'N/A'}</span>
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
          )}
        </div>
      </div>
    </div>
  );
}
