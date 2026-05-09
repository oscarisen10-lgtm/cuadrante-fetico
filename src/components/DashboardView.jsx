import React, { useState } from 'react';
import { PieChart, Newspaper, Plus, Trash2, Link, X, Upload } from 'lucide-react';
import { StatBar, InputGroup } from './UIComponents';
import { formatTotalTime } from '../utils/dateUtils';
import { CONFIG, ADMIN_EMAIL } from '../constants/config';
import { toast, confirm } from './Toast';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const DashboardView = React.memo(function DashboardView({ user, stats, newsList, addNews, deleteNews, permissionState, requestTokenManually }) {
  const [showAddNewsModal, setShowAddNewsModal] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTag, setFormTag] = useState("Fetico");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);

  // Estados para Modal Push
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024 * 5) { 
        toast("La foto es demasiado grande (máx 5MB). Por favor, usa una foto más pequeña.", "warning");
        e.target.value = null; 
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmitNewsForm = async (e) => {
    e.preventDefault();
    if (!formTitle || !formDesc) { toast("Título y Texto son obligatorios.", "warning"); return; }
    
    setIsLoading(true);
    try {
      let imageUrl = null;
      
      // Upload image to Firebase Storage if one was selected
      if (selectedFile) {
        const fileName = `noticias/${Date.now()}_${selectedFile.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, selectedFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addNews({
        title: formTitle,
        desc: formDesc,
        tag: formTag,
        imageUrl: imageUrl, 
        linkUrl: null, 
        date: "Hoy",
        createdAt: Date.now()
      });
      setFormTitle("");
      setFormDesc("");
      setFormTag("Fetico");
      setSelectedFile(null);
      setPreviewUrl(null);
      setShowAddNewsModal(false);
      toast("¡Noticia publicada con éxito!", "success");
    } catch (error) {
      console.error("Error publicando:", error);
      toast("Hubo un error al guardar la noticia. " + error.message, "error");
    }
    setIsLoading(false);
  };

  const handleSendPush = async (e) => {
    e.preventDefault();
    if (!pushTitle || !pushBody) {
      toast("Título y mensaje son obligatorios.", "warning");
      return;
    }

    setIsLoading(true);
    try {
      // Solo guardamos la petición en Firestore. 
      // La Cloud Function en el servidor se encargará de enviarlo.
      await addNews({ 
        title: pushTitle, 
        desc: pushBody, 
        tag: "PUSH ENVIADO", 
        date: "Ahora", 
        imageUrl: null, 
        isPushRequest: true,
        createdAt: Date.now() 
      });
      
      toast("¡Petición guardada! El servidor la enviará en unos segundos.", "success");
      setPushTitle("");
      setPushBody("");
      setShowPushModal(false);
    } catch (error) {
      console.error("Error en el envío:", error);
      toast("Error crítico al enviar: " + error.message, "error");
    }
    setIsLoading(false);
  };

  const handleDeleteNews = async (id) => {
    const ok = await confirm("¿Seguro que quieres borrar esta noticia?");
    if (ok) {
      try { await deleteNews(id); toast("Noticia eliminada.", "success"); } 
      catch (error) { toast("Error: " + error.message, "error"); }
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-300 gap-5 pb-20">
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col min-h-[300px]">
        <h2 className="text-sm font-black text-slate-800 uppercase italic tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2 mb-6 shrink-0">
          <PieChart size={18} className="text-emerald-600" /> Resumen Calendario
        </h2>
        <div className="flex-1 flex flex-col justify-between py-2 space-y-5">
          <StatBar label="Horas Anuales" currentValue={formatTotalTime(stats.horasTotales)} percentage={(stats.horasTotales/(stats.targets?.horas || 1770))*100} totalValue={`${stats.targets?.horas || 1770}h`} color="bg-emerald-500" large={true} />
          <StatBar label="Días Trabajados" currentValue={stats.diasTrabajados} percentage={(stats.diasTrabajados/(stats.targets?.trabajados || 268))*100} totalValue={stats.targets?.trabajados || 268} color="bg-emerald-600" large={true} />
          <StatBar label="Días Libres" currentValue={stats.diasLibres} percentage={(stats.diasLibres/(stats.targets?.libres || 76))*100} totalValue={stats.targets?.libres || 76} color="bg-emerald-400" large={true} />
          
          {stats.targets?.ha > 0 && (
             <StatBar label="Días HA" currentValue={stats.contadorHA} percentage={(stats.contadorHA/stats.targets.ha)*100} totalValue={stats.targets.ha} color="bg-emerald-500" large={true} />
          )}
          
          <StatBar label="Calidad" currentValue={stats.findesCalidad} percentage={(stats.findesCalidad/(stats.targets?.calidad || 10))*100} totalValue={stats.targets?.calidad || 10} color="bg-emerald-600" large={true} />
          <StatBar label="DOMINGOS/FESTIVOS" currentValue={stats.domingosCount} percentage={(stats.domingosCount/(stats.targets?.domingos || 22))*100} totalValue={stats.targets?.domingos || 22} color="bg-emerald-500" large={true} />
        </div>
      </div>

      {/* Sección de Noticias (Solo visible si hay noticias o si el usuario es Admin) */}
      {(newsList.filter(n => !n.isPushRequest).length > 0 || user.email === ADMIN_EMAIL.toLowerCase()) && (
        <div className="bg-slate-900 rounded-[2rem] p-6 flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center mb-6 shrink-0 border-b border-white/5 pb-3">
            <h3 className="text-xs font-black text-white/50 uppercase tracking-widest flex items-center gap-2">
                <Newspaper size={14}/> Noticias
            </h3>
            {user.email === ADMIN_EMAIL.toLowerCase() && (
              <div className="flex gap-2">
                <button onClick={() => setShowPushModal(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl hover:bg-indigo-500 active:scale-95 transition-all shadow-md flex items-center gap-1 font-black text-[10px] uppercase">
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
                <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-30">
                  <Newspaper size={40} className="text-white mb-3" />
                  <p className="text-[10px] text-white text-center italic uppercase font-bold tracking-widest">No hay noticias publicadas</p>
                </div>
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
      )}

      {showAddNewsModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl w-full max-w-sm border border-emerald-50 animate-in zoom-in-95 flex flex-col max-h-[90dvh]">
            <div className="flex justify-between items-center mb-5 shrink-0 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-emerald-700 uppercase italic tracking-widest">Nueva Noticia</h3>
              <button onClick={() => { setShowAddNewsModal(false); setSelectedFile(null); setPreviewUrl(null); }} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400"><X size={20}/></button>
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
                        <Upload size={16}/> {selectedFile ? "Cambiar" : "Subir"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
                     </label>
                   </div>
                 </div>

                 {previewUrl && (
                    <div className="mt-3 relative border-2 border-emerald-100 rounded-2xl p-1 bg-emerald-50 animate-in fade-in">
                        <img src={previewUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl" />
                        <button type="button" onClick={()=>{ setSelectedFile(null); setPreviewUrl(null); }} className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:bg-rose-600"><X size={14}/></button>
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

      {/* MODAL PARA LANZAR PUSH (Solo Admin) */}
      {showPushModal && (
        <div className="fixed inset-0 z-[120] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-7 shadow-2xl w-full max-w-sm border border-indigo-50 animate-in zoom-in-95 flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-indigo-700 uppercase italic tracking-widest">Lanzar Alerta Push</h3>
                <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Se enviará a todos los dispositivos</span>
              </div>
              <button onClick={() => setShowPushModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSendPush} className="space-y-4">
               <InputGroup label="Título de la Alerta" name="push_title" small value={pushTitle} onChange={e=>setPushTitle(e.target.value)} placeholder="Ej: Nueva noticia disponible" />
               
               <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black text-indigo-600 uppercase ml-1 tracking-tight">Mensaje a mostrar</label>
                  <textarea value={pushBody} onChange={e=>setPushBody(e.target.value)} required rows={3} className="w-full bg-slate-50 border-none p-3 text-sm rounded-xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm text-slate-800" placeholder="Escribe aquí el contenido de la notificación..."></textarea>
               </div>

               <button type="submit" disabled={isLoading} className={`w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase text-xs active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2 mt-2 ${isLoading ? 'opacity-70' : ''}`}>
                 {isLoading ? 'ENVIANDO A DISPOSITIVOS...' : <><Newspaper size={16}/> LANZAR NOTIFICACIÓN</>}
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
