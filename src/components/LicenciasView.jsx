import React, { useState, useMemo } from 'react';
import { FileText, ChevronDown, ChevronUp, Info, Users, Clock, ClipboardCheck, CalendarDays } from 'lucide-react';
import { LICENCIAS_CATEGORIES, GRADOS_CONSANGUINIDAD } from '../constants/licenciasData';
import { CONFIG } from '../constants/config';
import { STORES, MUNICIPAL_HOLIDAYS } from '../constants/stores';

/**
 * getAllYearHolidays — Collects all common + municipal holidays for the year.
 */
function getAllYearHolidays(userStoreName) {
  const holidays = [];

  // Common holidays (Madrid region)
  Object.entries(CONFIG.FESTIVOS || {}).forEach(([dateStr, name]) => {
    holidays.push({ date: dateStr, name, type: 'common' });
  });

  // Municipal holidays based on the user's store city
  if (userStoreName) {
    const store = STORES.find(s => s.name === userStoreName);
    if (store && store.city && MUNICIPAL_HOLIDAYS[store.city]) {
      Object.entries(MUNICIPAL_HOLIDAYS[store.city]).forEach(([dateStr, name]) => {
        if (!holidays.find(h => h.date === dateStr)) {
          holidays.push({ date: dateStr, name, type: 'local' });
        }
      });
    }
  }

  // Sort by month-day
  return holidays.sort((a, b) => {
    const [am, ad] = a.date.split('-').map(Number);
    const [bm, bd] = b.date.split('-').map(Number);
    return am !== bm ? am - bm : ad - bd;
  });
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export const LicenciasView = React.memo(function LicenciasView({ user, permissionState, requestTokenManually }) {
  const [expandedLicencia, setExpandedLicencia] = useState(null);
  const [showGrados, setShowGrados] = useState(false);
  const [showFestivos, setShowFestivos] = useState(false);

  const userStore = user?.store;

  const holidays = useMemo(() => getAllYearHolidays(userStore), [userStore]);

  const toggleLicencia = (id) => {
    setExpandedLicencia(expandedLicencia === id ? null : id);
  };

  const hasNotifications = permissionState === 'granted';

  return (
    <div className="relative min-h-[500px] flex flex-col">
      {!hasNotifications && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 flex items-center gap-3.5 shadow-sm animate-in slide-in-from-top-3 mb-2">
          <div className="w-9 h-9 bg-amber-500/15 rounded-2xl flex items-center justify-center shrink-0 border border-amber-500/25">
             <span className="text-xl animate-bounce">🔔</span>
          </div>
          <div className="flex-1 min-w-0">
             <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest leading-none mb-1">¡Activar Notificaciones!</h4>
             <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight leading-tight">
               {permissionState === 'denied'
                 ? "Permiso bloqueado. Actívalo en los Ajustes del móvil."
                 : "Es obligatorio para recibir avisos de tus licencias."
               }
             </p>
          </div>
          {permissionState === 'denied' ? (
             <span className="text-[8px] bg-slate-100 text-slate-500 px-2.5 py-1.5 rounded-lg font-black uppercase shrink-0">Bloqueado</span>
          ) : (
             <button onClick={requestTokenManually} className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-[9px] font-black uppercase shadow-md shadow-amber-500/10 active:scale-95 transition-all shrink-0">
                Permitir
             </button>
          )}
        </div>
      )}
      <div className={`flex flex-col animate-in fade-in duration-500 gap-6 pb-24 flex-1`}>
        {/* Header Informativo */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-5 flex items-start gap-4 shadow-sm">
          <div className="bg-emerald-600 p-2.5 rounded-2xl text-white shadow-md shrink-0">
            <Info size={20} />
          </div>
          <div>
            <h2 className="text-[13px] font-black text-emerald-900 uppercase italic leading-tight tracking-tight">Catálogo Oficial de Licencias</h2>
            <p className="text-[10px] text-emerald-700/80 mt-1 font-bold uppercase tracking-wider leading-relaxed">
              Consulta tus derechos según convenio colectivo vigente. Estas licencias están en vigor hasta 31 diciembre 2026.
            </p>
          </div>
        </div>

        {/* Botón Festivos del Año */}
        <button 
          onClick={() => setShowFestivos(!showFestivos)}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
            showFestivos ? 'bg-emerald-700 border-emerald-600 shadow-md ring-2 ring-emerald-600/20' : 'bg-emerald-600 border-emerald-700/20 shadow-sm hover:bg-emerald-500'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showFestivos ? 'bg-white text-emerald-700 shadow-lg' : 'bg-emerald-700/50 text-emerald-100'}`}>
              <CalendarDays size={16} />
            </div>
            <span className="text-[11px] font-black uppercase text-white leading-snug tracking-tight text-left">Calendario de Festivos {new Date().getFullYear()}</span>
          </div>
          <div className={`p-1.5 rounded-lg border transition-all shrink-0 ${showFestivos ? 'bg-white border-white text-emerald-700' : 'bg-emerald-700/50 border-emerald-700/50 text-emerald-100'}`}>
            {showFestivos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {/* Lista de Festivos (Condicional) */}
        {showFestivos && (
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-300">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
                Festivos Nacionales, Regionales y Locales
                {userStore && <span className="text-emerald-600 ml-1">· {userStore}</span>}
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {holidays.map(({ date, name, type }) => {
                const [m, d] = date.split('-').map(Number);
                return (
                  <div key={date} className="p-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                    <div className={`flex flex-col items-center justify-center min-w-[40px] h-[40px] rounded-xl ${type === 'local' ? 'bg-amber-100' : 'bg-rose-100'}`}>
                      <span className={`font-black text-[15px] leading-none ${type === 'local' ? 'text-amber-700' : 'text-rose-700'}`}>{d}</span>
                      <span className={`text-[7px] uppercase font-bold ${type === 'local' ? 'text-amber-500' : 'text-rose-500'}`}>{MONTH_NAMES[m - 1]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-700 font-bold leading-tight">{name}</p>
                    </div>
                    <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter shrink-0 ${type === 'local' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                      {type === 'local' ? 'Local' : 'Regional'}
                    </span>
                  </div>
                );
              })}
              {holidays.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 font-bold">
                  No hay festivos configurados para tu zona.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botón Grados de Consanguinidad */}
        <button 
          onClick={() => setShowGrados(!showGrados)}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
            showGrados ? 'bg-emerald-700 border-emerald-600 shadow-md ring-2 ring-emerald-600/20' : 'bg-emerald-600 border-emerald-700/20 shadow-sm hover:bg-emerald-500'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showGrados ? 'bg-white text-emerald-700 shadow-lg' : 'bg-emerald-700/50 text-emerald-100'}`}>
              <Users size={16} />
            </div>
            <span className="text-[11px] font-black uppercase text-white leading-snug tracking-tight text-left">Guía de Grados de Parentesco</span>
          </div>
          <div className={`p-1.5 rounded-lg border transition-all shrink-0 ${showGrados ? 'bg-white border-white text-emerald-700' : 'bg-emerald-700/50 border-emerald-700/50 text-emerald-100'}`}>
            {showGrados ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {/* Tabla de Grados (Condicional) */}
        {showGrados && (
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-300">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Referencia para Licencias Familiares</p>
            </div>
            <div className="divide-y divide-slate-100">
              {GRADOS_CONSANGUINIDAD.map((g, idx) => (
                <div key={idx} className="p-4 flex flex-col gap-2 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">{g.grado}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Consanguinidad (Sangre)</p>
                      <p className="text-[11px] text-slate-700 font-bold leading-tight mt-0.5">{g.consanguinidad}</p>
                    </div>
                    {g.afinidad && (
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Afinidad (Familia Política)</p>
                        <p className="text-[11px] text-slate-700 font-bold leading-tight mt-0.5">{g.afinidad}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categorías de Licencias */}
        <div className="space-y-8">
          {LICENCIAS_CATEGORIES.map((cat) => (
            <div key={cat.id} className="flex flex-col gap-4">
              <div className="px-2">
                <h3 className="text-[12px] font-black text-slate-800 uppercase italic tracking-wider flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-emerald-600 rounded-full"></div>
                  {cat.title}
                </h3>
                {cat.subtitle && (
                  <p className="text-[10px] text-slate-500 font-bold italic mt-1 pl-3.5 leading-tight">{cat.subtitle}</p>
                )}
              </div>

              <div className="grid gap-3">
                {cat.items.map((lic, idx) => {
                  const itemId = `${cat.id}-${idx}`;
                  const isExpanded = expandedLicencia === itemId;
                  
                  return (
                    <div key={idx} className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'border-emerald-600 shadow-md ring-2 ring-emerald-600/20' : 'border-emerald-700/20 shadow-sm'}`}>
                      <div 
                        className={`p-4 cursor-pointer flex justify-between items-center gap-4 transition-colors ${isExpanded ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                        onClick={() => toggleLicencia(itemId)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isExpanded ? 'bg-white text-emerald-700 shadow-lg' : 'bg-emerald-700/50 text-emerald-100'}`}>
                            <FileText size={16} />
                          </div>
                          <h4 className="text-[11px] font-black text-white uppercase leading-snug tracking-tight">{lic.title}</h4>
                        </div>
                        <div className={`p-1.5 rounded-lg border transition-all ${isExpanded ? 'bg-white border-white text-emerald-700 rotate-180' : 'bg-emerald-700/50 border-emerald-700/50 text-emerald-100'}`}>
                          <ChevronDown size={14} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-5 pb-6 pt-2 border-t border-emerald-100 animate-in slide-in-from-top-2">
                          <div className="grid gap-4 mt-2">
                            <div className="flex gap-3">
                              <div className="bg-amber-50 p-2 rounded-xl text-amber-600 h-fit"><Clock size={14} /></div>
                              <div>
                                <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Duración</p>
                                <p className="text-[11px] text-slate-700 font-bold leading-tight mt-0.5">{lic.duracion}</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-3">
                              <div className="bg-blue-50 p-2 rounded-xl text-blue-600 h-fit"><Info size={14} /></div>
                              <div>
                                <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Requisito</p>
                                <p className="text-[11px] text-slate-700 font-bold leading-tight mt-0.5">{lic.requisito}</p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600 h-fit"><ClipboardCheck size={14} /></div>
                              <div>
                                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Documentación Necesaria</p>
                                <p className="text-[11px] text-slate-700 font-bold leading-tight mt-0.5">{lic.documentacion}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>


    </div>
  );
});
