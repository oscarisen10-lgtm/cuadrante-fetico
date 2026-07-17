import React, { useState, useEffect, useMemo } from 'react';
import { Newspaper, Plus, Trash2, X, Upload, Bell, Store as StoreIcon, Send } from 'lucide-react';
import { addStoreNews, deleteStoreNews, subscribeToMyStoreNews } from '../services/firebaseService';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageUtils';
import { toast, confirm } from './Toast';
import { LoadingLogo } from './UIComponents';

/**
 * DelegadoNoticiasView — Pestaña "Noticias" del delegado (sustituye a la
 * antigua "Usuarios": la gestión de usuarios vive ahora en el Censo).
 *
 * El delegado publica noticias SOLO para sus tiendas autorizadas (colección
 * noticiasTienda; las reglas impiden dirigirse a tiendas ajenas o a toda la
 * app — el canal global es exclusivo del admin).
 *
 * Noticias y PUSH van SEPARADOS, igual que en el panel del admin: la noticia
 * se publica en el feed sin avisar a nadie, y el botón "Push" lanza una
 * notificación (doc con isPushRequest:true, oculto del feed) que el backend
 * envía por token directo solo a los usuarios de sus tiendas (sendStoreNews).
 */
export const DelegadoNoticiasView = React.memo(function DelegadoNoticiasView({ user, delegado }) {
  const stores = useMemo(
    () => [...(Array.isArray(delegado?.stores) ? delegado.stores : [])].sort((a, b) => a.localeCompare(b, 'es')),
    [delegado]
  );

  const [myNews, setMyNews] = useState(null); // null = cargando
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [targetStores, setTargetStores] = useState(stores); // por defecto, todas las suyas
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [publishing, setPublishing] = useState(false);

  // Modal de PUSH (separado de las noticias, como en el panel del admin).
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushStores, setPushStores] = useState(stores);
  const [pushSending, setPushSending] = useState(false);

  useEffect(() => { setTargetStores(stores); setPushStores(stores); }, [stores]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToMyStoreNews(user.uid, setMyNews);
    return () => unsub();
  }, [user?.uid]);

  const toggleStore = (s) => {
    setTargetStores((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 12) {
      toast("La foto es demasiado grande (máx 12MB).", "warning");
      e.target.value = null;
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const resetComposer = () => {
    setTitle(''); setDesc(''); setTargetStores(stores);
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setShowComposer(false);
  };

  const togglePushStore = (s) => {
    setPushStores((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  // Push separado: crea un doc con isPushRequest:true (OCULTO del feed, igual
  // que hace el admin) y sendPush:true para que el backend lo envíe SOLO a los
  // usuarios de las tiendas elegidas.
  const sendPushNotification = async (e) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushBody.trim()) { toast("Título y mensaje son obligatorios.", "warning"); return; }
    if (pushStores.length === 0) { toast("Elige al menos una tienda destino.", "warning"); return; }
    setPushSending(true);
    try {
      await addStoreNews({
        title: pushTitle.trim(),
        desc: pushBody.trim(),
        stores: pushStores,
        authorUid: user.uid,
        authorName: user.fullName || 'Delegado/a',
        isPushRequest: true,
        sendPush: true,
        date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        createdAt: Date.now(),
      });
      toast("¡Push enviado! Llegará a tus tiendas en unos segundos.", "success");
      setPushTitle(''); setPushBody(''); setPushStores(stores);
      setShowPushModal(false);
    } catch (error) {
      console.error("Error enviando push de tienda:", error);
      toast("No se pudo enviar: " + (error?.message || error), "error");
    }
    setPushSending(false);
  };

  const publish = async (e) => {
    e.preventDefault();
    if (!title.trim() || !desc.trim()) { toast("Título y texto son obligatorios.", "warning"); return; }
    if (targetStores.length === 0) { toast("Elige al menos una tienda destino.", "warning"); return; }

    setPublishing(true);
    try {
      let imageUrl = null;
      if (selectedFile) {
        // Compresión en el dispositivo (igual que las noticias del admin).
        const { blob, type, ext } = await compressImage(selectedFile);
        const storageRef = ref(storage, `noticias-delegado/${Date.now()}_cartel.${ext}`);
        await uploadBytes(storageRef, blob, { contentType: type });
        imageUrl = await getDownloadURL(storageRef);
      }

      await addStoreNews({
        title: title.trim(),
        desc: desc.trim(),
        imageUrl,
        stores: targetStores,
        authorUid: user.uid,
        authorName: user.fullName || 'Delegado/a',
        date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        createdAt: Date.now(),
      });
      toast("¡Noticia publicada!", "success");
      resetComposer();
    } catch (error) {
      console.error("Error publicando noticia de tienda:", error);
      toast("No se pudo publicar: " + (error?.message || error), "error");
    }
    setPublishing(false);
  };

  const handleDelete = async (n) => {
    const ok = await confirm("¿Borrar esta noticia? Desaparecerá del Resumen de tus usuarios.");
    if (!ok) return;
    try {
      await deleteStoreNews(n.id);
      toast("Noticia eliminada.", "success");
    } catch (e) {
      toast("Error: " + (e?.message || e), "error");
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300 pb-20">
      {/* Cabecera */}
      <div className="rounded-[2rem] p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#10b981,#059669 55%,#047857)', boxShadow: '0 14px 30px -12px rgba(5,120,87,0.5), inset 0 1.5px 1px rgba(255,255,255,0.3)' }}>
        <div className="pointer-events-none absolute -top-8 -right-4 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%)' }} />
        <h2 className="relative text-sm font-black uppercase italic tracking-widest flex items-center gap-2.5">
          <span className="grid place-items-center w-8 h-8 rounded-xl bg-white/20 shrink-0"><Newspaper size={16} /></span>
          Noticias
        </h2>
        <p className="relative text-[10px] text-emerald-50/90 font-bold uppercase tracking-tight mt-2 leading-relaxed">
          Publica noticias y push SOLO para tus afiliados.
          {stores.length > 0 && <> Tiendas: {stores.length}.</>}
        </p>
      </div>

      {stores.length === 0 ? (
        <div className="py-14 flex flex-col items-center opacity-50 text-center px-6">
          <Newspaper size={40} className="text-slate-300 mb-3" />
          <p className="text-[10px] text-slate-400 italic uppercase font-bold tracking-widest leading-relaxed">
            Aún no tienes tiendas autorizadas.<br />El administrador debe asignártelas.
          </p>
        </div>
      ) : (
        <>
          {/* Botones: Nueva noticia + Push, SEPARADOS (como en el panel del admin) */}
          {!showComposer ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowComposer(true)}
                className="btn3d flex-[2] text-white font-black py-4 rounded-2xl uppercase text-xs flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 8px 18px rgba(5,150,105,0.4), inset 0 1.5px 1px rgba(255,255,255,0.45)' }}
              >
                <Plus size={16} /> Nueva Noticia
              </button>
              <button
                onClick={() => setShowPushModal(true)}
                className="btn3d flex-1 text-white font-black py-4 rounded-2xl uppercase text-xs flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(180deg,#818cf8,#4f46e5)', boxShadow: '0 8px 18px rgba(79,70,229,0.4), inset 0 1.5px 1px rgba(255,255,255,0.4)' }}
              >
                <Bell size={15} /> Push
              </button>
            </div>
          ) : (
            <form onSubmit={publish} className="rounded-[2rem] p-5 space-y-4" style={{ background: 'linear-gradient(180deg,#ffffff,#f8f9fb)', boxShadow: '0 14px 34px -16px rgba(30,41,59,0.25), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(15,23,42,0.05)' }}>
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-emerald-700 uppercase italic tracking-widest">Nueva Noticia</h3>
                <button type="button" onClick={resetComposer} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400"><X size={18}/></button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-emerald-600 uppercase ml-1 tracking-tight">Titular</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                  className="w-full bg-slate-50 border-none p-3 text-sm rounded-xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm text-slate-800"
                  placeholder="Ej: Asamblea el viernes"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-emerald-600 uppercase ml-1 tracking-tight">Cuerpo del texto</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  required
                  rows={4}
                  maxLength={5000}
                  className="w-full bg-slate-50 border-none p-3 text-sm rounded-xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm text-slate-800 leading-relaxed"
                  placeholder="Escribe aquí el comunicado para tus afiliados..."
                />
              </div>

              {/* Tiendas destino */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-emerald-600 uppercase ml-1 tracking-tight flex items-center gap-1"><StoreIcon size={11}/> Tiendas destino</label>
                <div className="flex gap-2 flex-wrap">
                  {stores.map((s) => {
                    const on = targetStores.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleStore(s)}
                        aria-pressed={on}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all active:scale-95 ${on ? 'text-white' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}
                        style={on ? { background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 4px 10px rgba(5,150,105,0.35), inset 0 1px 1px rgba(255,255,255,0.5)' } : {}}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest ml-1">Solo la verán los usuarios de las tiendas marcadas</p>
              </div>

              {/* Foto opcional */}
              <label className="w-full bg-slate-100 border border-slate-200 text-slate-600 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 active:scale-95 transition-all text-xs font-bold shadow-inner">
                <Upload size={15}/> {selectedFile ? "Cambiar foto" : "Foto (opcional)"}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
              </label>

              {previewUrl && (
                <div className="relative border-2 border-emerald-100 rounded-2xl p-1 bg-emerald-50 animate-in fade-in">
                  <img src={previewUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl" />
                  <button type="button" onClick={() => { setSelectedFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:bg-rose-600"><X size={14}/></button>
                </div>
              )}

              <button
                type="submit"
                disabled={publishing || targetStores.length === 0}
                className={`w-full bg-emerald-600 text-white font-black py-3.5 rounded-2xl uppercase text-xs active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2 ${publishing || targetStores.length === 0 ? 'opacity-60' : ''}`}
              >
                {publishing ? 'PUBLICANDO...' : <><Send size={15}/> PUBLICAR NOTICIA</>}
              </button>
            </form>
          )}

          {/* Mis noticias publicadas */}
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Newspaper size={14}/> Tus publicaciones
            </h3>
          </div>

          {myNews === null ? (
            <div className="py-8"><LoadingLogo label="Cargando…" /></div>
          ) : myNews.filter((n) => !n.isPushRequest).length === 0 ? (
            <div className="py-10 flex flex-col items-center opacity-40">
              <Newspaper size={36} className="text-slate-300 mb-3" />
              <p className="text-[10px] text-slate-400 text-center italic uppercase font-bold tracking-widest">Aún no has publicado nada</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Los envíos de push (isPushRequest) no se listan: son avisos
                  puntuales, no publicaciones — mismo criterio que el admin. */}
              {myNews.filter((n) => !n.isPushRequest).map((n) => (
                <div key={n.id} className="flex flex-col pb-5 border-b border-slate-200 last:border-b-0 last:pb-0">
                  <div className="flex justify-between items-center mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {(n.stores || []).map((s) => (
                        <span key={s} className="text-[8px] font-black text-emerald-700 uppercase tracking-tighter bg-emerald-500/10 px-2 py-0.5 rounded-md">{s}</span>
                      ))}
                      <span className="text-[8px] text-slate-400 font-bold">{n.date}</span>
                    </div>
                    <button onClick={() => handleDelete(n)} className="text-rose-500 p-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors shrink-0" aria-label="Borrar noticia">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {n.imageUrl && (
                    <img src={n.imageUrl} alt="Noticia" className="w-full h-auto rounded-2xl mb-3 shadow-md" />
                  )}
                  <h4 className="text-sm font-black text-slate-800 uppercase leading-tight mb-1.5 tracking-tight">{n.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">{n.desc}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* MODAL DE PUSH — separado de las noticias, como en el panel del admin,
          pero dirigido SOLO a las tiendas del delegado. */}
      {showPushModal && (
        <div className="fixed inset-0 z-[120] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-7 shadow-2xl w-full max-w-sm border border-indigo-50 animate-in zoom-in-95 flex flex-col">
            <div className="flex justify-between items-center mb-5 shrink-0">
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-indigo-700 uppercase italic tracking-widest">Lanzar Alerta Push</h3>
                <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Solo a los dispositivos de tus tiendas</span>
              </div>
              <button onClick={() => setShowPushModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400"><X size={20}/></button>
            </div>

            <form onSubmit={sendPushNotification} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1 tracking-tight">Título de la Alerta</label>
                <input
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  maxLength={200}
                  required
                  className="w-full bg-slate-50 border-none p-3 text-sm rounded-xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm text-slate-800"
                  placeholder="Ej: Asamblea mañana"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1 tracking-tight">Mensaje a mostrar</label>
                <textarea
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  required
                  rows={3}
                  className="w-full bg-slate-50 border-none p-3 text-sm rounded-xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm text-slate-800"
                  placeholder="Escribe aquí el contenido de la notificación..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1 tracking-tight flex items-center gap-1"><StoreIcon size={11}/> Tiendas destino</label>
                <div className="flex gap-2 flex-wrap">
                  {stores.map((s) => {
                    const on = pushStores.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => togglePushStore(s)}
                        aria-pressed={on}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all active:scale-95 ${on ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={pushSending || pushStores.length === 0}
                className={`w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase text-xs active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2 mt-2 ${pushSending || pushStores.length === 0 ? 'opacity-60' : ''}`}
              >
                {pushSending ? 'ENVIANDO A DISPOSITIVOS...' : <><Bell size={15}/> LANZAR NOTIFICACIÓN</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
