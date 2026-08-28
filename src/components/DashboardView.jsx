import React, { useState, useMemo } from 'react';
import { PieChart, Newspaper, Plus, Trash2, Link, X, Upload, HardHat } from 'lucide-react';
import { StatBar, StatCounter, InputGroup } from './UIComponents';
import { formatTotalTime } from '../utils/dateUtils';
import { isAdminUser, tieneFindeLargoDe4Dias, hasKnownConvenio } from '../constants/config';
import { toast, confirm } from '../services/toastBus';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageUtils';

/**
 * Devuelve el enlace solo si es http(s); si no, null (y el botón no se pinta).
 * El campo `linkUrl` viene del documento de la noticia, y aunque hoy el compositor
 * del admin siempre lo deja a null, nada en el esquema impide que otro camino de
 * escritura meta un `javascript:…` que se ejecutaría al tocar el botón.
 */
const enlaceSeguro = (url) => {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const { protocol } = new URL(url, window.location.origin);
    return protocol === 'http:' || protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
};

// newsOnly: cuentas pendientes de activación (o admin en Modo Admin) → el Resumen
// muestra SOLO la sección de Noticias, sin las estadísticas personales.
export const DashboardView = React.memo(function DashboardView({ user, stats, newsList, addNews, deleteNews, permissionState, requestTokenManually, onImageClick, newsOnly = false }) {
  const isAdmin = isAdminUser(user);
  // El cuadrante de ECI aún no está modelado, así que sus cifras no significarían nada.
  // Solo aplica al ECI de verdad: si alguien de fuera escribió "ECI" a mano en su
  // empresa, es otra cosa y su resumen se pinta con normalidad (sin objetivos).
  const esECI = hasKnownConvenio(user) && user?.company === "ECI";

  // Desglose de findes de calidad según el puesto. Algunos puestos (coordinadores de
  // frescos, jefes) tienen finde largo de 4 días (sáb-dom-lun-mar) con reparto
  // 2 cortos / 8 largos; el resto, largo de 3 días (sáb-dom-lun) con reparto 6 cortos / 4 largos.
  const findeLargo4Dias = tieneFindeLargoDe4Dias(user?.rank);
  const calidadLargoLabel = findeLargo4Dias ? "Sáb-Dom-Lun-Mar" : "Sáb-Dom-Lun";

  // Objetivos del usuario (null = empresa no verificada que aún no ha puesto los
  // suyos). Cada métrica se pinta con barra de progreso SOLO si tiene objetivo;
  // si no, va como contador a secas. Así el resumen de quien está fuera de ANGED
  // enseña lo que lleva trabajado sin compararlo con una cifra que no es la suya.
  const objetivo = (key) => stats.targets?.[key] || 0;
  const sinObjetivos = !stats.targets;

  // ── Objetivos recortados por la fecha de alta ──
  // Quien entró a mitad de año no tiene los topes enteros del convenio, sino su
  // parte proporcional (ver config.proporcionAnual): de alta el 6 de julio son 179
  // de 365 días, y 22 domingos se quedan en 11. `stats.prorrateo` es null cuando el
  // año va completo, que es el caso de casi todo el mundo.
  const prorrateo = stats.prorrateo;
  const conProrrateo = !!prorrateo && !sinObjetivos;
  const anual = (key) => stats.targetsAnuales?.[key] || 0;
  // Aclaración junto a la etiqueta: sin ella, ver un 11 donde el compañero de al
  // lado tiene un 22 se lee como un fallo de la app, no como el convenio aplicado.
  const deAlAnio = (key, sufijo = "") =>
    conProrrateo && anual(key) > 0 && anual(key) !== objetivo(key)
      ? `de ${anual(key)}${sufijo} al año`
      : undefined;
  const fechaLegible = (iso) => {
    const [y, m, d] = String(iso).split('-');
    return d && m && y ? `${d}/${m}/${y}` : iso;
  };

  // El reparto corto/largo se recorta con la MISMA proporción que el objetivo de
  // calidad del que sale; si no, alguien con 5 findes de objetivo vería debajo un
  // desglose de 6 + 4 que suma 10 y no cuadra con su propia barra.
  const recorta = (n) => (conProrrateo ? Math.round(n * prorrateo.proporcion) : n);
  const calidadCortoTarget = recorta(findeLargo4Dias ? 2 : 6);
  const calidadLargoTarget = recorta(findeLargo4Dias ? 8 : 4);

  // El tutorial explica cada barra hablando del convenio, y a quien está fuera de
  // ANGED eso no le vale: sus objetivos se los pone él. En vez de meterle lógica
  // de usuario al motor de tips, se les cambia el data-tour: los pasos `optional`
  // de screenTips ya se caen solos cuando su elemento no está en pantalla, así
  // que cada tipo de usuario recibe su propia explicación. Ver screenTips.jsx.
  const sinConvenio = !hasKnownConvenio(user);
  const tour = (id) => (sinConvenio ? `${id}-libre` : id);

  // Las peticiones de push (isPushRequest) son avisos puntuales, no publicaciones:
  // nunca salen en el feed. Se filtran UNA vez y no tres veces por render, que era
  // lo que pasaba al repetir `newsList.filter(...)` en cada punto donde hacía falta.
  const noticiasVisibles = useMemo(() => newsList.filter(n => !n.isPushRequest), [newsList]);

  const [showAddNewsModal, setShowAddNewsModal] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTag, setFormTag] = useState("");
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
      // El límite del original es generoso (12MB) porque ANTES de subir se comprime
      // en el dispositivo (ver compressImage): lo que llega a Storage son ~150-400 KB.
      if (file.size > 1024 * 1024 * 12) {
        toast("La foto es demasiado grande (máx 12MB). Por favor, usa una foto más pequeña.", "warning");
        e.target.value = null;
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
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

      // Upload image to Firebase Storage if one was selected.
      // Se comprime EN EL DISPOSITIVO antes de subir (coste de descarga ~20× menor
      // para cada usuario que abra el cartel; ver utils/imageUtils.js).
      if (selectedFile) {
        const { blob, type, ext } = await compressImage(selectedFile);
        const fileName = `noticias/${Date.now()}_cartel.${ext}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, blob, { contentType: type });
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
      setFormTag("");
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
      {permissionState !== 'granted' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 flex items-center gap-3.5 shadow-sm animate-in slide-in-from-top-3">
          <div className="w-9 h-9 bg-amber-500/15 rounded-2xl flex items-center justify-center shrink-0 border border-amber-500/25">
             <span className="text-xl animate-bounce">🔔</span>
          </div>
          <div className="flex-1 min-w-0">
             <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest leading-none mb-1">¡Activar Notificaciones!</h4>
             <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight leading-tight">
               {permissionState === 'denied'
                 ? "Permiso bloqueado. Actívalo en los Ajustes del móvil."
                 : "Es obligatorio para recibir avisos de tus turnos y cuadrantes."
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
      {!newsOnly && esECI && (
      <div className="rounded-[2rem] p-6 flex flex-col items-center justify-center min-h-[300px] text-center" style={{ background: 'linear-gradient(180deg,#ffffff,#f8f9fb)', boxShadow: '0 14px 34px -16px rgba(30,41,59,0.25), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(15,23,42,0.05)' }}>
        <span className="grid place-items-center w-14 h-14 rounded-2xl text-white mb-4" style={{ background: 'linear-gradient(180deg,#fbbf24,#d97706)', boxShadow: '0 6px 14px rgba(217,119,6,0.35), inset 0 1px 1px rgba(255,255,255,0.5)' }}><HardHat size={26} /></span>
        <h2 className="text-sm font-black text-slate-800 uppercase italic tracking-widest">En construcción</h2>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 max-w-[15rem]">
          El resumen del calendario para El Corte Inglés estará disponible próximamente
        </p>
      </div>
      )}

      {!newsOnly && !esECI && (
      <div className="rounded-[2rem] p-6 flex flex-col min-h-[300px]" style={{ background: 'linear-gradient(180deg,#ffffff,#f8f9fb)', boxShadow: '0 14px 34px -16px rgba(30,41,59,0.25), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(15,23,42,0.05)' }}>
        <h2 className="text-sm font-black text-slate-800 uppercase italic tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2.5 mb-6 shrink-0">
          <span className="grid place-items-center w-8 h-8 rounded-xl text-white shrink-0" style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 4px 10px rgba(5,150,105,0.4), inset 0 1px 1px rgba(255,255,255,0.5)' }}><PieChart size={16} /></span> Resumen Calendario
        </h2>
        {sinObjetivos && (
          <div data-tour="res-sin-objetivos" className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 mb-5 shrink-0">
            <p className="text-[9px] font-black text-amber-800 uppercase tracking-widest leading-none mb-1.5">Sin objetivos configurados</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight leading-tight">
              No conocemos el convenio de tu empresa. Puedes fijar tus objetivos a mano en Ajustes.
            </p>
          </div>
        )}
        {conProrrateo && (
          <div data-tour="res-prorrateo" className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 mb-5 shrink-0">
            <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest leading-none mb-1.5">
              Objetivos ajustados a tu alta
            </p>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight leading-tight">
              {prorrateo.proporcion === 0
                ? `Entraste el ${fechaLegible(prorrateo.desde)}, así que en ${prorrateo.anio} todavía no estabas en la empresa.`
                : `Entraste el ${fechaLegible(prorrateo.desde)}: te corresponden ${prorrateo.dias} de los ${prorrateo.diasAnio} días de ${prorrateo.anio} (${Math.round(prorrateo.proporcion * 100)}%). Los topes del convenio se reparten en esa misma proporción.`}
            </p>
          </div>
        )}
        <div className="flex-1 flex flex-col justify-between py-2 space-y-5">
          {/* data-tour: puntos que ilumina el tutorial (ver constants/screenTips) */}
          {objetivo('horas') > 0 ? (
            <StatBar dataTour={tour("res-horas")} label="Horas Anuales" hint={deAlAnio('horas', 'h')} currentValue={formatTotalTime(stats.horasTotales)} percentage={(stats.horasTotales/objetivo('horas'))*100} totalValue={`${objetivo('horas')}h`} color="bg-emerald-500" large={true} />
          ) : (
            <StatCounter dataTour={tour("res-horas")} label="Horas Anuales" hint={deAlAnio('horas', 'h')} value={formatTotalTime(stats.horasTotales)} large={true} />
          )}

          {objetivo('trabajados') > 0 ? (
            <StatBar dataTour={tour("res-trabajados")} label="Días Trabajados" hint={deAlAnio('trabajados')} currentValue={stats.diasTrabajados} percentage={(stats.diasTrabajados/objetivo('trabajados'))*100} totalValue={objetivo('trabajados')} color="bg-emerald-600" large={true} />
          ) : (
            <StatCounter dataTour={tour("res-trabajados")} label="Días Trabajados" hint={deAlAnio('trabajados')} value={stats.diasTrabajados} large={true} />
          )}

          {objetivo('libres') > 0 ? (
            <StatBar dataTour={tour("res-libres")} label="Días Libres" hint={deAlAnio('libres')} currentValue={stats.diasLibres} percentage={(stats.diasLibres/objetivo('libres'))*100} totalValue={objetivo('libres')} color="bg-emerald-400" large={true} />
          ) : (
            <StatCounter dataTour={tour("res-libres")} label="Días Libres" hint={deAlAnio('libres')} value={stats.diasLibres} large={true} />
          )}

          {objetivo('ha') > 0 && (
             <StatBar dataTour="res-ha" label="Días HA" hint={deAlAnio('ha')} currentValue={stats.contadorHA} percentage={(stats.contadorHA/objetivo('ha'))*100} totalValue={objetivo('ha')} color="bg-emerald-500" large={true} />
          )}

          {objetivo('calidad') > 0 && (
            <div data-tour="res-calidad">
              <StatBar label="Calidad" hint={deAlAnio('calidad')} currentValue={stats.findesCalidad} percentage={(stats.findesCalidad/objetivo('calidad'))*100} totalValue={objetivo('calidad')} color="bg-emerald-600" large={true} />
              <div className="flex gap-3 mt-1.5 ml-1">
                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">● Sáb-Dom: {stats.findesCalidadCorto}/{calidadCortoTarget}</span>
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">● {calidadLargoLabel}: {stats.findesCalidadLargo}/{calidadLargoTarget}</span>
              </div>
            </div>
          )}

          {objetivo('domingos') > 0 ? (
            <StatBar dataTour={tour("res-domingos")} label="DOMINGOS/FESTIVOS" hint={deAlAnio('domingos')} currentValue={stats.domingosCount} percentage={(stats.domingosCount/objetivo('domingos'))*100} totalValue={objetivo('domingos')} color="bg-emerald-500" large={true} />
          ) : (
            <StatCounter dataTour={tour("res-domingos")} label="DOMINGOS/FESTIVOS" hint={deAlAnio('domingos')} value={stats.domingosCount} large={true} />
          )}
        </div>
      </div>
      )}

      {/* Sección de Noticias — SIN panel oscuro: las noticias van directas sobre el fondo
          claro de la página (texto oscuro), solo con un separador fino entre ellas.
          En modo newsOnly siempre se muestra (aunque esté vacía). */}
      {(newsOnly || noticiasVisibles.length > 0 || (isAdmin)) && (
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-5 shrink-0 border-b border-slate-200 pb-3">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Newspaper size={14}/> Noticias
            </h3>
            {isAdmin && (
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
          <div className="space-y-5">
              {noticiasVisibles.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40">
                  <Newspaper size={40} className="text-slate-300 mb-3" />
                  <p className="text-[10px] text-slate-400 text-center italic uppercase font-bold tracking-widest">No hay noticias publicadas</p>
                </div>
              ) : (
                noticiasVisibles.map(news => (
                    // Noticia SIN recuadro: solo el contenido (imagen/título/texto), con un
                    // separador sutil entre noticias en lugar de un marco por tarjeta.
                    <div key={news.id} className="flex flex-col pb-5 border-b border-slate-200 last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              {news.isStoreNews ? (
                                // Noticia del DELEGADO de la tienda del usuario (colección
                                // noticiasTienda): etiqueta propia + nombre del delegado.
                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter bg-indigo-500/10 px-2 py-0.5 rounded-md">Tu Delegado</span>
                              ) : (
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter bg-emerald-500/10 px-2 py-0.5 rounded-md">{news.tag}</span>
                              )}
                              <span className="text-[8px] text-slate-400 font-bold">
                                {news.date}{news.isStoreNews && news.authorName ? ` · ${news.authorName}` : ''}
                              </span>
                            </div>
                            {/* El borrado desde aquí es SOLO para las noticias globales del
                                admin; las de delegado se borran desde su pestaña Noticias. */}
                            {isAdmin && !news.isStoreNews && (
                              <button onClick={() => handleDeleteNews(news.id)} className="text-rose-500 p-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors">
                                <Trash2 size={14} />
                              </button>
                            )}
                        </div>
                        {news.imageUrl && (
                          <img
                            src={news.imageUrl}
                            alt="Noticia"
                            onClick={() => onImageClick?.(news.imageUrl, news.title)}
                            className="w-full h-auto rounded-2xl mb-4 shadow-md animate-in fade-in cursor-zoom-in active:scale-[0.99] transition-transform"
                          />
                        )}

                        <h4 className="text-sm font-black text-slate-800 uppercase leading-tight mb-2 tracking-tight">{news.title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">{news.desc}</p>
                        {enlaceSeguro(news.linkUrl) && (
                          <a href={enlaceSeguro(news.linkUrl)} target="_blank" rel="noopener noreferrer" className="mt-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors text-emerald-700 py-3 px-3 rounded-xl text-[10px] font-bold uppercase text-center flex items-center justify-center gap-2">
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
