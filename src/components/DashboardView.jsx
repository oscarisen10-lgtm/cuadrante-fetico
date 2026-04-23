import React, { useState } from 'react';
import { PieChart, Newspaper, Plus, Trash2, Link, X, Upload } from 'lucide-react';
import { StatBar, InputGroup } from './UIComponents';
import { formatTotalTime } from '../utils/dateUtils';
import { CONFIG, ADMIN_EMAIL } from '../constants/config';

export function DashboardView({ user, stats, newsList, addNews, deleteNews }) {
  const [showAddNewsModal, setShowAddNewsModal] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTag, setFormTag] = useState("Fetico");
  const [formBase64Image, setFormBase64Image] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024 * 5) { 
        alert("La foto es demasiado grande (máx 5MB). Por favor, usa una foto más pequeña.");
        e.target.value = null; 
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => { 
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max_size = 800;
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setFormBase64Image(dataUrl);
        };
        img.src = reader.result;
      };
      reader.onerror = () => { alert("Error leyendo la foto."); }
      reader.readAsDataURL(file); 
    }
  };

  const handleSubmitNewsForm = async (e) => {
    e.preventDefault();
    if (!formTitle || !formDesc) { alert("Título y Texto son obligatorios."); return; }
    
    setIsLoading(true);
    try {
      await addNews({
        title: formTitle,
        desc: formDesc,
        tag: formTag,
        imageUrl: formBase64Image, 
        linkUrl: null, 
        date: "Hoy",
        createdAt: Date.now()
      });
      setFormTitle("");
      setFormDesc("");
      setFormTag("Fetico");
      setFormBase64Image(null);
      setShowAddNewsModal(false);
      alert("¡Noticia publicada con éxito! Ya se ve en todos los móviles.");
    } catch (error) {
      console.error("Error publicando:", error);
      alert("Hubo un error al guardar la noticia en la nube. Detalle: " + error.message);
    }
    setIsLoading(false);
  };
  const handleDeleteNews = async (id) => {
    if (window.confirm("¿Seguro que quieres borrar esta noticia?")) {
      try { await deleteNews(id); } 
      catch (error) { alert("Error: " + error.message); }
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-300 gap-5 pb-20">
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col min-h-[300px]">
        <h2 className="text-sm font-black text-slate-800 uppercase italic tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2 mb-6 shrink-0">
          <PieChart size={18} className="text-emerald-600" /> Resumen Calendario
        </h2>
        <div className="flex-1 flex flex-col justify-between py-2 space-y-5">
          <StatBar label="Horas Anuales" currentValue={formatTotalTime(stats.horasTotales)} percentage={(stats.horasTotales/(stats.targets?.horas || 1770))*100} totalValue={`${stats.targets?.horas || 1770}h`} color="bg-pink-300" large={true} />
          <StatBar label="Días Trabajados" currentValue={stats.diasTrabajados} percentage={(stats.diasTrabajados/(stats.targets?.trabajados || 268))*100} totalValue={stats.targets?.trabajados || 268} color="bg-indigo-400" large={true} />
          <StatBar label="Días Libres" currentValue={stats.diasLibres} percentage={(stats.diasLibres/(stats.targets?.libres || 76))*100} totalValue={stats.targets?.libres || 76} color="bg-amber-400" large={true} />
          
          {stats.targets?.ha > 0 && (
             <StatBar label="Días HA" currentValue={stats.contadorHA} percentage={(stats.contadorHA/stats.targets.ha)*100} totalValue={stats.targets.ha} color="bg-blue-500" large={true} />
          )}
          
          <StatBar label="Calidad" currentValue={stats.findesCalidad} percentage={(stats.findesCalidad/(stats.targets?.calidad || 10))*100} totalValue={stats.targets?.calidad || 10} color="bg-emerald-500" large={true} />
          <StatBar label="DOMINGOS/FESTIVOS" currentValue={stats.domingosCount} percentage={(stats.domingosCount/(stats.targets?.domingos || 22))*100} totalValue={stats.targets?.domingos || 22} color="bg-orange-400" large={true} />
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2rem] p-6 flex flex-col min-h-[350px]">
        <div className="flex justify-between items-center mb-6 shrink-0 border-b border-white/5 pb-3">
          <h3 className="text-xs font-black text-white/50 uppercase tracking-widest flex items-center gap-2">
              <Newspaper size={14}/> Noticias
          </h3>
          {user.email === ADMIN_EMAIL.toLowerCase() && (
            <div className="flex gap-2">
              <button onClick={() => {
                 const title = prompt("Escribe el Título de la Alerta Push:");
                 if(title) {
                   const body = prompt("Escribe el Mensaje de la Alerta:");
                   if(body) {
                      // Save to Firestore so a backend/Cloud Function can pick it up
                      addNews({ title, desc: body, tag: "ALERTA PUSH", date: "Ahora", imageUrl: null, isPushRequest: true })
                      alert("Petición de Push guardada en la base de datos.");
                   }
                 }
              }} className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl hover:bg-indigo-500 active:scale-95 transition-all shadow-md flex items-center gap-1 font-black text-[10px] uppercase">
                 Push
              </button>
              <button onClick={() => setShowAddNewsModal(true)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl hover:bg-emerald-500 active:scale-95 transition-all shadow-md flex items-center gap-1 font-black text-[10px] uppercase">
                 <Plus size={14}/> Nueva
              </button>
            </div>
          )}
        </div>
        <div className="space-y-4 overflow-y-auto pr-1 scrollbar-hide">
            {newsList.filter(n => !n.isPushRequest).length === 0 ? (
               <p className="text-[10px] text-white/40 text-center italic py-6 uppercase font-bold">No hay noticias publicadas.</p>
            ) : (
              newsList.filter(n => !n.isPushRequest).map(news => (
                  <div key={news.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col">
                      <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter bg-emerald-400/10 px-2 py-0.5 rounded-md">{news.tag}</span>
                            <span className="text-[8px] text-white/40">{news.date}</span>
                          </div>
                          {user.email === ADMIN_EMAIL.toLowerCase() && (
                            <button onClick={() => handleDeleteNews(news.id)} className="text-rose-400 p-2 bg-rose-400/10 hover:bg-rose-500/20 rounded-xl transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
                      </div>
                      {news.imageUrl && <img src={news.imageUrl} alt="Noticia" className="w-full h-auto rounded-xl mb-4 border border-white/10 shadow-sm animate-in fade-in" />}
                      
                      <h4 className="text-sm font-black text-white uppercase leading-tight mb-2 tracking-tight">{news.title}</h4>
                      <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{news.desc}</p>
                      {news.linkUrl && (
                        <a href={news.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-4 bg-white/10 hover:bg-white/20 transition-colors text-white py-3 px-3 rounded-xl text-[10px] font-bold uppercase text-center flex items-center justify-center gap-2">
                          <Link size={14}/> Ver más información
                        </a>
                      )}
                  </div>
              ))
            )}
        </div>
      </div>

      {showAddNewsModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl w-full max-w-sm border border-emerald-50 animate-in zoom-in-95 flex flex-col max-h-[90dvh]">
            <div className="flex justify-between items-center mb-5 shrink-0 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-emerald-700 uppercase italic tracking-widest">Nueva Noticia</h3>
              <button onClick={() => { setShowAddNewsModal(false); setFormBase64Image(null); }} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmitNewsForm} className="flex-1 flex flex-col space-y-4 overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide space-y-4 pb-2">
                 <InputGroup label="Titular de la noticia" name="title" small value={formTitle} onChange={e=>setFormTitle(e.target.value)} />
                 
                 <div className="space-y-1.5 flex flex-col">
                    <label className="text-xs font-black text-emerald-600 uppercase ml-1 tracking-tight">Cuerpo del texto</label>
                    <textarea value={formDesc} onChange={e=>setFormDesc(e.target.value)} required rows={4} className="w-full bg-slate-50 border-none p-3 text-sm rounded-xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm text-slate-800 leading-relaxed" placeholder="Escribe aquí el comunicado..."></textarea>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3 items-end">
                   <InputGroup label="Etiqueta" name="tag" small value={formTag} onChange={e=>setFormTag(e.target.value)} placeholder="Ej: Supercor" />
                   
                   <div className="space-y-1.5 flex flex-col">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Foto (Opcional)</label>
                     <label className="bg-slate-100 border border-slate-200 text-slate-600 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 active:scale-95 transition-all text-xs font-bold shadow-inner">
                        <Upload size={16}/> {formBase64Image ? "Cambiar" : "Subir"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
                     </label>
                   </div>
                 </div>

                 {formBase64Image && (
                    <div className="mt-3 relative border-2 border-emerald-100 rounded-2xl p-1 bg-emerald-50 animate-in fade-in">
                        <img src={formBase64Image} alt="Preview" className="w-full h-32 object-cover rounded-xl" />
                        <button type="button" onClick={()=>setFormBase64Image(null)} className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:bg-rose-600"><X size={14}/></button>
                    </div>
                 )}
              </div>

              <div className="shrink-0 pt-3 border-t border-slate-100 mt-2">
                  <button type="submit" disabled={isLoading} className={`w-full bg-emerald-600 text-white font-black py-3.5 rounded-2xl uppercase text-xs active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2 ${isLoading ? 'opacity-70' : ''}`}>
                    {isLoading ? 'PUBLICANDO EN LA NUBE...' : <><Plus size={16}/> PUBLICAR NOTICIA</>}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
