import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, db } from './firebase'; 
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, setDoc, onSnapshot, collection, addDoc, deleteDoc } from "firebase/firestore";
import { 
  Clock, Calendar as CalendarIcon, PieChart, MessageCircle, Play, Square, 
  Coffee, User, Lock, ChevronLeft, ChevronRight, LogOut, Store, Newspaper, 
  Timer, X, Mail, Award, KeyRound, ShieldCheck, Settings, Building2, Plus, 
  Link, Trash2, FileText, Edit3, ChevronDown, ChevronUp, ImageIcon, Upload
} from 'lucide-react';

const CONFIG = {
  MAX_DIAS_HA: 15,
  LIMITE_ANUAL_HORAS: 1770,
  MAX_FINES_CALIDAD: 10,
  UMBRAL_DIA_HA_MINUTOS: 510,
  MAX_DOMINGOS: 22,
};

// 👇 EMAIL DE ADMINISTRADOR 👇
const ADMIN_EMAIL = "oscargarcia@fetico.es"; 

const getFormattedDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Estados App
  const [settings, setSettings] = useState({ notifications: true, breakDuration: 15 });
  const [shifts, setShifts] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [workTimeAccumulated, setWorkTimeAccumulated] = useState(0);
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState(null);
  const [newsList, setNewsList] = useState([]);
  const [licenciasList, setLicenciasList] = useState([]);

  // Estados UI
  const [isRegistering, setIsRegistering] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [activeTab, setActiveTab] = useState('dashboard');
  const [elapsed, setElapsed] = useState(0); 
  const [breakTimeLeft, setBreakTimeLeft] = useState(settings.breakDuration * 60); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [showBreakFinishedMsg, setShowBreakFinishedMsg] = useState(false);
  
  const [selectedDates, setSelectedDates] = useState([]); 
  const [editingDay, setEditingDay] = useState(null); 
  const [editHH, setEditHH] = useState("0");
  const [editmm, setEditmm] = useState("0");
  const [expandedLicencia, setExpandedLicencia] = useState(null);

  // ESTADOS FORMULARIO NOTICIAS
  const [showAddNewsModal, setShowAddNewsModal] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTag, setFormTag] = useState("Fetico");
  const [formBase64Image, setFormBase64Image] = useState(null); 

  // REPRODUCTOR DE ALARMA
  const alarmRef = useRef(typeof Audio !== 'undefined' ? new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg') : null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser({ ...data.profile, uid: firebaseUser.uid });
            setSettings(data.settings || { notifications: true, breakDuration: 15 });
            setShifts(data.shifts || []);
            setActiveShift(data.activeShift || null);
            setWorkTimeAccumulated(data.workTimeAccumulated || 0);
            setIsBreakActive(data.isBreakActive || false);
            setBreakStartTime(data.breakStartTime || null);
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const unsubNews = onSnapshot(collection(db, "noticias"), (snapshot) => {
      const arr = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      arr.sort((a, b) => b.createdAt - a.createdAt);
      setNewsList(arr);
    });

    const unsubLicencias = onSnapshot(collection(db, "licencias"), (snapshot) => {
      const arr = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      arr.sort((a, b) => a.order - b.order); 
      setLicenciasList(arr);
    });

    return () => { unsubNews(); unsubLicencias(); };
  }, [user]);

  // EFECTO SALTO AUTOMÁTICO A NUEVAS NOTICIAS
  useEffect(() => {
    if (newsList.length > 0) {
      const latestNews = newsList[0];
      const lastSeenTime = localStorage.getItem('lastSeenNewsTime');
      
      if (!lastSeenTime || latestNews.createdAt > parseInt(lastSeenTime)) {
        setActiveTab('dashboard'); 
        localStorage.setItem('lastSeenNewsTime', latestNews.createdAt.toString()); 
      }
    }
  }, [newsList]);

  const saveToCloud = async (updates) => {
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, "users", auth.currentUser.uid), updates, { merge: true });
      } catch (error) {
        console.error("Error guardando:", error);
      }
    }
  };

  useEffect(() => {
    let interval;
    if (activeShift && !isBreakActive) {
      interval = setInterval(() => {
        const currentSessionSeconds = Math.floor((Date.now() - activeShift.startTime) / 1000);
        setElapsed(workTimeAccumulated + currentSessionSeconds);
      }, 1000);
    } else if (activeShift && isBreakActive) {
      setElapsed(workTimeAccumulated);
      interval = setInterval(() => {
        const secondsInBreak = Math.floor((Date.now() - breakStartTime) / 1000);
        const totalBreakSeconds = settings.breakDuration * 60;
        const remaining = Math.max(0, totalBreakSeconds - secondsInBreak);
        setBreakTimeLeft(remaining);
        
        if (remaining === 0 && !showBreakFinishedMsg) {
          setShowBreakFinishedMsg(true);
          if (alarmRef.current && settings.notifications) {
            alarmRef.current.loop = true; 
            alarmRef.current.play().catch(e => console.log("Sonido bloqueado", e));
          }
        }
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeShift, isBreakActive, workTimeAccumulated, breakStartTime, showBreakFinishedMsg, settings]);

  const shiftsMap = useMemo(() => {
    const map = {};
    shifts.forEach(s => { map[s.date] = s; });
    return map;
  }, [shifts]);

  const stats = useMemo(() => {
    let horasTotalesDecimal = 0;
    let contadorHA = 0;
    let vacacionesCount = 0;
    let findesCalidad = 0;
    let domingosCount = 0;

    shifts.forEach(s => {
      if (s.type === 'work') {
        horasTotalesDecimal += s.hours;
        if (s.isHA) contadorHA += 1;
        const [y, m, d] = s.date.split('-');
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        if (dayOfWeek === 0) domingosCount += 1;
      }
      if (s.type === 'vacation') vacacionesCount += 1;
    });

    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date();
    let current = new Date(start);
    while (current <= end) {
      if (current.getDay() === 6) { 
        const satStr = getFormattedDate(current);
        const sunDate = new Date(current);
        sunDate.setDate(current.getDate() + 1);
        const sunStr = getFormattedDate(sunDate);
        const satS = shiftsMap[satStr];
        const sunS = shiftsMap[sunStr];
        if (satS?.type === 'rest' && sunS?.type === 'rest') findesCalidad++;
      }
      current.setDate(current.getDate() + 1);
    }
    return { horasTotales: horasTotalesDecimal, contadorHA, findesCalidad, vacacionesCount, domingosCount };
  }, [shifts, shiftsMap]);

  const handleAuth = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const emailInput = formData.get('email')?.trim().toLowerCase();
    const pass = formData.get('password');

    if (pass.length < 6) {
      setRecoveryError("La contraseña debe tener mínimo 6 caracteres.");
      setTimeout(() => setRecoveryError(""), 3000);
      return;
    }

    setIsLoading(true);
    try {
      if (!isRegistering) {
        await signInWithEmailAndPassword(auth, emailInput, pass);
      } else {
        const confirmPass = formData.get('confirmPassword');
        if (pass !== confirmPass) {
           setRecoveryError("Las contraseñas no coinciden.");
           setIsLoading(false);
           setTimeout(() => setRecoveryError(""), 3000);
           return;
        }

        const res = await createUserWithEmailAndPassword(auth, emailInput, pass);
        const newUserProfile = {
          email: emailInput,
          fullName: formData.get('fullName') || 'Compañero/a',
          company: formData.get('company') || "Supercor",
          store: formData.get('store') || "Centro sin definir",
          rank: formData.get('rank') || "Personal base"
        };
        
        await setDoc(doc(db, "users", res.user.uid), {
          profile: newUserProfile,
          settings: { notifications: true, breakDuration: 15 },
          shifts: [],
          activeShift: null,
          workTimeAccumulated: 0,
          isBreakActive: false,
          breakStartTime: null
        });
      }
    } catch (error) {
      setRecoveryError("Credenciales incorrectas o cuenta no existe.");
      setTimeout(() => setRecoveryError(""), 3000);
    }
    setIsLoading(false);
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const emailInput = formData.get('email')?.trim().toLowerCase();
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, emailInput);
      setRecoveryError("¡Éxito! Revisa tu email para crear una nueva contraseña.");
      setTimeout(() => { setShowForgotModal(false); setRecoveryError(""); }, 3000);
    } catch (error) {
      setRecoveryError("Cuenta no encontrada en la Nube.");
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    signOut(auth);
    setShowConfirmLogout(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024 * 2) { 
        alert("La foto es demasiado grande (máx 2MB). Por favor, usa una foto más pequeña.");
        e.target.value = null; 
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => { setFormBase64Image(reader.result); };
      reader.onerror = () => { alert("Error leyendo la foto."); }
      reader.readAsDataURL(file); 
    }
  };

  const handleSubmitNewsForm = async (e) => {
    e.preventDefault();
    if (!formTitle || !formDesc) { alert("Título y Texto son obligatorios."); return; }
    
    setIsLoading(true);
    try {
      await addDoc(collection(db, "noticias"), {
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
      alert("Hubo un error al guardar la noticia en la nube.");
    }
    setIsLoading(false);
  };

  const handleDeleteNews = async (id) => {
    if (window.confirm("¿Seguro que quieres borrar esta noticia?")) {
      try { await deleteDoc(doc(db, "noticias", id)); } 
      catch (error) { alert("Error: " + error.message); }
    }
  };

  // 🔥 FUNCIONES DE LICENCIAS (ADMIN SUPERPODERES) 🔥
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
         await addDoc(collection(db, "licencias"), item);
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
      await addDoc(collection(db, "licencias"), {
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
        await setDoc(doc(db, "licencias", lic.id), { title: newTitle }, { merge: true });
      } catch (error) {
        alert("Error actualizando título: " + error.message);
      }
    }
  };

  const handleEditLicencia = async (lic) => {
    const newDesc = prompt(`Explicación para:\n${lic.title}`, lic.desc);
    if (newDesc !== null && newDesc.trim() !== "") {
      try {
        await setDoc(doc(db, "licencias", lic.id), { desc: newDesc }, { merge: true });
      } catch (error) {
        alert("Error actualizando texto: " + error.message);
      }
    }
  };

  const handleDeleteLicencia = async (id) => {
    if (window.confirm("¿Seguro que quieres borrar esta licencia definitivamente?")) {
      try { await deleteDoc(doc(db, "licencias", id)); } 
      catch (error) { alert("Error borrando licencia: " + error.message); }
    }
  };

  // FIN FUNCIONES LICENCIAS

  const stopAlarm = () => {
    if (alarmRef.current) {
      alarmRef.current.pause();
      alarmRef.current.currentTime = 0;
    }
  };

  const toggleDescanso = () => {
    const isNowActive = !isBreakActive;
    const newWorkTime = isNowActive ? workTimeAccumulated + Math.floor((Date.now() - activeShift.startTime) / 1000) : workTimeAccumulated;
    const newBreakStart = isNowActive ? Date.now() : null;
    const newActiveShift = isNowActive ? activeShift : { startTime: Date.now() };

    setWorkTimeAccumulated(newWorkTime);
    setBreakStartTime(newBreakStart);
    setIsBreakActive(isNowActive);
    setActiveShift(newActiveShift);
    
    if(isNowActive) {
      setBreakTimeLeft(settings.breakDuration * 60);
    } else {
      setShowBreakFinishedMsg(false);
      stopAlarm(); 
    }

    saveToCloud({ workTimeAccumulated: newWorkTime, breakStartTime: newBreakStart, isBreakActive: isNowActive, activeShift: newActiveShift });
  };

  const cerrarTurno = (esHA) => {
    const hoyStr = getFormattedDate(new Date());
    const filtered = shifts.filter(s => s.date !== hoyStr);
    const newShifts = [...filtered, { id: Date.now(), date: hoyStr, type: 'work', hours: elapsed / 3600, isHA: esHA }];
    
    setShifts(newShifts);
    setActiveShift(null);
    setWorkTimeAccumulated(0);
    setIsBreakActive(false);
    setShowBreakFinishedMsg(false);
    stopAlarm(); 

    saveToCloud({ shifts: newShifts, activeShift: null, workTimeAccumulated: 0, isBreakActive: false, breakStartTime: null });
  };

  const openEditHours = (dateStr) => {
    const s = shiftsMap[dateStr];
    const totalHoursDecimal = (s?.type === 'work' && s.hours > 0) ? s.hours : 6.75;
    setEditingDay(dateStr);
    setEditHH(Math.floor(totalHoursDecimal).toString());
    setEditmm(Math.round((totalHoursDecimal % 1) * 60).toString());
    setSelectedDates([]); 
  };

  const saveEditedHours = () => {
    const hoursDecimal = (parseInt(editHH) || 0) + ((parseInt(editmm) || 0) / 60);
    const filtered = shifts.filter(s => s.date !== editingDay);
    const newShifts = [...filtered, { id: Date.now(), date: editingDay, type: 'work', hours: hoursDecimal, isHA: (hoursDecimal * 60) >= CONFIG.UMBRAL_DIA_HA_MINUTOS }];
    
    setShifts(newShifts);
    setEditingDay(null);
    saveToCloud({ shifts: newShifts });
  };

  const markMulti = (type) => {
    const filtered = shifts.filter(s => !selectedDates.includes(s.date));
    const newEntries = selectedDates.map(date => ({ id: Math.random(), date, type, hours: 0, isHA: false }));
    const newShifts = [...filtered, ...newEntries];
    setShifts(newShifts);
    setSelectedDates([]);
    saveToCloud({ shifts: newShifts });
  };

  const deleteSelectedDates = () => {
    const newShifts = shifts.filter(s => !selectedDates.includes(s.date));
    setShifts(newShifts);
    setSelectedDates([]);
    saveToCloud({ shifts: newShifts });
  };

  const formatTotalTime = (decimalHours) => {
    const totalMinutes = Math.round(decimalHours * 60);
    return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleMinutesChange = (val) => {
    let m = parseInt(val) || 0;
    let h = parseInt(editHH) || 0;
    if (m >= 60) {
      setEditHH((h + Math.floor(m / 60)).toString());
      setEditmm((m % 60).toString().padStart(2, '0'));
    } else { setEditmm(val); }
  };

  const handleDayClick = (dateStr) => {
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
    } else {
      setSelectedDates([...selectedDates, dateStr]);
    }
    setEditingDay(null);
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-emerald-600 font-bold italic text-sm">Sincronizando Google...</div>;

  if (!user) {
    return (
      <div className="h-[100dvh] bg-emerald-50 flex flex-col items-center justify-center p-4 font-sans overflow-hidden text-slate-800">
        <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-xl border border-emerald-100 flex flex-col max-h-[95vh] overflow-hidden">
          <div className="bg-emerald-600 p-4 text-center text-white shrink-0 relative z-10">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mx-auto mb-1 shadow-inner shrink-0">
              <span className="text-emerald-600 font-black text-xl italic leading-none">F</span>
            </div>
            <h1 className="text-base font-black italic uppercase tracking-tight leading-none">Mi Cuadrante Nube</h1>
            <p className="text-emerald-100 text-[8px] uppercase font-bold tracking-widest mt-1">Fetico • ANGED</p>
          </div>

          <form onSubmit={handleAuth} className="p-4 flex flex-col overflow-hidden relative z-0">
            <div className="space-y-3 overflow-y-auto pr-1 scrollbar-hide flex-1 pb-2">
              {isRegistering ? (
                <>
                  <InputGroup label="Nombre Apellidos" name="fullName" small icon={<User size={14}/>} />
                  <InputGroup label="Email" name="email" type="email" small icon={<Mail size={14}/>} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-tight">Empresa</label>
                      <select name="company" className="w-full bg-slate-50 border-none p-1.5 rounded-lg text-sm outline-none ring-1 ring-slate-200">
                        <option>Supercor</option>
                        <option>S. Romero</option>
                        <option>S. Express</option>
                      </select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-tight">Rango</label>
                      <select name="rank" className="w-full bg-slate-50 border-none p-1.5 rounded-lg text-sm outline-none ring-1 ring-slate-200">
                        <option>Base</option>
                        <option>Prof.</option>
                        <option>Coord.</option>
                      </select>
                    </div>
                  </div>
                  <InputGroup label="Centro / Tienda" name="store" small icon={<Store size={14}/>} />
                  <InputGroup label="Contraseña (mín. 6)" name="password" type="password" minLength={6} small icon={<Lock size={14}/>} />
                  <InputGroup label="Repetir Contraseña" name="confirmPassword" type="password" minLength={6} small icon={<ShieldCheck size={14}/>} />
                </>
              ) : (
                <div className="space-y-4 py-2 flex flex-col">
                  <InputGroup label="Correo Electrónico" name="email" type="email" icon={<Mail size={14}/>} />
                  <InputGroup label="Contraseña" name="password" type="password" minLength={6} icon={<Lock size={14}/>} />
                  <button type="button" onClick={() => setShowForgotModal(true)} className="text-center text-xs font-black text-slate-400 uppercase tracking-tighter hover:text-emerald-600 transition-colors mt-3">
                    ¿Olvidaste tu contraseña?
                  </button>
                  {recoveryError && <div className="text-xs text-rose-500 font-bold text-center animate-pulse bg-rose-50 p-3 rounded-lg mt-3">{recoveryError}</div>}
                </div>
              )}
            </div>
            <div className="mt-4 space-y-2 shrink-0">
              <button type="submit" disabled={isLoading} className={`w-full bg-emerald-600 text-white font-black py-2.5 rounded-xl uppercase text-sm active:scale-95 transition-all shadow-md ${isLoading ? 'opacity-70' : ''}`}>
                {isLoading ? 'CONECTANDO...' : (isRegistering ? 'CREAR CUENTA' : 'ENTRAR')}
              </button>
              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setRecoveryError(""); }} className="w-full text-center text-xs font-black text-emerald-700 uppercase tracking-widest leading-none mt-2">
                {isRegistering ? 'Volver atrás' : '¿Eres nuevo? Regístrate'}
              </button>
            </div>
          </form>
        </div>

        {showForgotModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-5 shadow-2xl w-full max-w-sm border border-emerald-50 relative animate-in zoom-in-95">
                <button onClick={() => { setShowForgotModal(false); setRecoveryError(""); }} className="absolute top-4 right-4 text-slate-300"><X size={20} /></button>
                <div className="text-emerald-600 flex justify-center mb-1"><KeyRound size={28}/></div>
                <h3 className="text-base font-black text-center text-slate-800 mb-1 italic uppercase leading-none">Recuperar Acceso</h3>
                <p className="text-center text-slate-500 text-[10px] mb-4 uppercase font-bold tracking-tight">Recibirás un email seguro para cambiar contraseña</p>
                <form onSubmit={handleRecovery} className="space-y-4">
                    <InputGroup label="Email Registrado" name="email" type="email" icon={<Mail size={14}/>} />
                    {recoveryError && <div className={`p-1.5 rounded text-center text-[9px] font-black uppercase ${recoveryError.includes('Éxito') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{recoveryError}</div>}
                    <button type="submit" disabled={isLoading} className={`w-full bg-emerald-600 text-white font-black py-3 rounded-xl uppercase text-xs mt-2 shadow-md ${isLoading ? 'opacity-70' : ''}`}>
                      {isLoading ? 'ENVIANDO...' : 'ENVIAR EMAIL DE RECUPERACIÓN'}
                    </button>
                </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex justify-center font-sans overflow-hidden text-slate-800 relative">
      <div className="w-full max-w-md bg-white h-full flex flex-col relative overflow-hidden">
        
        <header className="bg-emerald-600 text-white p-3 rounded-b-[1.5rem] shadow-lg shrink-0 z-10 relative">
          <div className="flex justify-between items-center px-1">
            <div>
              <h1 className="font-black text-base italic leading-tight">Hola, {user.fullName?.split(' ')[0]}</h1>
              <span className="text-[7px] uppercase font-bold opacity-80 tracking-widest leading-none">Datos sincronizados ☁️</span>
            </div>
            <button onClick={() => setShowConfirmLogout(true)} className="bg-white/10 p-2 rounded-lg hover:bg-white/20"><LogOut size={16} /></button>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-y-auto scrollbar-hide flex flex-col min-h-0 relative z-0">
          {activeTab === 'dashboard' && (
            <div className="flex flex-col animate-in fade-in duration-300 gap-5 pb-20">
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col min-h-[300px]">
                <h2 className="text-sm font-black text-slate-800 uppercase italic tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2 mb-6 shrink-0">
                  <PieChart size={18} className="text-emerald-600" /> Resumen Calendario
                </h2>
                <div className="flex-1 flex flex-col justify-between py-2 space-y-7">
                  <StatBar label="Horas Anuales" currentValue={formatTotalTime(stats.horasTotales)} percentage={(stats.horasTotales/CONFIG.LIMITE_ANUAL_HORAS)*100} totalValue="1770h" color="bg-pink-300" large={true} />
                  <StatBar label="Días HA" currentValue={stats.contadorHA} percentage={(stats.contadorHA/CONFIG.MAX_DIAS_HA)*100} totalValue={CONFIG.MAX_DIAS_HA} color="bg-blue-500" large={true} />
                  <StatBar label="Calidad" currentValue={stats.findesCalidad} percentage={(stats.findesCalidad/CONFIG.MAX_FINES_CALIDAD)*100} totalValue={CONFIG.MAX_FINES_CALIDAD} color="bg-emerald-500" large={true} />
                  <StatBar label="Domingos" currentValue={stats.domingosCount} percentage={(stats.domingosCount/CONFIG.MAX_DOMINGOS)*100} totalValue={CONFIG.MAX_DOMINGOS} color="bg-orange-400" large={true} />
                </div>
              </div>

              <div className="bg-slate-900 rounded-[2rem] p-6 flex flex-col min-h-[350px]">
                <div className="flex justify-between items-center mb-6 shrink-0 border-b border-white/5 pb-3">
                  <h3 className="text-xs font-black text-white/50 uppercase tracking-widest flex items-center gap-2">
                      <Newspaper size={14}/> Noticias Fetico
                  </h3>
                  {user.email === ADMIN_EMAIL.toLowerCase() && (
                    <button onClick={() => setShowAddNewsModal(true)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl hover:bg-emerald-500 active:scale-95 transition-all shadow-md flex items-center gap-1 font-black text-[10px] uppercase">
                       <Plus size={14}/> Nueva
                    </button>
                  )}
                </div>
                <div className="space-y-4 overflow-y-auto pr-1 scrollbar-hide">
                    {newsList.length === 0 ? (
                       <p className="text-[10px] text-white/40 text-center italic py-6 uppercase font-bold">No hay noticias publicadas.</p>
                    ) : (
                      newsList.map(news => (
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
            </div>
          )}

          {activeTab === 'track' && (
            <div className="flex flex-col items-center justify-center space-y-10 py-6 animate-in fade-in duration-300 pb-24 h-full">
              <div className="text-center">
                <div className={`text-6xl font-black tracking-tighter font-mono ${isBreakActive ? 'text-slate-300' : 'text-slate-800'}`}>{formatTime(elapsed || 0)}</div>
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-3">
                   {activeShift ? (isBreakActive ? 'Descanso activo' : 'Jornada en curso') : 'Reloj parado'}
                </div>
              </div>

              <button 
                onClick={() => {
                  if (activeShift) cerrarTurno((elapsed/60)>=CONFIG.UMBRAL_DIA_HA_MINUTOS);
                  else { const ns = {startTime: Date.now()}; setActiveShift(ns); saveToCloud({activeShift: ns}); }
                }} 
                className={`w-44 h-44 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all active:scale-90 border-[8px] shrink-0 ${activeShift ? 'bg-rose-500 border-rose-100 shadow-rose-200' : 'bg-emerald-600 border-emerald-100 shadow-emerald-200'}`}
              >
                {activeShift ? <Square size={36} className="text-white fill-white"/> : <Play size={36} className="text-white fill-white ml-2"/>}
                <span className="text-white font-black text-[10px] mt-2 uppercase tracking-widest">{activeShift ? 'Cerrar' : 'Entrar'}</span>
              </button>

              <div className="w-full flex justify-center pb-4">
                  {activeShift ? (
                    <div className="w-full max-w-[220px] bg-emerald-50 p-5 rounded-3xl border border-emerald-100 space-y-4 shadow-sm">
                      {isBreakActive && (
                        <div className="text-center">
                          <div className={`text-3xl font-black leading-none ${showBreakFinishedMsg ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>{formatCountdown(breakTimeLeft)}</div>
                          <p className="text-[10px] font-bold text-emerald-400 uppercase mt-1 tracking-widest">{showBreakFinishedMsg ? '¡TIEMPO AGOTADO!' : 'Restante'}</p>
                        </div>
                      )}
                      <button 
                        onClick={toggleDescanso} 
                        className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all ${
                          showBreakFinishedMsg ? 'bg-rose-600 text-white animate-bounce' : isBreakActive ? 'bg-slate-800 text-white' : 'bg-emerald-200 text-emerald-800'
                        }`}
                      >
                        {isBreakActive ? <><Timer size={16} /> Volver</> : <><Coffee size={16} /> Descanso {settings.breakDuration}m</>}
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">Presiona el botón para<br/>iniciar el registro de hoy</p>
                    </div>
                  )}
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="flex flex-col animate-in fade-in duration-300 gap-4 pb-20">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col pb-2">
                <div className="p-4 flex justify-between items-center bg-slate-50 border-b border-slate-100">
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-200 rounded-xl transition-colors text-emerald-600"><ChevronLeft size={22}/></button>
                  <span className="text-base sm:text-lg font-black uppercase italic text-emerald-700 tracking-widest">{currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-200 rounded-xl transition-colors text-emerald-600"><ChevronRight size={22}/></button>
                </div>
                <div className="p-3 grid grid-cols-7 gap-1.5">
                  {['L','M','X','J','V','S','D'].map(d=><div key={d} className="text-center text-[10px] font-black text-slate-300 py-1">{d}</div>)}
                  {(() => {
                    const days = [];
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const startOffset = (new Date(year, month, 1).getDay() || 7) - 1;
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    for (let i = 0; i < startOffset; i++) days.push(<div key={`e-${i}`}></div>);
                    for (let d = 1; d <= daysInMonth; d++) {
                      const dStr = getFormattedDate(new Date(year, month, d));
                      const s = shiftsMap[dStr];
                      const dayOfWeek = new Date(year, month, d).getDay();
                      let style = "bg-slate-50 text-slate-400 hover:bg-slate-100";
                      let label = "";
                      if (s?.type === 'work') { style = s.isHA ? "bg-blue-600 text-white" : "bg-pink-200 text-pink-900"; label = `${Math.floor(s.hours)}h`; }
                      else if (s?.type === 'vacation') { style = "bg-purple-200 text-purple-800"; label = "Vac"; }
                      else if (s?.type === 'rest') {
                        const isSat = dayOfWeek === 6;
                        const partner = shiftsMap[getFormattedDate(new Date(year, month, isSat ? d+1 : d-1))];
                        if (partner?.type === 'rest') { style = "bg-green-500 text-white"; label = "Cal"; }
                        else { style = "bg-amber-500 text-white"; label = "Lib"; }
                      }
                      days.push(
                        <button key={d} onClick={() => handleDayClick(dStr)} onDoubleClick={() => openEditHours(dStr)}
                          className={`h-11 sm:h-12 w-full flex flex-col items-center justify-center rounded-xl text-[11px] font-bold relative transition-all active:scale-95 ${selectedDates.includes(dStr) ? 'ring-4 ring-emerald-400 bg-white scale-90 z-10 shadow-lg' : style}`}>
                          {d}
                          <span className="text-[6px] uppercase leading-none mt-0.5 font-bold">{label}</span>
                        </button>
                      );
                    }
                    return days;
                  })()}
                </div>
              </div>

              {selectedDates.length === 1 && (() => {
                const dateStr = selectedDates[0];
                const [y, m, d] = dateStr.split('-');
                const dObj = new Date(y, m - 1, d);
                const s = shiftsMap[dateStr];
                const dayOfWeek = dObj.getDay();

                let isQuality = false;
                if (dayOfWeek === 6 || dayOfWeek === 0) {
                  const isSat = dayOfWeek === 6;
                  const partnerD = new Date(y, m - 1, isSat ? parseInt(d)+1 : parseInt(d)-1);
                  const partnerStr = getFormattedDate(partnerD);
                  const partnerS = shiftsMap[partnerStr];
                  if (s?.type === 'rest' && partnerS?.type === 'rest') isQuality = true;
                }

                let statusText = "Sin registro";
                let statusColor = "bg-slate-100 text-slate-500";
                let hoursText = "--";

                if (s?.type === 'work') {
                  statusText = s.isHA ? "DÍA HA" : "TRABAJADO";
                  statusColor = s.isHA ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-pink-100 text-pink-700 border-pink-200";
                  hoursText = `${Math.floor(s.hours)}h ${Math.round((s.hours % 1) * 60)}m`;
                } else if (s?.type === 'vacation') {
                  statusText = "VACACIONES";
                  statusColor = "bg-purple-100 text-purple-700 border-purple-200";
                  hoursText = "Libre";
                } else if (s?.type === 'rest') {
                  statusText = isQuality ? "CALIDAD" : "DESCANSO";
                  statusColor = isQuality ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200";
                  hoursText = "Libre";
                }

                return (
                  <div className="bg-white rounded-[2rem] p-6 shadow-2xl border-2 border-emerald-100 flex flex-col shrink-0 animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-6xl font-black text-emerald-600 leading-none tracking-tighter">{dObj.getDate()}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest capitalize mt-2">{dObj.toLocaleDateString('es-ES', { weekday: 'long', month: 'long' })}</span>
                      </div>
                      <button onClick={() => setSelectedDates([])} className="p-2.5 bg-slate-50 text-slate-300 rounded-full hover:bg-slate-200 transition-colors"><X size={24}/></button>
                    </div>
                    
                    <div className="flex items-center justify-between bg-slate-50 p-5 rounded-2xl mb-6 border border-slate-100">
                      <div className={`px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border ${statusColor}`}>{statusText}</div>
                      <div className={`text-3xl font-black font-mono ${s?.type === 'work' ? 'text-slate-800' : 'text-slate-400'}`}>{hoursText}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => markMulti('rest')} className="bg-amber-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Marcar Libre</button>
                      <button onClick={() => markMulti('vacation')} className="bg-purple-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Marcar Vacas</button>
                      <button onClick={() => openEditHours(dateStr)} className="bg-blue-600 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Ajustar Horas</button>
                      <button onClick={deleteSelectedDates} className="bg-rose-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Borrar Registro</button>
                    </div>
                  </div>
                );
              })()}

              {selectedDates.length > 1 && (
                <div className="flex gap-2 p-2 bg-slate-900 rounded-2xl shadow-xl animate-in slide-in-from-bottom-5">
                  <button onClick={() => markMulti('rest')} className="flex-1 bg-amber-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Librar Todos</button>
                  <button onClick={() => markMulti('vacation')} className="flex-1 bg-purple-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Vacas Todos</button>
                  <button onClick={deleteSelectedDates} className="flex-1 bg-rose-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Borrar Todos</button>
                  <button onClick={() => setSelectedDates([])} className="bg-white/10 p-3 rounded-xl text-white hover:bg-white/20"><X size={18}/></button>
                </div>
              )}
            </div>
          )}

          {/* 🔥 PESTAÑA LICENCIAS CON SUPERPODERES ADMIN 🔥 */}
          {activeTab === 'licencias' && (
            <div className="flex flex-col animate-in fade-in duration-300 gap-4 pb-20">
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col min-h-[300px]">
                <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-black text-slate-800 uppercase italic tracking-widest flex items-center gap-2">
                    <FileText size={18} className="text-emerald-600" /> Permisos & Licencias
                  </h2>
                  
                  {/* BOTONES GLOBALES DE ADMIN (NUEVA / BASE) */}
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
                          {/* 🔥 BOTONERA ADMIN PARA CADA LICENCIA 🔥 */}
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
          )}

          {activeTab === 'support' && (
            <div className="flex flex-col space-y-5 animate-in fade-in duration-300 pb-20">
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center gap-5">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm shrink-0"><User className="text-emerald-700" size={32}/></div>
                <div className="flex-1">
                  <h3 className="text-sm font-black text-slate-800 uppercase italic">Soporte Técnico</h3>
                  <p className="text-[11px] text-slate-500 font-bold mt-1 tracking-wide leading-relaxed">Contacta con tu delegado de zona para consultas o sugerencias.</p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-[2rem] p-6 flex flex-col">
                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-white/5 pb-3"><Settings size={16}/> Preferencias</h3>
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-white uppercase leading-none">Notificaciones</span>
                        <span className="text-[9px] text-white/40 uppercase mt-1.5 font-medium tracking-tight">Vibración y alarma al terminar descanso</span>
                    </div>
                    <button onClick={() => {
                        const newSettings = {...settings, notifications: !settings.notifications};
                        setSettings(newSettings); saveToCloud({settings: newSettings});
                        if(!newSettings.notifications) stopAlarm();
                    }} className={`w-12 h-6 rounded-full relative transition-colors ${settings.notifications ? 'bg-emerald-500' : 'bg-white/20'}`}>
                       <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${settings.notifications ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <div className="space-y-4 flex flex-col">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Minutos de Descanso</span>
                    <div className="grid grid-cols-5 gap-2">
                      {[15, 20, 30, 45, 60].map(m => (
                        <button key={m} onClick={() => {
                            const newSettings = {...settings, breakDuration: m};
                            setSettings(newSettings); saveToCloud({settings: newSettings});
                        }}
                          className={`py-3 rounded-xl text-xs font-black transition-all active:scale-95 ${settings.breakDuration === m ? 'bg-emerald-600 text-white scale-105 shadow-md' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}>{m}m</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <nav className="h-20 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center px-3 shrink-0 fixed bottom-0 left-0 right-0 z-50 pb-5">
          <NavItem icon={<PieChart />} label="Resumen" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Clock />} label="Fichar" isActive={activeTab === 'track'} onClick={() => setActiveTab('track')} />
          <NavItem icon={<CalendarIcon />} label="Agenda" isActive={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
          <NavItem icon={<FileText />} label="Permisos" isActive={activeTab === 'licencias'} onClick={() => setActiveTab('licencias')} />
          <NavItem icon={<Settings />} label="Ajustes" isActive={activeTab === 'support'} onClick={() => setActiveTab('support')} />
        </nav>

        {showConfirmLogout && (
          <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-6 shadow-2xl w-full max-w-xs text-center border border-emerald-50 animate-in zoom-in-95">
              <div className="mb-4 text-emerald-600 flex justify-center"><LogOut size={40}/></div>
              <h3 className="text-base font-black text-slate-800 mb-2 uppercase italic leading-none tracking-tight">¿Cerrar sesión?</h3>
              <p className="text-[10px] text-slate-500 mb-6 uppercase font-bold tracking-widest leading-relaxed">Tus registros están<br/>seguros en la nube.</p>
              <div className="flex gap-3">
                <button onClick={handleLogout} className="flex-1 bg-rose-500 text-white py-3.5 rounded-xl font-black text-xs uppercase shadow-md active:scale-95 transition-all">SALIR</button>
                <button onClick={() => setShowConfirmLogout(false)} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-black text-xs uppercase active:scale-95 transition-all hover:bg-slate-200">CANCELAR</button>
              </div>
            </div>
          </div>
        )}

        {editingDay && (
          <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl w-full max-w-xs animate-in zoom-in-95 flex flex-col">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                <span className="text-xs font-black uppercase text-rose-600 italic tracking-widest">Ajuste Manual</span>
                <button onClick={() => setEditingDay(null)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200 text-slate-300"><X size={20}/></button>
              </div>
              <div className="flex items-center justify-center gap-4 mb-8 bg-slate-50 py-6 rounded-3xl text-slate-800 border border-slate-100 shadow-inner">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Horas</span>
                    <input type="number" min="0" max="24" value={editHH} onChange={e=>setEditHH(e.target.value)} className="w-20 bg-white border border-slate-200 p-3 rounded-2xl text-center text-3xl font-black outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all shadow-sm"/>
                </div>
                <span className="font-black text-4xl text-slate-300 mt-6">:</span>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Minutos</span>
                    <input type="number" min="0" max="59" value={editmm} onChange={e=>handleMinutesChange(e.target.value)} className="w-20 bg-white border border-slate-200 p-3 rounded-2xl text-center text-3xl font-black outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all shadow-sm"/>
                </div>
              </div>
              <button onClick={saveEditedHours} className="w-full bg-rose-500 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all">GUARDAR CAMBIOS</button>
            </div>
          </div>
        )}

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
                          <button onClick={()=>setFormBase64Image(null)} className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:bg-rose-600"><X size={14}/></button>
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
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all flex-1 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
      <div className={`p-2 rounded-2xl transition-all ${isActive ? 'bg-emerald-50 shadow-inner scale-110' : 'hover:bg-slate-100'}`}>{React.cloneElement(icon, { size: 20, strokeWidth: isActive ? 3 : 2 })}</div>
      <span className={`text-[9px] uppercase tracking-tighter leading-none ${isActive ? 'font-black' : 'font-bold'}`}>{label}</span>
    </button>
  );
}

function StatBar({ label, currentValue, totalValue, percentage, color, large = false }) {
  return (
    <div className="space-y-3 flex flex-col">
      <div className="flex justify-between font-black uppercase tracking-widest items-end leading-none">
        <span className={large ? "text-xs text-slate-500 font-bold tracking-tight" : "text-[10px] text-slate-400"}>{label}</span>
        <span className={`text-slate-900 ${large ? "text-2xl font-black tracking-tighter" : "text-sm"}`}>{currentValue} <span className={`${large ? "text-xs" : "text-[8px]"} text-slate-400 font-bold tracking-normal`}>/ {totalValue}</span></span>
      </div>
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50 shadow-inner ${large ? "h-4" : "h-3.5"}`}>
        <div className={`${color} h-full transition-all duration-1000 shadow-sm`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
      </div>
    </div>
  );
}

function InputGroup({ label, name, icon, type = "text", maxLength, minLength, small = false, ...props }) {
  return (
    <div className="space-y-1.5 flex flex-col">
      <label className="text-xs font-black text-emerald-600 uppercase ml-1 tracking-tight">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">{React.cloneElement(icon, { size: 18 })}</div>}
        <input 
          name={name} type={type} maxLength={maxLength} minLength={minLength} required 
          className={`w-full ${icon ? 'pl-10' : 'px-3'} bg-slate-50 border-none ${small ? 'p-3 text-sm' : 'p-3.5 text-base'} rounded-xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm text-slate-800 leading-none`} 
          {...props}
        />
      </div>
    </div>
  );
}