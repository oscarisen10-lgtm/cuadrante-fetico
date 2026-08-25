import { X } from 'lucide-react';

/**
 * HoursEditor — Modal para ajustar a mano las horas, el turno y el HA de un día.
 *
 * Sirve para DOS cosas, según `editMode`:
 *   'work' — "Ajustar Horas": la jornada que se trabajó.
 *   'sick' — "Baja": la jornada que el cuadrante tenía PROGRAMADA. Se registra
 *            igual (horas, turno, HA) porque en ANGED esas horas cuentan para el
 *            cómputo anual aunque no llegaras a trabajarlas por estar de baja.
 *
 * En modo baja aparece además "Día libre" como turno: si el cuadrante te daba
 * libre ese día, la baja no suma horas, suma día libre.
 */
export function HoursEditor({
  editingDay, editHH, editmm, editTurn, editHA, editMode = 'work',
  setEditHH, setEditmm, setEditTurn, setEditHA, setEditingDay, saveEditedHours,
}) {
  if (!editingDay) return null;

  const esBaja = editMode === 'sick';
  const esLibre = esBaja && editTurn === 'rest';

  const handleMinutesChange = (val) => {
    let m = parseInt(val) || 0;
    let h = parseInt(editHH) || 0;
    if (m >= 60) {
      setEditHH((h + Math.floor(m / 60)).toString());
      setEditmm((m % 60).toString().padStart(2, '0'));
    } else {
      setEditmm(val);
    }
  };

  // El acento del modal sigue al modo: rosa para el ajuste normal, morado para la
  // baja (el mismo morado que su botón y su celda en el calendario).
  const acento = esBaja
    ? { texto: 'text-purple-700', borde: 'focus:border-purple-400', anillo: 'focus:ring-purple-100', boton: 'bg-purple-600', activo: 'bg-purple-600' }
    : { texto: 'text-rose-600', borde: 'focus:border-rose-400', anillo: 'focus:ring-rose-100', boton: 'bg-rose-500', activo: 'bg-emerald-600' };

  const turnoBtn = (valor, etiqueta) => (
    <button
      onClick={() => setEditTurn(valor)}
      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
        editTurn === valor ? `${acento.activo} text-white shadow-md` : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
      }`}
      role="radio"
      aria-checked={editTurn === valor}
    >
      {etiqueta}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" role="dialog" aria-modal="true" aria-label={esBaja ? 'Registrar baja laboral' : 'Editor de horas'}>
      <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl w-full max-w-xs animate-in zoom-in-95 flex flex-col">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
          <span className={`text-xs font-black uppercase italic tracking-widest ${acento.texto}`}>
            {esBaja ? 'Baja Laboral' : 'Ajuste Manual'}
          </span>
          <button onClick={() => setEditingDay(null)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200 text-slate-300" aria-label="Cerrar editor"><X size={20}/></button>
        </div>

        {esBaja && (
          <p className="text-[10px] text-slate-500 font-bold leading-snug mb-5 -mt-1">
            Apunta la jornada que tenías <span className="text-purple-700">programada</span>: cuenta para el cómputo anual aunque no la trabajaras.
          </p>
        )}

        {/* Con "Día libre" no hay horas que poner: el cuadrante no te programaba ninguna. */}
        {!esLibre && (
          <div className="flex items-center justify-center gap-4 mb-6 bg-slate-50 py-6 rounded-3xl text-slate-800 border border-slate-100 shadow-inner">
            <div className="flex flex-col items-center">
              <label htmlFor="edit-hours" className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Horas</label>
              <input id="edit-hours" type="number" min="0" max="24" value={editHH} onChange={e=>setEditHH(e.target.value)} className={`w-20 bg-white border border-slate-200 p-3 rounded-2xl text-center text-3xl font-black outline-none ${acento.borde} focus:ring-2 ${acento.anillo} transition-all shadow-sm`} aria-label="Horas trabajadas"/>
            </div>
            <span className="font-black text-4xl text-slate-300 mt-6" aria-hidden="true">:</span>
            <div className="flex flex-col items-center">
              <label htmlFor="edit-minutes" className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Minutos</label>
              <input id="edit-minutes" type="number" min="0" max="59" value={editmm} onChange={e=>handleMinutesChange(e.target.value)} className={`w-20 bg-white border border-slate-200 p-3 rounded-2xl text-center text-3xl font-black outline-none ${acento.borde} focus:ring-2 ${acento.anillo} transition-all shadow-sm`} aria-label="Minutos trabajados"/>
            </div>
          </div>
        )}

        <div className="flex justify-center gap-2 mb-5" role="radiogroup" aria-label="Turno programado">
          {turnoBtn('morning', 'Mañana')}
          {turnoBtn('afternoon', 'Tarde')}
          {/* Solo en baja: en una jornada normal, un día libre se marca con su propio
              botón ("Día Libre") y no pasa por este editor. */}
          {esBaja && turnoBtn('rest', 'Día libre')}
        </div>

        {/* HA a mano. En "Ajustar Horas" se deduce del umbral del convenio, pero en una
            baja no hay jornada real de la que deducirlo: lo dice el cuadrante, así que
            lo marca el usuario. Se ofrece en los dos modos para poder corregirlo. */}
        {!esLibre && (
          <button
            onClick={() => setEditHA(!editHA)}
            className={`flex items-center justify-between w-full py-3 px-4 rounded-xl mb-6 transition-all ${editHA ? 'bg-cyan-50 border border-cyan-200' : 'bg-slate-50 border border-slate-100'}`}
            role="switch"
            aria-checked={editHA}
          >
            <span className={`text-[10px] font-black uppercase tracking-widest ${editHA ? 'text-cyan-700' : 'text-slate-400'}`}>Día HA</span>
            <span className={`w-10 h-5 rounded-full relative transition-colors ${editHA ? 'bg-cyan-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 size-4 bg-white rounded-full shadow transition-all ${editHA ? 'left-5' : 'left-0.5'}`} />
            </span>
          </button>
        )}

        <button onClick={saveEditedHours} className={`w-full ${acento.boton} text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all`}>
          {esBaja ? 'GUARDAR BAJA' : 'GUARDAR CAMBIOS'}
        </button>
      </div>
    </div>
  );
}
