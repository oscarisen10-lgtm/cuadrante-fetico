import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Info, Users, Clock, ClipboardCheck } from 'lucide-react';
import { LICENCIAS_CATEGORIES, LICENCIAS_ET_CATEGORIES, LICENCIAS_ET_NOTA, GRADOS_CONSANGUINIDAD } from '../constants/licenciasData';
import { ActivationGateModal } from './LockedView';
import { hasKnownConvenio } from '../constants/config';
import { useActivationGate } from '../hooks/useActivationGate';

// Mismo relieve que el resto de la app (Resumen, botones de Fichar, Agenda):
// degradado vertical + sombra proyectada + brillo interior arriba. Al desplegarse,
// el botón se hunde: fuera la sombra exterior, dentro una sombra que da profundidad.
const BOTON_RELIEVE = {
  background: 'linear-gradient(180deg,#34d399,#059669 58%,#047857)',
  boxShadow: '0 8px 18px rgba(5,150,105,0.4), inset 0 1.5px 1px rgba(255,255,255,0.45)',
};
const BOTON_HUNDIDO = {
  background: 'linear-gradient(180deg,#047857,#065f46)',
  boxShadow: '0 2px 5px rgba(4,120,87,0.28), inset 0 3px 7px rgba(0,0,0,0.32)',
};
// El de grados en reposo es claro, no verde, pero con el mismo volumen.
const BOTON_CLARO_RELIEVE = {
  background: 'linear-gradient(180deg,#ffffff,#eef1f4)',
  boxShadow: '0 8px 16px -6px rgba(15,23,42,0.28), inset 0 1.5px 1px rgba(255,255,255,0.95)',
  border: '1px solid rgba(15,23,42,0.07)',
};
// Panel claro con volumen, igual que la tarjeta del Resumen.
const PANEL_CLARO = {
  background: 'linear-gradient(180deg,#ffffff,#f8f9fb)',
  boxShadow: '0 14px 34px -16px rgba(30,41,59,0.25), inset 0 1.5px 1px rgba(255,255,255,0.9)',
  border: '1px solid rgba(15,23,42,0.05)',
};

export const LicenciasView = React.memo(function LicenciasView({ user, permissionState, requestTokenManually, isActive = true }) {
  // Quien trabaja en ANGED ve los permisos de SU convenio. Del resto no conocemos
  // el convenio, así que se les enseña el mínimo legal del Estatuto: les aplica
  // seguro, y su convenio solo puede mejorarlo (lo advierte LICENCIAS_ET_NOTA).
  const esANGED = hasKnownConvenio(user);
  const categorias = esANGED ? LICENCIAS_CATEGORIES : LICENCIAS_ET_CATEGORIES;
  const [expandedLicencia, setExpandedLicencia] = useState(null);
  const [showGrados, setShowGrados] = useState(false);
  // Cuentas PENDIENTES: la lista de permisos SE VE; el aviso salta solo al intentar
  // ABRIR el detalle de un permiso (ver hooks/useActivationGate).
  const { requireActive, gateVisible, closeGate } = useActivationGate(isActive);
  const [fontScale, setFontScale] = useState(() => {
    try { return parseFloat(localStorage.getItem('licFontScale')) || 1; } catch { return 1; }
  });

  const changeScale = (delta) => setFontScale((s) => {
    const n = Math.min(1.5, Math.max(0.8, Math.round((s + delta) * 100) / 100));
    try { localStorage.setItem('licFontScale', String(n)); } catch { /* almacenamiento no disponible */ }
    return n;
  });

  const toggleLicencia = (id) => {
    if (!requireActive()) return;
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
      
      {/* Control de tamaño de letra de este apartado (se guarda en el dispositivo).
          data-tour: punto que ilumina el tutorial (ver constants/screenTips). */}
      <div data-tour="lic-fuente" className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecciona el tamaño de letra</span>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => changeScale(-0.1)} disabled={fontScale <= 0.8} aria-label="Reducir tamaño de letra" className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 font-black text-xs flex items-center justify-center active:scale-90 transition disabled:opacity-30">A-</button>
          <span className="text-[10px] font-black text-slate-500 w-10 text-center tabular-nums">{Math.round(fontScale * 100)}%</span>
          <button onClick={() => changeScale(0.1)} disabled={fontScale >= 1.5} aria-label="Agrandar tamaño de letra" className="w-9 h-9 rounded-xl bg-emerald-600 text-white shadow-sm font-black text-base flex items-center justify-center active:scale-90 transition disabled:opacity-30">A+</button>
        </div>
      </div>

      <div style={{ zoom: fontScale }} className="flex flex-col animate-in fade-in duration-500 gap-6 pb-24 flex-1">

        {/* Antes esto colgaba de un desplegable "Licencias y Grados de Parentesco"
            que había que abrir para ver nada. Ahora el contenido está siempre a la
            vista; el único desplegable que queda es el de los grados. */}
        <div className="flex flex-col gap-6">

            {/* Botón Grados de Consanguinidad (Anidado) */}
            <button
              data-tour="lic-grados"
              onClick={() => setShowGrados(!showGrados)}
              className="btn3d w-full flex items-center justify-between p-4 rounded-2xl"
              style={showGrados ? BOTON_HUNDIDO : BOTON_CLARO_RELIEVE}
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
              <div className="rounded-[2rem] overflow-hidden animate-in slide-in-from-top-2 duration-300" style={PANEL_CLARO}>
                <div className="p-4 bg-slate-50/70 border-b border-slate-100">
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

            {/* Aviso permanente para quien ve el Estatuto: lo que hay debajo es el
                suelo legal, no su convenio. Va aquí y no solo en el tutorial porque
                el tutorial se ve una vez y esta pantalla se abre muchas más. */}
            {!esANGED && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 mb-6">
                <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest leading-none mb-2">
                  Permisos del Estatuto de los Trabajadores
                </p>
                <p className="text-[10px] text-slate-600 font-bold leading-snug">{LICENCIAS_ET_NOTA}</p>
              </div>
            )}

            {/* Categorías de Licencias */}
            <div className="space-y-8">
              {categorias.map((cat, catIdx) => (
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
                        <div
                          key={idx}
                          /* La primera licencia es la que ilumina el tutorial. A quien
                             trabaja fuera de ANGED se le pone otro id: este contenido es
                             el convenio de ANGED, no el suyo, y el aviso se lo dice. */
                          data-tour={catIdx === 0 && idx === 0 ? (esANGED ? 'lic-item' : 'lic-item-otra') : undefined}
                          className="rounded-2xl overflow-hidden transition-all duration-300"
                          /* El relieve va en la TARJETA, no en su cabecera: el
                             overflow-hidden de aquí recortaría la sombra exterior
                             y el botón se vería plano. Cerrada, la tarjeta entera
                             es el botón en relieve; abierta, pasa a panel claro con
                             la cabecera hundida encima. */
                          style={isExpanded ? PANEL_CLARO : BOTON_RELIEVE}
                        >
                          <div
                            className="p-4 cursor-pointer flex justify-between items-center gap-4 transition-all"
                            style={isExpanded ? BOTON_HUNDIDO : undefined}
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

                                {lic.documentacion && (
                                  <div className="flex gap-3">
                                    <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600 h-fit"><ClipboardCheck size={14} /></div>
                                    <div>
                                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Documentación Necesaria</p>
                                      <p className="text-[11px] text-slate-700 font-bold leading-tight mt-0.5">{lic.documentacion}</p>
                                    </div>
                                  </div>
                                )}
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

      {gateVisible && <ActivationGateModal onClose={closeGate} />}
    </div>
  );
});
