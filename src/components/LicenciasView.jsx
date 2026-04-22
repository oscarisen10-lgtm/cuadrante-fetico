import React, { useState } from 'react';
import { FileText, Plus, Edit3, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { ADMIN_EMAIL } from '../constants/config';

export function LicenciasView({ user, licenciasList, addLicencia, updateLicencia, deleteLicencia }) {
  const [expandedLicencia, setExpandedLicencia] = useState(null);

  const loadDefaultLicencias = async () => {
    const defaults = [
      { order: 1, title: "Accidente grave/Hospitalización familiar", desc: "REGLAS:\n• 5 días naturales (según RDL 5/2023) por hospitalización o enfermedad grave de familiares hasta 2º grado.\nDOCUMENTACIÓN:\n• Justificante médico de ingreso o gravedad." },
      { order: 2, title: "Concurrencia exámenes finales", desc: "REGLAS:\n• Tiempo indispensable para la realización de exámenes finales en centros oficiales.\nDOCUMENTACIÓN:\n• Justificante de asistencia sellado." },
      { order: 3, title: "Consulta médica externa", desc: "REGLAS:\n• Tiempo necesario para asistir a consultas de médicos especialistas de la Seguridad Social.\nDOCUMENTACIÓN:\n• Cita previa y justificante de asistencia." },
      { order: 4, title: "Enfermedad grave diagnosticada familiar", desc: "REGLAS:\n• 5 días naturales por enfermedad grave diagnosticada de familiares hasta 2º grado.\nDOCUMENTACIÓN:\n• Informe médico acreditando diagnóstico 'grave'." },
      { order: 5, title: "Examen carnet de conducir", desc: "REGLAS:\n• Tiempo indispensable para exámenes teórico y práctico del permiso de conducir.\nDOCUMENTACIÓN:\n• Justificante de la autoescuela o la DGT." },
      { order: 6, title: "Exámenes prenatales tec. prep. parto", desc: "REGLAS:\n• Tiempo indispensable para exámenes prenatales coincidente con jornada.\nDOCUMENTACIÓN:\n• Justificante médico." },
      { order: 7, title: "Fallecimiento familiar hasta 2º grado", desc: "REGLAS:\n• 2 días naturales (4 si requiere desplazamiento fuera de la provincia).\nDOCUMENTACIÓN:\n• Certificado de defunción y libro de familia." },
      { order: 8, title: "Fenómeno meteorológico adverso", desc: "REGLAS:\n• Pendiente de acuerdo de empresa o fuerza mayor acreditada." },
      { order: 9, title: "Firma notarial adquisición de vivienda", desc: "REGLAS:\n• Tiempo indispensable para la firma de la vivienda habitual.\nDOCUMENTACIÓN:\n• Justificante de notaría." },
      { order: 10, title: "Matrimonio / Pareja de hecho", desc: "REGLAS:\n• 15 días naturales continuados por matrimonio o registro oficial.\nDOCUMENTACIÓN:\n• Acta de matrimonio o certificado de registro." },
      { order: 11, title: "Matrimonio parientes hasta 2º grado", desc: "REGLAS:\n• 1 día natural (el día de la boda).\nDOCUMENTACIÓN:\n• Justificante del evento." },
      { order: 12, title: "Permiso acompañamiento reproducción asistida", desc: "PLAN DE IGUALDAD:\n• Redactar aquí las horas/días acordados en el plan específico." }
    ];

    if (window.confirm("¿Crear la lista base con los textos del BOE actualizados?")) {
      for (const item of defaults) {
         await addLicencia(item);
      }
      alert("¡Lista creada!");
    }
  };

  const handleAddLicencia = async () => {
    const title = prompt("Escribe la CABECERA (título) de la nueva licencia:");
    if (!title) return;
    const desc = prompt("Escribe la EXPLICACIÓN o reglas:");
    if (!desc) return;
    
    try {
      await addLicencia({
        order: licenciasList.length + 1,
        title: title,
        desc: desc
      });
    } catch (error) {
      alert("Error añadiendo licencia: " + error.message);
    }
  };

  const handleEditTitleLicencia = async (lic) => {
    const newTitle = prompt(`Escribe la NUEVA CABECERA para esta licencia:`, lic.title);
    if (newTitle !== null && newTitle.trim() !== "") {
      try {
        await updateLicencia(lic.id, { title: newTitle });
      } catch (error) {
        alert("Error actualizando título: " + error.message);
      }
    }
  };

  const handleEditLicencia = async (lic) => {
    const newDesc = prompt(`Explicación para:\n${lic.title}`, lic.desc);
    if (newDesc !== null && newDesc.trim() !== "") {
      try {
        await updateLicencia(lic.id, { desc: newDesc });
      } catch (error) {
        alert("Error actualizando texto: " + error.message);
      }
    }
  };

  const handleDeleteLicencia = async (id) => {
    if (window.confirm("¿Seguro que quieres borrar esta licencia definitivamente?")) {
      try { await deleteLicencia(id); } 
      catch (error) { alert("Error borrando licencia: " + error.message); }
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-300 gap-4 pb-20">
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col min-h-[300px]">
        <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-100 pb-3">
          <h2 className="text-sm font-black text-slate-800 uppercase italic tracking-widest flex items-center gap-2">
            <FileText size={18} className="text-emerald-600" /> Permisos & Licencias
          </h2>
          
          {user.email === ADMIN_EMAIL.toLowerCase() && (
             <div className="flex gap-2">
               {licenciasList.length === 0 && (
                 <button onClick={loadDefaultLicencias} className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase shadow-sm active:scale-95">
                   Base
                 </button>
               )}
               <button onClick={handleAddLicencia} className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 flex items-center gap-1">
                 <Plus size={14}/> Nueva
               </button>
             </div>
          )}
        </div>

        <div className="space-y-3 overflow-y-auto pr-1 scrollbar-hide">
          {licenciasList.map(lic => (
            <div key={lic.id} className="border border-slate-100 rounded-2xl bg-slate-50 overflow-hidden transition-all">
              <div 
                className={`flex justify-between items-center p-3 cursor-pointer hover:bg-slate-100 transition-colors ${expandedLicencia === lic.id ? 'bg-slate-100' : ''}`}
                onClick={() => setExpandedLicencia(expandedLicencia === lic.id ? null : lic.id)}
              >
                <h3 className="flex-1 text-[11px] font-black text-slate-800 uppercase leading-snug pr-2 tracking-tight">{lic.title}</h3>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  {user.email === ADMIN_EMAIL.toLowerCase() && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEditTitleLicencia(lic); }} 
                        className="text-blue-500 p-1.5 bg-white hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 shadow-sm"
                        title="Editar Título"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEditLicencia(lic); }} 
                        className="text-emerald-600 p-1.5 bg-white hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200 shadow-sm"
                        title="Editar Texto"
                      >
                        <FileText size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteLicencia(lic.id); }} 
                        className="text-rose-500 p-1.5 bg-white hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 shadow-sm"
                        title="Borrar Licencia"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <div className="text-slate-400 bg-white p-1.5 rounded-lg border border-slate-200 ml-1">
                    {expandedLicencia === lic.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>
              
              {expandedLicencia === lic.id && (
                <div className="px-4 pb-5 pt-2 text-xs text-slate-600 font-medium whitespace-pre-wrap animate-in slide-in-from-top-2 border-t border-slate-200 mt-1 bg-white leading-relaxed tracking-wide">
                  {lic.desc}
                </div>
              )}
            </div>
          ))}
          
          {licenciasList.length === 0 && (
            <p className="text-[10px] text-slate-400 text-center italic py-10 uppercase font-bold tracking-widest">Aún no hay licencias cargadas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
