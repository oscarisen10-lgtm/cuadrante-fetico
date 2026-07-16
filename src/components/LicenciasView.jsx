import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Info, Users, Clock, ClipboardCheck, Bot, Sparkles } from 'lucide-react';
import { LICENCIAS_CATEGORIES, GRADOS_CONSANGUINIDAD } from '../constants/licenciasData';
import { ChatModal } from './ChatModal';
import { isAdminUser } from '../constants/config';
import { ActivationGateModal } from './LockedView';

export const LicenciasView = React.memo(function LicenciasView({ user, permissionState, requestTokenManually, isActive = true }) {
  const [expandedLicencia, setExpandedLicencia] = useState(null);
  const [showGrados, setShowGrados] = useState(false);
  const [showGeneral, setShowGeneral] = useState(true); // abierto por defecto al entrar
  const [showChat, setShowChat] = useState(false);
  // Cuentas PENDIENTES: la lista de permisos SE VE; este aviso salta solo al
  // intentar ABRIR el detalle de un permiso.
  const [showActivationGate, setShowActivationGate] = useState(false);
  const [fontScale, setFontScale] = useState(() => {
    try { return parseFloat(localStorage.getItem('licFontScale')) || 1; } catch { return 1; }
  });

  // Mientras la IA está en pruebas, el asistente solo lo ve el admin.
  const isAdmin = isAdminUser(user);
  const changeScale = (delta) => setFontScale((s) => {
    const n = Math.min(1.5, Math.max(0.8, Math.round((s + delta) * 100) / 100));
    try { localStorage.setItem('licFontScale', String(n)); } catch { /* almacenamiento no disponible */ }
    return n;
  });

  const toggleLicencia = (id) => {
    if (!isActive) { setShowActivationGate(true); return; }
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
      
      {/* Control de tamaño de letra de este apartado (se guarda en el dispositivo) */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecciona el tamaño de letra</span>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => changeScale(-0.1)} disabled={fontScale <= 0.8} aria-label="Reducir tamaño de letra" className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 font-black text-xs flex items-center justify-center active:scale-90 transition disabled:opacity-30">A-</button>
          <span className="text-[10px] font-black text-slate-500 w-10 text-center tabular-nums">{Math.round(fontScale * 100)}%</span>
          <button onClick={() => changeScale(0.1)} disabled={fontScale >= 1.5} aria-label="Agrandar tamaño de letra" className="w-9 h-9 rounded-xl bg-emerald-600 text-white shadow-sm font-black text-base flex items-center justify-center active:scale-90 transition disabled:opacity-30">A+</button>
        </div>
      </div>

      <div style={{ zoom: fontScale }} className="flex flex-col animate-in fade-in duration-500 gap-6 pb-24 flex-1">

        {/* Tarjeta de Acceso al Asistente IA — solo visible para el admin (en pruebas) */}
        {isAdmin && (
        <button
          onClick={() => setShowChat(true)}
          className="w-full relative overflow-hidden group bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[2rem] p-5 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex flex-col text-left"
        >
          {/* Fondo Animado */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          
          <div className="relative flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/40 shadow-inner">
              {/* Logo Antigravity renderizado con CSS puro */}
              <div 
                className="drop-shadow-sm"
                style={{
                  width: '24px',
                  height: '24px',
                  background: 'conic-gradient(from 0deg, #EA4335 0%, #4285F4 25%, #34A853 50%, #FBBC04 75%, #EA4335 100%)',
                  clipPath: 'path("M12 0 C12 6.6 17.4 12 24 12 C17.4 12 12 17.4 12 24 C12 17.4 6.6 12 0 12 C6.6 12 12 6.6 12 0 Z")',
                  transform: 'scale(1.2)'
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-black uppercase tracking-widest text-[13px] leading-none">Asistente IA</h3>
                <Sparkles size={12} className="text-amber-300 animate-pulse" />
              </div>
              <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-wider leading-tight">
                Resuelve tus dudas del convenio en segundos
              </p>
            </div>
          </div>

          {/* Fake Input */}
          <div className="relative w-full bg-white rounded-xl p-3 flex items-center justify-between shadow-inner group-hover:bg-slate-50 transition-colors">
            <span className="text-slate-400 text-[11px] font-bold tracking-wide">Escribe tu consulta laboral aquí...</span>
            <div className="bg-emerald-600 p-1.5 rounded-lg text-white shrink-0 shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </div>
          </div>
        </button>
        )}

        {/* Botón Principal Desplegable: Licencias y Grados */}
        <button 
          onClick={() => setShowGeneral(!showGeneral)}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
            showGeneral ? 'bg-emerald-700 border-emerald-600 shadow-md ring-2 ring-emerald-600/20' : 'bg-emerald-600 border-emerald-700/20 shadow-sm hover:bg-emerald-500'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showGeneral ? 'bg-white text-emerald-700 shadow-lg' : 'bg-emerald-700/50 text-emerald-100'}`}>
              <FileText size={16} />
            </div>
            <span className="text-[11px] font-black uppercase text-white leading-snug tracking-tight text-left">Licencias y Grados de Parentesco</span>
          </div>
          <div className={`p-1.5 rounded-lg border transition-all shrink-0 ${showGeneral ? 'bg-white border-white text-emerald-700' : 'bg-emerald-700/50 border-emerald-700/50 text-emerald-100'}`}>
            {showGeneral ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {/* Contenido General Desplegable */}
        {showGeneral && (
          <div className="flex flex-col gap-6 animate-in slide-in-from-top-4 duration-300">
            
            {/* Botón Grados de Consanguinidad (Anidado) */}
            <button 
              onClick={() => setShowGrados(!showGrados)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                showGrados ? 'bg-emerald-600 border-emerald-500 shadow-md ring-2 ring-emerald-500/20' : 'bg-white border-slate-200 shadow-sm hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showGrados ? 'bg-white text-emerald-600 shadow-md' : 'bg-slate-100 text-slate-500'}`}>
                  <Users size={16} />
                </div>
                <span className={`text-[11px] font-black uppercase leading-snug tracking-tight text-left ${showGrados ? 'text-white' : 'text-slate-700'}`}>Guía de Grados de Parentesco</span>
              </div>
              <div className={`p-1.5 rounded-lg border transition-all shrink-0 ${showGrados ? 'bg-white border-white text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                {showGrados ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {/* Tabla de Grados (Condicional) */}
            {showGrados && (
              <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm animate-in slide-in-from-top-2 duration-300">
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
        )}
      </div>

      {showChat && <ChatModal onClose={() => setShowChat(false)} permissionState={permissionState} requestTokenManually={requestTokenManually} />}
      {showActivationGate && <ActivationGateModal onClose={() => setShowActivationGate(false)} />}
    </div>
  );
});
