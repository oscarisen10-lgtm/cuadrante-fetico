import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Calendar as CalendarIcon, PieChart, MessageCircle, Play, Square, 
  AlertTriangle, Coffee, Sun, User, Lock, Building, ChevronLeft, ChevronRight, 
  LogOut, Store, Newspaper, Timer, BellRing, Edit2, Check, X, CalendarDays, 
  Zap, Mail, Award, KeyRound, ShieldCheck, Settings, Bell, BellOff,
  Plus, Trash2
} from 'lucide-react';

// --- CONFIGURACIÓN ADMINISTRADOR ---
const ADMIN_EMAIL = 'oscargarcia@fetico.es'; // Regístrate con este correo para tener los botones de borrar/añadir

// --- CONFIGURACIÓN ANGED ---
const CONFIG = {
  MAX_DIAS_HA: 15,
  LIMITE_ANUAL_HORAS: 1770,
  MAX_FINES_CALIDAD: 10,
  UMBRAL_DIA_HA_MINUTOS: 510, // 8h 30m
  COLORES: {
    PINK_WORK: '#fbcfe8',
    PINK_TEXT: '#831843',
    FETICO_QUALITY: '#22c55e',
    BLUE_HA: '#2563eb',
    AMBER_REST: '#f59e0b',
    PURPLE_VAC: '#a855f7'
  }
};

const INITIAL_NEWS = [
  { id: 1, title: "Nuevo acuerdo domingos", date: "Hoy", tag: "ANGED", desc: "Se ha firmado el nuevo calendario de aperturas para el 2024 en todos los centros Supercor." },
  { id: 2, title: "Guía rápida días HA", date: "Ayer", tag: "Fetico", desc: "Recuerda que los días de alta actividad se deben registrar correctamente para su compensación." },
  { id: 3, title: "Elecciones Sindicales", date: "2 Mar", tag: "Fetico", desc: "Resultados positivos en las últimas mesas electorales de la zona centro." }
];

const getFormattedDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function App() {
  // --- FORZAR MODO CLARO EN EL MÓVIL ---
  useEffect(() => {
    document.documentElement.style.colorScheme = 'light';
    document.body.style.backgroundColor = '#f8fafc'; // slate-50
    document.body.style.color = '#1e293b'; // slate-800
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  // --- ESTADOS DE LA APLICACIÓN ---
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ notifications: true, breakDuration: 15 });
  const [shifts, setShifts] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [workTimeAccumulated, setWorkTimeAccumulated] = useState(0);
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState(null);

  // Estado para las noticias dinámicas
  const [newsList, setNewsList] = useState(() => {
    try {
      const saved = localStorage.getItem('cuadrante_news');
      return saved ? JSON.parse(saved) : INITIAL_NEWS;
    } catch {
      return INITIAL_NEWS;
    }
  });

  // --- ESTADOS DE UI ---
  const [isRegistering, setIsRegistering] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showAddNewsModal, setShowAddNewsModal] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [activeTab, setActiveTab] = useState('dashboard');
  const [elapsed, setElapsed] = useState(0); 
  const [breakTimeLeft, setBreakTimeLeft] = useState(settings.breakDuration * 60); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [showBreakFinishedMsg, setShowBreakFinishedMsg] = useState(false);
  
  // Agenda UI
  const [selectedDates, setSelectedDates] = useState([]); 
  const [editingDay, setEditingDay] = useState(null); 
  const [editHH, setEditHH] = useState("0");
  const [editmm, setEditmm] = useState("0");

  // --- GUARDADO AUTOMÁTICO EN EL NAVEGADOR (LOCALSTORAGE) ---
  useEffect(() => {
    if (!user) return;
    const saveToLocal = () => {
      try {
        const usersDb = JSON.parse(localStorage.getItem('cuadrante_db') || '{}');
        usersDb[user.email] = {
          profile: user,
          settings,
          shifts,
          activeShift,
          workTimeAccumulated,
          isBreakActive,
          breakStartTime
        };
        localStorage.setItem('cuadrante_db', JSON.stringify(usersDb));
      } catch (error) {
        console.error("Error guardando datos localmente:", error);
      }
    };
    saveToLocal();
  }, [user, settings, shifts, activeShift, workTimeAccumulated, isBreakActive, breakStartTime]);

  // Guardar noticias
  useEffect(() => {
    localStorage.setItem('cuadrante_news', JSON.stringify(newsList));
  }, [newsList]);

  // --- LÓGICA DEL TIEMPO (RELOJ) ---
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
        if (remaining === 0 && !showBreakFinishedMsg) setShowBreakFinishedMsg(true);
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeShift, isBreakActive, workTimeAccumulated, breakStartTime, showBreakFinishedMsg, settings.breakDuration]);

  // --- CÁLCULOS ANGED ---
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
    shifts.forEach(s => {
      if (s.type === 'work') {
        horasTotalesDecimal += s.hours;
        if (s.isHA) contadorHA += 1;
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
    return { horasTotales: horasTotalesDecimal, contadorHA, findesCalidad, vacacionesCount };
  }, [shifts, shiftsMap]);

  // --- MANEJADORES LOCALES (LOGIN / REGISTER / LOGOUT) ---
  const handleAuth = (e) => {
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

    setTimeout(() => {
      const usersDb = JSON.parse(localStorage.getItem('cuadrante_db') || '{}');

      if (!isRegistering) {
        if (usersDb[emailInput]) {
          const data = usersDb[emailInput];
          if (data.profile.password === pass) {
            setUser(data.profile);
            setSettings(data.settings || { notifications: true, breakDuration: 15 });
            setShifts(data.shifts || []);
            setActiveShift(data.activeShift || null);
            setWorkTimeAccumulated(data.workTimeAccumulated || 0);
            setIsBreakActive(data.isBreakActive || false);
            setBreakStartTime(data.breakStartTime || null);
            
            setActiveTab('dashboard');
          } else {
            setRecoveryError("Contraseña incorrecta");
            setTimeout(() => setRecoveryError(""), 3000);
          }
        } else {
          setRecoveryError("Cuenta no encontrada. Regístrate primero.");
          setTimeout(() => setRecoveryError(""), 3000);
        }
      } else {
        if (usersDb[emailInput]) {
          setRecoveryError("El email ya está registrado");
          setTimeout(() => setRecoveryError(""), 3000);
        } else {
          const newUser = {
            email: emailInput,
            fullName: formData.get('fullName') || 'Compañero/a',
            affiliate: formData.get('affiliate') || '',
            company: formData.get('company') || "Supercor",
            store: formData.get('store') || "Centro",
            rank: formData.get('rank') || "Personal base",
            password: pass 
          };
          
          usersDb[emailInput] = {
            profile: newUser,
            settings: { notifications: true, breakDuration: 15 },
            shifts: [],
            activeShift: null,
            workTimeAccumulated: 0,
            isBreakActive: false,
            breakStartTime: null
          };
          
          localStorage.setItem('cuadrante_db', JSON.stringify(usersDb));

          setUser(newUser);
          setSettings(usersDb[emailInput].settings);
          setShifts(usersDb[emailInput].shifts);
          
          setIsRegistering(false);
          setActiveTab('dashboard');
        }
      }
      setIsLoading(false);
    }, 600);
  };

  const handleRecovery = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const emailInput = formData.get('email')?.trim().toLowerCase();
    const aff = formData.get('affiliate');
    const newPass = formData.get('newPassword');
    const confirmPass = formData.get('confirmPassword');

    if (newPass.length < 6) {
      setRecoveryError("La contraseña debe tener mínimo 6 caracteres.");
      return;
    }
    if (newPass !== confirmPass) {
      setRecoveryError("Las contraseñas no coinciden.");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const usersDb = JSON.parse(localStorage.getItem('cuadrante_db') || '{}');
      
      if (!usersDb[emailInput]) {
        setRecoveryError("Cuenta no encontrada.");
      } else {
        const data = usersDb[emailInput];
        if (data.profile.affiliate !== aff) {
          setRecoveryError("El Nº de afiliado no coincide.");
        } else {
          data.profile.password = newPass;
          usersDb[emailInput] = data;
          localStorage.setItem('cuadrante_db', JSON.stringify(usersDb));
          setRecoveryError("¡Éxito! Contraseña actualizada.");
          setTimeout(() => { setShowForgotModal(false); setRecoveryError(""); }, 2000);
        }
      }
      setIsLoading(false);
    }, 600);
  };

  const handleLogout = () => {
    setUser(null);
    setShowConfirmLogout(false);
    setShifts([]);
    setActiveShift(null);
    setWorkTimeAccumulated(0);
    setIsBreakActive(false);
    setBreakStartTime(null);
  };

  // --- MANEJADORES DE NOTICIAS ---
  const handleAddNews = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newNews = {
      id: Date.now(),
      title: formData.get('title'),
      date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      tag: formData.get('tag') || 'Fetico',
      desc: formData.get('desc')
    };
    setNewsList([newNews, ...newsList]);
    setShowAddNewsModal(false);
  };

  const handleDeleteNews = (id) => {
    setNewsList(newsList.filter(n => n.id !== id));
  };

  // --- MANEJADORES DE INTERFAZ ---
  const toggleDescanso = () => {
    if (!isBreakActive) {
      setWorkTimeAccumulated(prev => prev + Math.floor((Date.now() - activeShift.startTime) / 1000));
      setBreakStartTime(Date.now());
      setIsBreakActive(true);
      setShowBreakFinishedMsg(false);
      setBreakTimeLeft(settings.breakDuration * 60);
    } else {
      setIsBreakActive(false);
      setBreakStartTime(null);
      setActiveShift({ startTime: Date.now() });
      setShowBreakFinishedMsg(false);
    }
  };

  const cerrarTurno = (esHA) => {
    const hoyStr = getFormattedDate(new Date());
    setShifts(prev => {
      const filtered = prev.filter(s => s.date !== hoyStr);
      return [...filtered, { id: Date.now(), date: hoyStr, type: 'work', hours: elapsed / 3600, isHA: esHA }];
    });
    setActiveShift(null);
    setWorkTimeAccumulated(0);
    setIsBreakActive(false);
    setShowBreakFinishedMsg(false);
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
    setShifts(prev => {
      const filtered = prev.filter(s => s.date !== editingDay);
      return [...filtered, { id: Date.now(), date: editingDay, type: 'work', hours: hoursDecimal, isHA: (hoursDecimal * 60) >= CONFIG.UMBRAL_DIA_HA_MINUTOS }];
    });
    setEditingDay(null);
  };

  const markMulti = (type) => {
    setShifts(prev => {
      const filtered = prev.filter(s => !selectedDates.includes(s.date));
      const newEntries = selectedDates.map(date => ({ id: Math.random(), date, type, hours: 0, isHA: false }));
      return [...filtered, ...newEntries];
    });
    setSelectedDates([]);
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

  // --- RENDER PANTALLA DE ACCESO (LOGIN/REGISTER) ---
  if (!user) {
    return (
      <div className="h-[100dvh] bg-emerald-50 flex flex-col items-center justify-center p-4 font-sans overflow-hidden text-slate-800" style={{ colorScheme: 'light' }}>
        <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-xl overflow-hidden border border-emerald-100 flex flex-col max-h-[95vh]">
          <div className="bg-emerald-600 p-4 text-center text-white shrink-0">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mx-auto mb-1 shadow-inner shrink-0">
              <span className="text-emerald-600 font-black text-xl italic leading-none">F</span>
            </div>
            <h1 className="text-base font-black italic uppercase tracking-tight leading-none">Mi Cuadrante App</h1>
            <p className="text-emerald-100 text-[8px] uppercase font-bold tracking-widest mt-1">Fetico • ANGED</p>
          </div>

          <form onSubmit={handleAuth} className="p-4 flex flex-col overflow-hidden">
            <div className="space-y-3 overflow-y-auto pr-1 scrollbar-hide flex-1">
              {isRegistering ? (
                <>
                  <InputGroup label="Nombre y Apellidos" name="fullName" small icon={<User size={14}/>} />
                  <InputGroup label="Email" name="email" type="email" small icon={<Mail size={14}/>} />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <InputGroup label="Nº Afiliado Fetico" name="affiliate" small icon={<Award size={14}/>} />
                    <div className="space-y-0.5">
                      <label className="text-[8px] font-black text-emerald-600 uppercase ml-1">Empresa</label>
                      <select name="company" className="w-full bg-slate-50 border-none p-1.5 rounded-lg text-[10px] outline-none ring-1 ring-slate-200">
                        <option>Supercor</option>
                        <option>S. Romero</option>
                        <option>S. Express</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <InputGroup label="Centro / Tienda" name="store" small icon={<Store size={14}/>} />
                    <div className="space-y-0.5">
                      <label className="text-[8px] font-black text-emerald-600 uppercase ml-1">Rango</label>
                      <select name="rank" className="w-full bg-slate-50 border-none p-1.5 rounded-lg text-[10px] outline-none ring-1 ring-slate-200">
                        <option>Base</option>
                        <option>Prof.</option>
                        <option>Coord.</option>
                      </select>
                    </div>
                  </div>
                  
                  <InputGroup label="Contraseña (mín. 6)" name="password" type="password" minLength={6} small icon={<Lock size={14}/>} />
                </>
              ) : (
                <div className="space-y-4 py-2">
                  <InputGroup label="Correo Electrónico" name="email" type="email" icon={<Mail size={14}/>} />
                  <InputGroup label="Contraseña" name="password" type="password" minLength={6} icon={<Lock size={14}/>} />
                  <button type="button" onClick={() => setShowForgotModal(true)} className="w-full text-center text-[9px] font-black text-slate-400 uppercase tracking-tighter hover:text-emerald-600 transition-colors">
                    ¿Has olvidado tu contraseña?
                  </button>
                  {recoveryError && <div className="text-[10px] text-rose-500 font-bold text-center animate-pulse">{recoveryError}</div>}
                </div>
              )}
            </div>
            
            <div className="mt-4 space-y-2 shrink-0">
              <button type="submit" disabled={isLoading} className={`w-full bg-emerald-600 text-white font-black py-2.5 rounded-xl uppercase text-xs active:scale-95 transition-all shadow-md ${isLoading ? 'opacity-70' : ''}`}>
                {isLoading ? 'CARGANDO...' : (isRegistering ? 'CREAR CUENTA' : 'ENTRAR')}
              </button>
              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setRecoveryError(""); }} className="w-full text-center text-[9px] font-black text-emerald-700 uppercase tracking-widest leading-none mt-2">
                {isRegistering ? 'Volver atrás' : '¿Eres nuevo? Regístrate'}
              </button>
            </div>
          </form>
        </div>

        {/* MODAL RECUPERACIÓN CONTRASEÑA */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-5 shadow-2xl w-full max-w-sm border border-emerald-50 relative animate-in zoom-in-95">
                <button onClick={() => { setShowForgotModal(false); setRecoveryError(""); }} className="absolute top-4 right-4 text-slate-300"><X size={20} /></button>
                <div className="text-emerald-600 flex justify-center mb-1"><KeyRound size={28}/></div>
                <h3 className="text-base font-black text-center text-slate-800 mb-1 italic uppercase">Recuperar Acceso</h3>
                <p className="text-center text-slate-500 text-[9px] mb-3 uppercase font-bold">Datos requeridos de la cuenta</p>
                <form onSubmit={handleRecovery} className="space-y-2">
                    <InputGroup label="Email Registrado" name="email" type="email" icon={<Mail size={14}/>} small />
                    <InputGroup label="Nº Afiliado Fetico" name="affiliate" icon={<Award size={14}/>} small />
                    <InputGroup label="Nueva Contraseña (mín. 6)" name="newPassword" type="password" minLength={6} small icon={<Lock size={14}/>} />
                    <InputGroup label="Confirmar Contraseña" name="confirmPassword" type="password" minLength={6} small icon={<ShieldCheck size={14}/>} />
                    {recoveryError && <div className={`p-1.5 rounded text-center text-[8px] font-black uppercase ${recoveryError.includes('Éxito') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{recoveryError}</div>}
                    <button type="submit" disabled={isLoading} className={`w-full bg-emerald-600 text-white font-black py-2 rounded-xl uppercase text-[10px] mt-2 ${isLoading ? 'opacity-70' : ''}`}>
                      {isLoading ? 'VERIFICANDO...' : 'CAMBIAR CONTRASEÑA'}
                    </button>
                </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const isAdmin = user?.email === ADMIN_EMAIL;

  // --- RENDER APP PRINCIPAL ---
  return (
    <div className="h-[100dvh] bg-slate-50 flex justify-center font-sans overflow-hidden text-slate-800" style={{ colorScheme: 'light' }}>
      <div className="w-full max-w-md bg-white h-full flex flex-col relative overflow-hidden">
        
        <header className="bg-emerald-600 text-white p-3 rounded-b-[1.5rem] shadow-lg shrink-0">
          <div className="flex justify-between items-center px-1">
            <div>
              <h1 className="font-black text-base italic leading-tight">Hola, {user.fullName.split(' ')[0]}</h1>
              <span className="text-[7px] uppercase font-bold opacity-80 tracking-widest leading-none">
                {isAdmin ? 'Manejo de Administrador 👑' : 'Guardado Local Activo 💾'}
              </span>
            </div>
            <button onClick={() => setShowConfirmLogout(true)} className="bg-white/10 p-2 rounded-lg"><LogOut size={16} /></button>
          </div>
        </header>

        <main className="flex-1 p-3 overflow-y-auto scrollbar-hide flex flex-col min-h-0">
          
          {/* TAB: RESUMEN */}
          {activeTab === 'dashboard' && (
            <div className="flex flex-col animate-in fade-in duration-300 gap-4 pb-20">
              <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 flex flex-col min-h-[320px]">
                <h2 className="text-xs font-black text-slate-800 uppercase italic tracking-widest border-b pb-2 flex items-center gap-2 mb-6 shrink-0">
                  <PieChart size={14} className="text-emerald-600" /> Resumen Calendario
                </h2>
                <div className="flex-1 flex flex-col justify-between py-2 space-y-6">
                  <StatBar label="Horas Anuales" currentValue={formatTotalTime(stats.horasTotales)} percentage={(stats.horasTotales/CONFIG.LIMITE_ANUAL_HORAS)*100} totalValue="1770h" color="bg-pink-300" large />
                  <StatBar label="Días HA" currentValue={stats.contadorHA} percentage={(stats.contadorHA/CONFIG.MAX_DIAS_HA)*100} totalValue={CONFIG.MAX_DIAS_HA} color="bg-blue-600" large />
                  <StatBar label="Calidad" currentValue={stats.findesCalidad} percentage={(stats.findesCalidad/CONFIG.MAX_FINES_CALIDAD)*100} totalValue={CONFIG.MAX_FINES_CALIDAD} color="bg-green-500" large />
                </div>
              </div>

              <div className="bg-slate-900 rounded-[1.5rem] p-5 flex flex-col min-h-[350px]">
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <h3 className="text-[10px] font-black text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                      <Newspaper size={12}/> Noticias Sindicales
                  </h3>
                  {isAdmin && (
                    <button onClick={() => setShowAddNewsModal(true)} className="bg-emerald-600 text-white px-2 py-1 rounded-lg flex items-center gap-1 text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all">
                      <Plus size={10}/> Nueva
                    </button>
                  )}
                </div>
                
                <div className="space-y-4">
                    {newsList.length === 0 ? (
                       <p className="text-[10px] text-white/40 text-center py-4">No hay noticias publicadas.</p>
                    ) : (
                      newsList.map(news => (
                          <div key={news.id} className="bg-white/5 p-4 rounded-xl border border-white/5 transition-all relative">
                              {isAdmin && (
                                <button onClick={() => handleDeleteNews(news.id)} className="absolute top-2 right-2 text-rose-500 bg-rose-500/10 p-1.5 rounded-lg active:scale-90 transition-all">
                                  <Trash2 size={12}/>
                                </button>
                              )}
                              <div className="flex justify-between items-center mb-1.5 pr-8">
                                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">{news.tag}</span>
                                  <span className="text-[8px] text-white/40">{news.date}</span>
                              </div>
                              <h4 className="text-xs font-black text-white uppercase leading-tight mb-2 pr-6">{news.title}</h4>
                              <p className="text-[10px] text-white/60 leading-snug">{news.desc}</p>
                          </div>
                      ))
                    )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: FICHAR */}
          {activeTab === 'track' && (
            <div className="h-full flex flex-col items-center justify-between py-6 animate-in fade-in duration-300">
              <div className="text-center">
                <div className={`text-5xl font-black tracking-tighter font-mono ${isBreakActive ? 'text-slate-300' : 'text-slate-800'}`}>{formatTime(elapsed)}</div>
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">
                   {activeShift ? (isBreakActive ? 'Descanso activo' : 'Jornada en curso') : 'Reloj parado'}
                </div>
              </div>

              <button 
                onClick={() => activeShift ? cerrarTurno((elapsed/60)>=CONFIG.UMBRAL_DIA_HA_MINUTOS) : setActiveShift({startTime: Date.now()})} 
                className={`w-36 h-36 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all active:scale-90 border-[6px] shrink-0 ${activeShift ? 'bg-rose-500 border-rose-100 shadow-rose-200' : 'bg-emerald-600 border-emerald-100 shadow-emerald-200'}`}
              >
                {activeShift ? <Square size={28} className="text-white fill-white"/> : <Play size={28} className="text-white fill-white ml-1"/>}
                <span className="text-white font-black text-[9px] mt-1.5 uppercase tracking-tighter">
                  {activeShift ? 'Cerrar' : 'Entrar'}
                </span>
              </button>

              <div className="w-full flex justify-center pb-4">
                  {activeShift ? (
                    <div className="w-full max-w-[200px] bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-3 shadow-sm">
                      {isBreakActive && (
                        <div className="text-center">
                          <div className="text-2xl font-black text-emerald-600 leading-none">{formatCountdown(breakTimeLeft)}</div>
                          <p className="text-[8px] font-bold text-emerald-400 uppercase mt-1">Restante</p>
                        </div>
                      )}
                      <button 
                        onClick={toggleDescanso} 
                        className={`w-full py-3 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all ${isBreakActive ? 'bg-slate-800 text-white' : 'bg-emerald-200 text-emerald-800'}`}
                      >
                        {isBreakActive ? <><Timer size={14} /> Volver</> : <><Coffee size={14} /> Descanso {settings.breakDuration}m</>}
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 text-center">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">Presiona el botón para<br/>iniciar el registro de hoy</p>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* TAB: CALENDARIO */}
          {activeTab === 'calendar' && (
            <div className="flex-1 flex flex-col animate-in fade-in duration-300 gap-3 pb-20">
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-2 flex justify-between items-center bg-slate-50 border-b">
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}><ChevronLeft size={16}/></button>
                  <span className="text-[10px] font-black uppercase italic">{currentDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</span>
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}><ChevronRight size={16}/></button>
                </div>
                <div className="p-2 grid grid-cols-7 gap-1">
                  {['L','M','X','J','V','S','D'].map(d=><div key={d} className="text-center text-[9px] font-black text-slate-300 py-0.5">{d}</div>)}
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
                      let style = "bg-slate-50 text-slate-400";
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
                        <div key={d} onClick={() => handleDayClick(dStr)} onDoubleClick={() => openEditHours(dStr)}
                          className={`h-10 w-full flex flex-col items-center justify-center rounded-lg text-[9px] font-bold relative ${selectedDates.includes(dStr) ? 'ring-2 ring-emerald-400 bg-white scale-95' : style}`}>
                          {d}
                          <span className="text-[5px] uppercase leading-none">{label}</span>
                        </div>
                      );
                    }
                    return days;
                  })()}
                </div>
              </div>

              {/* VISTA ZOOM UN SÓLO DÍA */}
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
                  statusColor = s.isHA ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700";
                  hoursText = `${Math.floor(s.hours)}h ${Math.round((s.hours % 1) * 60)}m`;
                } else if (s?.type === 'vacation') {
                  statusText = "VACACIONES";
                  statusColor = "bg-purple-100 text-purple-700";
                  hoursText = "Libre";
                } else if (s?.type === 'rest') {
                  statusText = isQuality ? "CALIDAD" : "DESCANSO";
                  statusColor = isQuality ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
                  hoursText = "Libre";
                }

                return (
                  <div className="bg-white rounded-[1.5rem] p-4 shadow-xl border border-slate-100 mt-1 flex flex-col shrink-0 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-start mb-3">
                       <div className="flex flex-col">
                         <span className="text-3xl font-black text-slate-800 leading-none">{dObj.getDate()}</span>
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest capitalize mt-1">
                           {dObj.toLocaleDateString('es-ES', { weekday: 'short', month: 'long' })}
                         </span>
                       </div>
                       <button onClick={() => setSelectedDates([])} className="p-1.5 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"><X size={16}/></button>
                    </div>
                    
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
                       <div className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${statusColor}`}>
                         {statusText}
                       </div>
                       <div className={`text-xl font-black font-mono ${s?.type === 'work' ? 'text-slate-800' : 'text-slate-400'}`}>
                         {hoursText}
                       </div>
                    </div>

                    <div className="flex gap-2">
                       <button onClick={() => markMulti('rest')} className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Librar</button>
                       <button onClick={() => markMulti('vacation')} className="flex-1 bg-purple-500 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Vacas</button>
                       <button onClick={() => openEditHours(dateStr)} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Horas</button>
                    </div>
                  </div>
                );
              })()}

              {/* VISTA SELECCIÓN MÚLTIPLE */}
              {selectedDates.length > 1 && (
                <div className="flex gap-2 p-2 bg-slate-900 rounded-xl shadow-lg mt-1 shrink-0 animate-in slide-in-from-bottom-2">
                   <div className="flex items-center justify-center px-3 border-r border-slate-700 mr-1">
                     <div className="flex flex-col items-center">
                       <span className="text-white text-sm font-black leading-none">{selectedDates.length}</span>
                       <span className="text-[7px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">Días</span>
                     </div>
                   </div>
                   <button onClick={() => markMulti('rest')} className="flex-1 bg-amber-500 text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter active:scale-95 transition-all">Librar</button>
                   <button onClick={() => markMulti('vacation')} className="flex-1 bg-purple-500 text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter active:scale-95 transition-all">Vacas</button>
                   <button onClick={() => setSelectedDates([])} className="bg-white/10 px-3 rounded-lg text-white active:scale-95 transition-all"><X size={16}/></button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'support' && (
            <div className="flex flex-col space-y-4 animate-in fade-in duration-300 pb-20">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm shrink-0"><User className="text-emerald-700" size={28}/></div>
                <div className="flex-1">
                  <h3 className="text-xs font-black text-slate-800 uppercase italic">Soporte y Contacto</h3>
                  <a href="https://wa.me/34600000000" className="text-[10px] text-emerald-600 font-black flex items-center gap-1.5 mt-1 border-b border-emerald-100 w-fit pb-0.5"><MessageCircle size={10}/> Contactar WhatsApp</a>
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl p-5">
                <h3 className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-5 flex items-center gap-2"><Settings size={14}/> Preferencias</h3>
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white uppercase leading-none">Notificaciones</span>
                        <span className="text-[7px] text-white/40 uppercase mt-1">Avisos de descanso</span>
                    </div>
                    <button onClick={() => setSettings(s=>({...s, notifications: !s.notifications}))} className={`w-10 h-5 rounded-full relative transition-colors ${settings.notifications ? 'bg-emerald-500' : 'bg-white/20'}`}>
                       <div className={`absolute top-1 size-3 bg-white rounded-full transition-all ${settings.notifications ? 'left-6' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <div className="space-y-3">
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Minutos Descanso</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[15, 20, 30, 45, 60].map(m => (
                        <button key={m} onClick={() => setSettings(s=>({...s, breakDuration: m}))}
                          className={`py-2.5 rounded-lg text-[10px] font-black transition-all ${settings.breakDuration === m ? 'bg-emerald-600 text-white scale-105' : 'bg-white/5 text-white/40'}`}>{m}m</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <nav className="h-16 bg-white/95 backdrop-blur-sm border-t border-slate-100 flex justify-around items-center px-4 shrink-0 fixed bottom-0 left-0 right-0 z-50 pb-2">
          <NavItem icon={<PieChart />} label="Resumen" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Clock />} label="Fichar" isActive={activeTab === 'track'} onClick={() => setActiveTab('track')} />
          <NavItem icon={<CalendarIcon />} label="Agenda" isActive={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
          <NavItem icon={<MessageCircle />} label="Ajustes" isActive={activeTab === 'support'} onClick={() => setActiveTab('support')} />
        </nav>

        {showConfirmLogout && (
          <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-6 shadow-2xl w-full max-w-xs text-center border border-emerald-50">
              <div className="mb-4 text-emerald-600 flex justify-center"><LogOut size={32}/></div>
              <h3 className="text-sm font-black text-slate-800 mb-2 uppercase italic leading-none">¿Cerrar sesión?</h3>
              <p className="text-[10px] text-slate-500 mb-6 uppercase font-bold tracking-tighter">Tus datos seguirán guardados en este navegador</p>
              <div className="flex gap-2">
                <button onClick={handleLogout} className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">SÍ, SALIR</button>
                <button onClick={() => setShowConfirmLogout(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all">CANCELAR</button>
              </div>
            </div>
          </div>
        )}

        {editingDay && (
          <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-6 shadow-2xl w-full max-w-xs animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-4"><span className="text-[11px] font-black uppercase text-rose-600 italic tracking-widest">Ajuste Reloj</span><button onClick={() => setEditingDay(null)} className="p-1 bg-slate-50 rounded-lg"><X size={18}/></button></div>
              <div className="flex items-center justify-center gap-3 mb-6 bg-slate-50 py-4 rounded-2xl text-slate-800">
                <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Horas</span>
                    <input type="number" min="0" max="24" value={editHH} onChange={e=>setEditHH(e.target.value)} className="w-20 bg-white border-2 border-slate-100 p-2 rounded-xl text-center text-2xl font-black outline-none focus:border-rose-300 transition-colors"/>
                </div>
                <span className="font-black text-2xl text-slate-300 mt-5">:</span>
                <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Minutos</span>
                    <input type="number" min="0" max="59" value={editmm} onChange={e=>handleMinutesChange(e.target.value)} className="w-20 bg-white border-2 border-slate-100 p-2 rounded-xl text-center text-2xl font-black outline-none focus:border-rose-300 transition-colors"/>
                </div>
              </div>
              <button onClick={saveEditedHours} className="w-full bg-rose-500 text-white py-3.5 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all">GUARDAR CAMBIOS</button>
            </div>
          </div>
        )}

        {/* MODAL CREAR NOTICIA (SOLO ADMIN) */}
        {showAddNewsModal && (
          <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-5 shadow-2xl w-full max-w-sm animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[11px] font-black uppercase text-emerald-600 italic tracking-widest">Publicar Noticia</span>
                <button onClick={() => setShowAddNewsModal(false)} className="p-1 bg-slate-50 rounded-lg"><X size={18}/></button>
              </div>
              <form onSubmit={handleAddNews} className="space-y-3">
                <InputGroup label="Título" name="title" small />
                <InputGroup label="Etiqueta (Ej. ANGED, Fetico...)" name="tag" small />
                <div className="space-y-0.5">
                  <label className="text-[7px] font-black text-emerald-600 uppercase ml-1 tracking-tighter">Descripción</label>
                  <textarea name="desc" rows="3" required className="w-full bg-slate-50 border-none p-2 text-[10px] rounded-lg outline-none ring-1 ring-slate-200 focus:ring-1 focus:ring-emerald-500 resize-none"></textarea>
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all mt-2">PUBLICAR</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- SUBCOMPONENTES ---
function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all flex-1 ${isActive ? 'text-emerald-700' : 'text-slate-300'}`}>
      <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-emerald-50 shadow-inner' : ''}`}>{React.cloneElement(icon, { size: 18, strokeWidth: isActive ? 3 : 2 })}</div>
      <span className="text-[8px] font-black uppercase tracking-tighter leading-none">{label}</span>
    </button>
  );
}

function StatBar({ label, currentValue, totalValue, percentage, color, large = false }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between font-black uppercase tracking-widest items-end leading-none">
        <span className="text-[10px] text-slate-400">{label}</span>
        <span className="text-slate-900 text-base">{currentValue} <span className="text-[10px] text-slate-300 font-bold">/ {totalValue}</span></span>
      </div>
      <div className="w-full bg-slate-100 rounded-full overflow-hidden h-3.5 border border-slate-50 shadow-inner">
        <div className={`${color} h-full transition-all duration-1000 shadow-sm`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
      </div>
    </div>
  );
}

function InputGroup({ label, name, icon, type = "text", maxLength, minLength, center = false, small = false }) {
  return (
    <div className="space-y-0.5">
      <label className="text-[7px] font-black text-emerald-600 uppercase ml-1 tracking-tighter">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input 
          name={name} 
          type={type} 
          maxLength={maxLength} 
          minLength={minLength}
          required 
          className={`w-full ${icon ? 'pl-7' : 'px-2'} bg-slate-50 border-none ${small ? 'p-1.5 text-[10px]' : 'p-2.5 text-xs'} rounded-lg outline-none ring-1 ring-slate-200 focus:ring-1 focus:ring-emerald-500 ${center ? 'text-center font-black tracking-widest' : ''} leading-none transition-all shadow-sm`} 
        />
      </div>
    </div>
  );
}