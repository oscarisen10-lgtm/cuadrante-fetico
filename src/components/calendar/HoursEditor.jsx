import React from 'react';
import { X } from 'lucide-react';

/**
 * HoursEditor — Modal for manually adjusting hours/minutes/turn for a day.
 */
export function HoursEditor({ editingDay, editHH, editmm, editTurn, setEditHH, setEditmm, setEditTurn, setEditingDay, saveEditedHours }) {
  if (!editingDay) return null;

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

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" role="dialog" aria-modal="true" aria-label="Editor de horas">
      <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl w-full max-w-xs animate-in zoom-in-95 flex flex-col">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
          <span className="text-xs font-black uppercase text-rose-600 italic tracking-widest">Ajuste Manual</span>
          <button onClick={() => setEditingDay(null)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200 text-slate-300" aria-label="Cerrar editor"><X size={20}/></button>
        </div>
        <div className="flex items-center justify-center gap-4 mb-8 bg-slate-50 py-6 rounded-3xl text-slate-800 border border-slate-100 shadow-inner">
          <div className="flex flex-col items-center">
            <label htmlFor="edit-hours" className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Horas</label>
            <input id="edit-hours" type="number" min="0" max="24" value={editHH} onChange={e=>setEditHH(e.target.value)} className="w-20 bg-white border border-slate-200 p-3 rounded-2xl text-center text-3xl font-black outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all shadow-sm" aria-label="Horas trabajadas"/>
          </div>
          <span className="font-black text-4xl text-slate-300 mt-6" aria-hidden="true">:</span>
          <div className="flex flex-col items-center">
            <label htmlFor="edit-minutes" className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Minutos</label>
            <input id="edit-minutes" type="number" min="0" max="59" value={editmm} onChange={e=>handleMinutesChange(e.target.value)} className="w-20 bg-white border border-slate-200 p-3 rounded-2xl text-center text-3xl font-black outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all shadow-sm" aria-label="Minutos trabajados"/>
          </div>
        </div>
        
        <div className="flex justify-center gap-2 mb-6" role="radiogroup" aria-label="Turno">
           <button onClick={() => setEditTurn('morning')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editTurn === 'morning' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`} role="radio" aria-checked={editTurn === 'morning'}>Mañana</button>
           <button onClick={() => setEditTurn('afternoon')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editTurn === 'afternoon' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`} role="radio" aria-checked={editTurn === 'afternoon'}>Tarde</button>
        </div>

        <button onClick={saveEditedHours} className="w-full bg-rose-500 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all">GUARDAR CAMBIOS</button>
      </div>
    </div>
  );
}
