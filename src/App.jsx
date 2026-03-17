import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  Calendar as CalendarIcon,
  PieChart,
  MessageCircle,
  Play,
  Square,
  AlertTriangle,
  Coffee,
  Sun,
  User,
  Lock,
  Building,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserPlus,
  Store,
  Briefcase,
  Newspaper,
  Timer,
  BellRing,
  Edit2,
  Check,
  X,
  CalendarDays,
  Info,
  ExternalLink,
  Zap,
  Star,
  Mail,
  Award,
  KeyRound,
  ShieldCheck,
  Settings,
  Bell,
  BellOff,
} from 'lucide-react';

// --- CONFIGURACIÓN ANGED ---
const CONFIG = {
  MAX_DIAS_HA: 15,
  LIMITE_ANUAL_HORAS: 1770,
  MAX_FINES_CALIDAD: 10,
  UMBRAL_DIA_HA_MINUTOS: 510, // 8h 30m
  COLORES: {
    PINK_WORK: '#fbcfe8', // Rosa clarito para días trabajados
    PINK_TEXT: '#831843', // Texto rosa oscuro
    FETICO_QUALITY: '#22c55e', // Verde para Fin de Semana de Calidad
    BLUE_HA: '#2563eb', // Azul para HA
    AMBER_REST: '#f59e0b', // Naranja para Libre
    PURPLE_VAC: '#a855f7', // Morado para Vacaciones
  },
};

const MOCK_NEWS = [
  {
    id: 1,
    title: 'Nuevo acuerdo sobre domingos y festivos',
    date: 'Hace 2 horas',
    tag: 'Acuerdos',
  },
  {
    id: 2,
    title: 'Guía rápida: Cómo solicitar tus días HA',
    date: 'Ayer',
    tag: 'Formación',
  },
  {
    id: 3,
    title: 'Fetico gana las elecciones en Supercor Madrid',
    date: '2 feb',
    tag: 'Sindicato',
  },
];

const getFormattedDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function App() {
  // --- ESTADOS ---
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mi_cuadrante_user');
    return saved ? JSON.parse(saved) : null;
  }); // Ajustes de usuario
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('mi_cuadrante_settings');
    return saved
      ? JSON.parse(saved)
      : { notifications: true, breakDuration: 15 };
  });

  const [isRegistering, setIsRegistering] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard'); // Inicio en Resumen por defecto
  const [shifts, setShifts] = useState(() => {
    const saved = localStorage.getItem('mi_cuadrante_shifts');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeShift, setActiveShift] = useState(() => {
    const saved = localStorage.getItem('mi_cuadrante_active');
    return saved ? JSON.parse(saved) : null;
  });

  const [workTimeAccumulated, setWorkTimeAccumulated] = useState(() => {
    const saved = localStorage.getItem('mi_cuadrante_work_acc');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [isBreakActive, setIsBreakActive] = useState(() => {
    return localStorage.getItem('mi_cuadrante_break_active') === 'true';
  });

  const [breakStartTime, setBreakStartTime] = useState(() => {
    const saved = localStorage.getItem('mi_cuadrante_break_start');
    return saved ? parseInt(saved, 10) : null;
  });

  const [elapsed, setElapsed] = useState(0);
  const [breakTimeLeft, setBreakTimeLeft] = useState(
    settings.breakDuration * 60
  );
  const [currentDate, setCurrentDate] = useState(new Date());

  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [showBreakFinishedMsg, setShowBreakFinishedMsg] = useState(false); // Agenda

  const [selectedDates, setSelectedDates] = useState([]);
  const [editingDay, setEditingDay] = useState(null);
  const [editHH, setEditHH] = useState('0');
  const [editmm, setEditmm] = useState('0'); // --- TIMER ---

  useEffect(() => {
    let interval;
    if (activeShift && !isBreakActive) {
      interval = setInterval(() => {
        const currentSessionSeconds = Math.floor(
          (Date.now() - activeShift.startTime) / 1000
        );
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
        }
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [
    activeShift,
    isBreakActive,
    workTimeAccumulated,
    breakStartTime,
    showBreakFinishedMsg,
    settings.breakDuration,
  ]); // --- PERSISTENCIA ---

  useEffect(() => {
    localStorage.setItem('mi_cuadrante_user', JSON.stringify(user));
    localStorage.setItem('mi_cuadrante_shifts', JSON.stringify(shifts));
    localStorage.setItem('mi_cuadrante_active', JSON.stringify(activeShift));
    localStorage.setItem(
      'mi_cuadrante_work_acc',
      workTimeAccumulated.toString()
    );
    localStorage.setItem('mi_cuadrante_break_active', isBreakActive.toString());
    localStorage.setItem('mi_cuadrante_settings', JSON.stringify(settings));
    if (breakStartTime)
      localStorage.setItem(
        'mi_cuadrante_break_start',
        breakStartTime.toString()
      );
    else localStorage.removeItem('mi_cuadrante_break_start');
  }, [
    user,
    shifts,
    activeShift,
    workTimeAccumulated,
    isBreakActive,
    breakStartTime,
    settings,
  ]);

  const shiftsMap = useMemo(() => {
    const map = {};
    shifts.forEach((s) => {
      map[s.date] = s;
    });
    return map;
  }, [shifts]);

  const stats = useMemo(() => {
    let horasTotalesDecimal = 0;
    let contadorHA = 0;
    let vacacionesCount = 0;
    let findesCalidad = 0;
    shifts.forEach((s) => {
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

        const isSatRest = satS && satS.type === 'rest';
        const isSunRest = sunS && sunS.type === 'rest';

        if (isSatRest && isSunRest) findesCalidad++;
      }
      current.setDate(current.getDate() + 1);
    }

    return {
      horasTotales: horasTotalesDecimal,
      contadorHA,
      findesCalidad: Math.min(findesCalidad, CONFIG.MAX_FINES_CALIDAD),
      vacacionesCount,
    };
  }, [shifts, shiftsMap]); // --- MANEJADORES ---

  const handleAuth = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const pass = formData.get('password');
    const userLogin = formData.get('username');

    if (!isRegistering) {
      const saved = JSON.parse(localStorage.getItem('mi_cuadrante_user'));
      if (saved && saved.username === userLogin && saved.password === pass) {
        setUser(saved);
        setActiveTab('dashboard');
      } else {
        setRecoveryError('Usuario o PIN incorrectos');
        setTimeout(() => setRecoveryError(''), 3000);
        return;
      }
    } else {
      const newUser = {
        username: formData.get('username') || 'Usuario',
        fullName: formData.get('fullName') || 'Compañero/a',
        email: formData.get('email') || '',
        affiliate: formData.get('affiliate') || '',
        company: formData.get('company') || 'Supercor',
        store: formData.get('store') || 'Centro Local',
        rank: formData.get('rank') || 'Personal base',
        password: pass,
      };
      setUser(newUser);
      setIsRegistering(false);
      setActiveTab('dashboard');
    }
  };

  const handleRecovery = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const aff = formData.get('affiliate');
    const newPin = formData.get('newPin');
    const confirmPin = formData.get('confirmPin');
    const saved = JSON.parse(localStorage.getItem('mi_cuadrante_user'));

    if (!saved) {
      setRecoveryError('No hay datos en este dispositivo.');
    } else if (saved.affiliate !== aff) {
      setRecoveryError('El número de afiliado no coincide.');
    } else if (newPin.length !== 4) {
      setRecoveryError('El PIN debe ser de 4 dígitos.');
    } else if (newPin !== confirmPin) {
      setRecoveryError('Los PIN no coinciden.');
    } else {
      const updatedUser = { ...saved, password: newPin };
      localStorage.setItem('mi_cuadrante_user', JSON.stringify(updatedUser));
      setRecoveryError('¡Éxito! PIN actualizado.');
      setTimeout(() => {
        setShowForgotModal(false);
        setRecoveryError('');
      }, 2000);
    }
  };

  const iniciarJornada = () => {
    setWorkTimeAccumulated(0);
    setActiveShift({ startTime: Date.now() });
    setIsBreakActive(false);
  };

  const toggleDescanso = () => {
    if (!isBreakActive) {
      const sessionSeconds = Math.floor(
        (Date.now() - activeShift.startTime) / 1000
      );
      setWorkTimeAccumulated((prev) => prev + sessionSeconds);
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

  const finalizarJornada = () => {
    const minutosTrabajados = elapsed / 60;
    const esHA = minutosTrabajados >= CONFIG.UMBRAL_DIA_HA_MINUTOS;
    cerrarTurno(esHA);
  };

  const cerrarTurno = (esHA) => {
    const horasRealizadas = elapsed / 3600;
    const hoyStr = getFormattedDate(new Date());
    setShifts((prev) => {
      const filtered = prev.filter((s) => s.date !== hoyStr);
      return [
        ...filtered,
        {
          id: Date.now(),
          date: hoyStr,
          type: 'work',
          hours: horasRealizadas,
          isHA: esHA,
        },
      ];
    });
    setActiveShift(null);
    setWorkTimeAccumulated(0);
    setIsBreakActive(false);
    setShowBreakFinishedMsg(false);
  };

  const handleDayClick = (dateStr) => {
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter((d) => d !== dateStr));
    } else {
      setSelectedDates([...selectedDates, dateStr]);
    }
    setEditingDay(null);
  };

  const openEditHours = (dateStr) => {
    const s = shiftsMap[dateStr];
    const totalHoursDecimal = s?.type === 'work' ? s.hours : 0;
    const hh = Math.floor(totalHoursDecimal);
    const mm = Math.round((totalHoursDecimal - hh) * 60);
    setEditingDay(dateStr);
    setEditHH(hh > 0 ? hh.toString() : '6');
    setEditmm(mm > 0 ? mm.toString() : '45');
    setSelectedDates([]);
  };

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

  const saveEditedHours = () => {
    const hh = parseInt(editHH) || 0;
    const mm = parseInt(editmm) || 0;
    const hoursDecimal = hh + mm / 60;
    setShifts((prev) => {
      const filtered = prev.filter((s) => s.date !== editingDay);
      return [
        ...filtered,
        {
          id: Date.now(),
          date: editingDay,
          type: 'work',
          hours: hoursDecimal,
          isHA: hoursDecimal * 60 >= CONFIG.UMBRAL_DIA_HA_MINUTOS,
        },
      ];
    });
    setEditingDay(null);
  };

  const markMulti = (type) => {
    if (selectedDates.length === 0) return;
    setShifts((prev) => {
      const filtered = prev.filter((s) => !selectedDates.includes(s.date));
      const newEntries = selectedDates.map((date) => ({
        id: Math.random(),
        date: date,
        type: type,
        hours: 0,
        isHA: false,
      }));
      return [...filtered, ...newEntries];
    });
    setSelectedDates([]);
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}h ${m
      .toString()
      .padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatTotalTime = (decimalHours) => {
    const totalMinutes = Math.round(decimalHours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  };

  const isCurrentShiftHA = elapsed / 60 >= CONFIG.UMBRAL_DIA_HA_MINUTOS;

  if (!user) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 font-sans">
               {' '}
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-emerald-100 animate-in fade-in duration-700">
                   {' '}
          <div className="bg-emerald-600 p-10 text-center text-white">
                       {' '}
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                           {' '}
              <span className="text-emerald-600 font-black text-4xl italic">
                F
              </span>
                         {' '}
            </div>
                       {' '}
            <h1 className="text-2xl font-black tracking-tight uppercase italic">
              Mi Cuadrante
            </h1>
                       {' '}
            <p className="text-emerald-100 text-[10px] uppercase tracking-[0.3em] mt-1 font-bold">
              Convenio ANGED • Fetico
            </p>
                     {' '}
          </div>
                              {' '}
          <form onSubmit={handleAuth} className="p-8 space-y-4">
                       {' '}
            {recoveryError && !showForgotModal && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-center text-xs font-bold animate-pulse">
                                    {recoveryError}               {' '}
              </div>
            )}
                                    {' '}
            {isRegistering ? (
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-2 scrollbar-thin">
                               {' '}
                <InputGroup
                  label="Usuario"
                  name="username"
                  icon={<User size={16} />}
                />
                               {' '}
                <InputGroup
                  label="Nombre Completo"
                  name="fullName"
                  icon={<User size={16} />}
                />
                               {' '}
                <InputGroup
                  label="Nº Afiliado Fetico"
                  name="affiliate"
                  icon={<Award size={16} />}
                />
                               {' '}
                <InputGroup
                  label="Correo Electrónico"
                  name="email"
                  type="email"
                  icon={<Mail size={16} />}
                />
                               {' '}
                <div className="space-y-1">
                                   {' '}
                  <label className="text-[10px] font-black text-emerald-600 ml-1 uppercase tracking-tighter">
                    Empresa
                  </label>
                                   {' '}
                  <select
                    name="company"
                    className="w-full bg-slate-50 border-none p-3 rounded-2xl text-sm outline-none ring-1 ring-slate-200"
                  >
                                        <option>Supercor</option>               
                        <option>Supercor Expres</option>                   {' '}
                    <option>Sanchez Romero</option>                 {' '}
                  </select>
                                 {' '}
                </div>
                               {' '}
                <InputGroup
                  label="Tienda / Centro"
                  name="store"
                  icon={<Store size={16} />}
                />
                               {' '}
                <div className="space-y-1">
                                   {' '}
                  <label className="text-[10px] font-black text-emerald-600 ml-1 uppercase tracking-tighter">
                    Rango Profesional
                  </label>
                                   {' '}
                  <select
                    name="rank"
                    className="w-full bg-slate-50 border-none p-3 rounded-2xl text-sm outline-none ring-1 ring-slate-200"
                  >
                                        <option>Personal base</option>         
                              <option>Profesionales</option>                   {' '}
                    <option>Coordinadores</option>                   {' '}
                    <option>Técnicos</option>                 {' '}
                  </select>
                                 {' '}
                </div>
                               {' '}
                <InputGroup
                  label="PIN (4 dígitos)"
                  name="password"
                  type="password"
                  maxLength={4}
                  center
                  icon={<Lock size={16} />}
                />
                             {' '}
              </div>
            ) : (
              <div className="space-y-4">
                               {' '}
                <InputGroup
                  label="Usuario"
                  name="username"
                  icon={<User size={18} />}
                />
                               {' '}
                <InputGroup
                  label="PIN"
                  name="password"
                  type="password"
                  maxLength={4}
                  center
                  icon={<Lock size={18} />}
                />
                               {' '}
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="w-full text-center text-[10px] font-black text-slate-400 uppercase tracking-tighter hover:text-emerald-600 transition-colors"
                >
                                      ¿Has olvidado tu contraseña o usuario?    
                             {' '}
                </button>
                             {' '}
              </div>
            )}
                                    {' '}
            <button
              type="submit"
              className="w-full bg-emerald-600 text-white font-black py-4 rounded-[1.5rem] shadow-lg uppercase tracking-widest text-sm active:scale-95 transition-all"
            >
                            {isRegistering ? 'CREAR CUENTA' : 'ENTRAR'}         
               {' '}
            </button>
                       {' '}
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="w-full text-center text-[11px] font-black text-emerald-700 mt-2 uppercase tracking-tighter"
            >
                           {' '}
              {isRegistering
                ? '¿Ya tienes cuenta? Inicia sesión'
                : '¿Eres nuevo? Regístrate aquí'}
                         {' '}
            </button>
                     {' '}
          </form>
                 {' '}
        </div>
               {' '}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                       {' '}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl w-full max-w-sm border border-emerald-50 relative animate-in zoom-in-95">
                             {' '}
              <button
                onClick={() => {
                  setShowForgotModal(false);
                  setRecoveryError('');
                }}
                className="absolute top-6 right-6 text-slate-300 hover:text-slate-600"
              >
                                    <X size={24} />               {' '}
              </button>
                             {' '}
              <div className="text-emerald-600 flex justify-center mb-4">
                <KeyRound size={48} />
              </div>
                             {' '}
              <h3 className="text-xl font-black text-center text-slate-800 mb-2 italic uppercase">
                Recuperar PIN
              </h3>
                             {' '}
              <p className="text-center text-slate-500 text-xs mb-6">
                Introduce tu número de afiliado para cambiar el PIN.
              </p>
                                              {' '}
              <form onSubmit={handleRecovery} className="space-y-4">
                                   {' '}
                <InputGroup
                  label="Nº Afiliado Fetico"
                  name="affiliate"
                  icon={<Award size={16} />}
                />
                                   {' '}
                <InputGroup
                  label="Nuevo PIN"
                  name="newPin"
                  type="password"
                  maxLength={4}
                  center
                  icon={<Lock size={16} />}
                />
                                   {' '}
                <InputGroup
                  label="Confirmar PIN"
                  name="confirmPin"
                  type="password"
                  maxLength={4}
                  center
                  icon={<ShieldCheck size={16} />}
                />
                                                        {' '}
                {recoveryError && (
                  <div
                    className={`p-3 rounded-xl text-center text-[10px] font-bold ${
                      recoveryError.includes('Éxito')
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                                                {recoveryError}                 
                         {' '}
                  </div>
                )}
                                                        {' '}
                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest text-xs active:scale-95 transition-all"
                >
                                          CAMBIAR PIN                    {' '}
                </button>
                               {' '}
              </form>
                         {' '}
            </div>
                     {' '}
          </div>
        )}
             {' '}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center font-sans">
           {' '}
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl flex flex-col relative overflow-hidden">
                        {' '}
        {showConfirmLogout && (
          <Modal close={() => setShowConfirmLogout(false)}>
                       {' '}
            <h3 className="text-xl font-black text-center text-slate-800 mb-2 italic uppercase">
              Cerrar Sesión
            </h3>
                       {' '}
            <p className="text-center text-slate-500 text-sm mb-8">
              ¿Deseas salir de la aplicación?
            </p>
                       {' '}
            <div className="flex gap-3">
                           {' '}
              <button
                onClick={() => setUser(null)}
                className="flex-1 bg-rose-500 text-white font-black py-4 rounded-2xl active:scale-95"
              >
                SALIR
              </button>
                           {' '}
              <button
                onClick={() => setShowConfirmLogout(false)}
                className="flex-1 bg-slate-100 text-slate-500 font-bold py-4 rounded-2xl"
              >
                CANCELAR
              </button>
                         {' '}
            </div>
                     {' '}
          </Modal>
        )}
               {' '}
        <header className="bg-emerald-600 text-white p-6 rounded-b-[2.5rem] shadow-xl relative z-10">
                   {' '}
          <div className="flex justify-between items-start">
                       {' '}
            <div>
                           {' '}
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                ANGED • Fetico
              </p>
                           {' '}
              <h1 className="font-black text-2xl tracking-tight italic">
                Hola, {user.username}
              </h1>
                           {' '}
              <div className="flex items-center gap-1.5 mt-1 bg-emerald-700/50 px-3 py-1 rounded-full w-fit">
                                <Store size={12} />               {' '}
                <span className="text-[9px] uppercase font-black tracking-widest">
                  {user.company} • {user.store}
                </span>
                             {' '}
              </div>
                         {' '}
            </div>
                       {' '}
            <button
              onClick={() => setShowConfirmLogout(true)}
              className="bg-white/10 p-3 rounded-2xl"
            >
              <LogOut size={20} />
            </button>
                     {' '}
          </div>
                 {' '}
        </header>
               {' '}
        <main className="flex-1 overflow-y-auto p-6 space-y-8 pb-24">
                              {' '}
          {activeTab === 'track' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                           {' '}
              <div className="text-center pt-4">
                               {' '}
                <div
                  className={`text-5xl font-black tracking-tighter mb-1 font-mono transition-all ${
                    isBreakActive
                      ? 'text-slate-300'
                      : isCurrentShiftHA
                      ? 'text-blue-600'
                      : 'text-slate-800'
                  }`}
                >
                                    {formatTime(elapsed)}               {' '}
                </div>
                               {' '}
                <div className="flex items-center justify-center gap-2">
                                   {' '}
                  <div
                    className={`size-2 rounded-full ${
                      activeShift
                        ? (isCurrentShiftHA
                            ? 'bg-blue-500'
                            : 'bg-emerald-500') + ' animate-pulse'
                        : 'bg-slate-300'
                    }`}
                  ></div>
                                   {' '}
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest ${
                      isCurrentShiftHA ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  >
                                       {' '}
                    {activeShift
                      ? isBreakActive
                        ? 'Jornada en Pausa'
                        : isCurrentShiftHA
                        ? 'DÍA HA COMPLETADO'
                        : 'Trabajando...'
                      : 'Reloj parado'}
                                     {' '}
                  </span>
                                 {' '}
                </div>
                             {' '}
              </div>
                           {' '}
              <div className="flex flex-col items-center justify-center">
                               {' '}
                <button
                  onClick={activeShift ? finalizarJornada : iniciarJornada}
                  className={`w-64 h-64 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all transform active:scale-95 relative group`}
                >
                                   {' '}
                  <div
                    className={`absolute inset-0 rounded-full opacity-20 group-hover:scale-110 transition-transform ${
                      activeShift ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                  ></div>
                                   {' '}
                  <div
                    className={`w-56 h-56 rounded-full flex flex-col items-center justify-center shadow-inner ${
                      activeShift ? 'bg-rose-500' : 'bg-emerald-600'
                    }`}
                  >
                                       {' '}
                    {activeShift ? (
                      <>
                        <Square
                          size={60}
                          className="text-white fill-white mb-2"
                        />
                        <span className="font-black text-xl italic uppercase text-white text-center">
                          FINALIZAR
                          <br />
                          <span className="text-[10px] normal-case opacity-70">
                            Jornada
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <Play
                          size={60}
                          className="text-white fill-white mb-2 ml-2"
                        />
                        <span className="font-black text-xl italic uppercase text-white">
                          INICIAR
                        </span>
                      </>
                    )}
                                     {' '}
                  </div>
                                 {' '}
                </button>
                             {' '}
              </div>
                           {' '}
              {activeShift && (
                <div className="bg-emerald-50 rounded-[2rem] p-6 border border-emerald-100 animate-in zoom-in-95 space-y-4">
                                   {' '}
                  {isBreakActive && (
                    <div className="flex flex-col items-center animate-pulse py-2">
                                           {' '}
                      <div className="text-emerald-600 font-black text-4xl mb-1">
                        {formatCountdown(breakTimeLeft)}
                      </div>
                                           {' '}
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                        Descanso en curso
                      </p>
                                         {' '}
                    </div>
                  )}
                                                      {' '}
                  <button
                    onClick={toggleDescanso}
                    className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                      isBreakActive
                        ? 'bg-slate-800 text-white'
                        : 'bg-emerald-200 text-emerald-800'
                    }`}
                  >
                                       {' '}
                    {isBreakActive ? (
                      <>
                        <Timer size={18} /> Reanudar Jornada
                      </>
                    ) : (
                      <>
                        <Coffee size={18} /> Iniciar Descanso{' '}
                        {settings.breakDuration}m
                      </>
                    )}
                                     {' '}
                  </button>
                                   {' '}
                  {showBreakFinishedMsg && isBreakActive && (
                    <div className="mt-2 bg-rose-500 text-white p-3 rounded-xl flex items-center gap-3 animate-bounce justify-center text-[10px] font-black uppercase italic">
                                            <BellRing size={16} /> ¡Tiempo
                      agotado! Reincorpora tu jornada                    {' '}
                    </div>
                  )}
                                 {' '}
                </div>
              )}
                         {' '}
            </div>
          )}
                   {' '}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                           {' '}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                               {' '}
                <h2 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2 uppercase italic tracking-widest border-b pb-3">
                                   {' '}
                  <PieChart className="text-emerald-600" size={18} /> Mi Cómputo
                  ANGED                {' '}
                </h2>
                               {' '}
                <div className="space-y-8">
                                   {' '}
                  <StatBar
                    label="Horas Anuales"
                    currentValue={formatTotalTime(stats.horasTotales)}
                    percentage={
                      (stats.horasTotales / CONFIG.LIMITE_ANUAL_HORAS) * 100
                    }
                    totalValue={`${CONFIG.LIMITE_ANUAL_HORAS}h`}
                    color="bg-pink-300"
                  />
                                   {' '}
                  <StatBar
                    label="Días Alta Actividad (HA)"
                    currentValue={stats.contadorHA}
                    percentage={(stats.contadorHA / CONFIG.MAX_DIAS_HA) * 100}
                    totalValue={CONFIG.MAX_DIAS_HA}
                    color="bg-blue-600"
                  />
                                   {' '}
                  <StatBar
                    label="Fines de Semana Calidad"
                    currentValue={stats.findesCalidad}
                    percentage={
                      (stats.findesCalidad / CONFIG.MAX_FINES_CALIDAD) * 100
                    }
                    totalValue={CONFIG.MAX_FINES_CALIDAD}
                    color="bg-green-500"
                  />
                                 {' '}
                </div>
                             {' '}
              </div>
                           {' '}
              <div className="space-y-4">
                               {' '}
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                  Últimas Noticias Fetico
                </h3>
                               {' '}
                {MOCK_NEWS.map((news) => (
                  <div
                    key={news.id}
                    className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-4 items-center active:scale-95 transition-all"
                  >
                                       {' '}
                    <div className="bg-emerald-100 text-emerald-700 p-3 rounded-xl">
                                            <Newspaper size={20} />             
                           {' '}
                    </div>
                                       {' '}
                    <div className="flex-1">
                                           {' '}
                      <div className="flex justify-between items-start">
                                               {' '}
                        <span className="text-[8px] font-black text-emerald-600 uppercase mb-1">
                          {news.tag}
                        </span>
                                               {' '}
                        <span className="text-[8px] text-slate-400">
                          {news.date}
                        </span>
                                             {' '}
                      </div>
                                           {' '}
                      <h4 className="text-xs font-bold text-slate-800 leading-tight">
                        {news.title}
                      </h4>
                                         {' '}
                    </div>
                                     {' '}
                  </div>
                ))}
                             {' '}
              </div>
                         {' '}
            </div>
          )}
                   {' '}
          {activeTab === 'calendar' && (
            <div className="animate-in fade-in duration-300 space-y-4">
                           {' '}
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                               {' '}
                <div className="p-5 bg-slate-50 flex justify-between items-center border-b">
                                   {' '}
                  <button
                    onClick={() =>
                      setCurrentDate(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth() - 1,
                          1
                        )
                      )
                    }
                    className="p-2"
                  >
                    <ChevronLeft size={20} className="text-emerald-700" />
                  </button>
                                   {' '}
                  <span className="font-black text-xs uppercase italic tracking-widest">
                    {currentDate.toLocaleDateString('es-ES', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                                   {' '}
                  <button
                    onClick={() =>
                      setCurrentDate(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth() + 1,
                          1
                        )
                      )
                    }
                    className="p-2"
                  >
                    <ChevronRight size={20} className="text-emerald-700" />
                  </button>
                                 {' '}
                </div>
                               {' '}
                <div className="p-5">
                                   {' '}
                  <div className="grid grid-cols-7 gap-2">
                                       {' '}
                    {(() => {
                      const days = [];
                      const year = currentDate.getFullYear();
                      const month = currentDate.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(
                        year,
                        month + 1,
                        0
                      ).getDate();
                      const startOffset = firstDay === 0 ? 6 : firstDay - 1;

                      for (let i = 0; i < startOffset; i++)
                        days.push(<div key={`e-${i}`} className="h-10"></div>);

                      for (let d = 1; d <= daysInMonth; d++) {
                        const dStr = getFormattedDate(new Date(year, month, d));
                        const currentD = new Date(year, month, d);
                        const dayOfWeek = currentD.getDay(); // 0=Sun, 6=Sat
                        const s = shiftsMap[dStr];
                        const isSelected = selectedDates.includes(dStr);
                        const isEditing = editingDay === dStr;
                        let isQuality = false;
                        if (dayOfWeek === 6 || dayOfWeek === 0) {
                          let satDateStr, sunDateStr;
                          if (dayOfWeek === 6) {
                            satDateStr = dStr;
                            const nextDay = new Date(year, month, d + 1);
                            sunDateStr = getFormattedDate(nextDay);
                          } else {
                            sunDateStr = dStr;
                            const prevDay = new Date(year, month, d - 1);
                            satDateStr = getFormattedDate(prevDay);
                          }
                          const satS = shiftsMap[satDateStr];
                          const sunS = shiftsMap[sunDateStr];
                          const satIsRest = satS && satS.type === 'rest';
                          const sunIsRest = sunS && sunS.type === 'rest';
                          if (satIsRest && sunIsRest) isQuality = true;
                        }

                        let style = 'bg-slate-50 text-slate-400';
                        let label = '';

                        if (s?.type === 'work') {
                          style = s.isHA
                            ? 'bg-blue-600 text-white font-black'
                            : 'bg-pink-200 text-pink-900 font-black';
                          label = `${Math.floor(s.hours)}h ${Math.round(
                            (s.hours % 1) * 60
                          )}m`;
                        } else if (s?.type === 'vacation') {
                          style =
                            'bg-purple-200 text-purple-800 font-bold border border-purple-300';
                          label = 'Vacas';
                        } else if (isQuality) {
                          style = 'bg-green-500 text-white font-black';
                          label = 'Calidad';
                        } else if (s?.type === 'rest') {
                          style = 'bg-amber-500 text-white font-black';
                          label = 'Libre';
                        }
                        if (isSelected)
                          style =
                            'ring-4 ring-emerald-300 bg-white text-emerald-700 scale-110 z-10';
                        if (isEditing)
                          style =
                            'ring-4 ring-rose-300 bg-white text-rose-700 scale-110 z-10';

                        days.push(
                          <div
                            key={d}
                            onClick={() => handleDayClick(dStr)}
                            onDoubleClick={() => openEditHours(dStr)}
                            className={`h-11 w-full flex flex-col items-center justify-center text-[10px] rounded-xl transition-all cursor-pointer relative shadow-sm ${style}`}
                          >
                                                        {d}                     
                                 {' '}
                            {label && (
                              <span className="text-[7px] absolute bottom-0.5 opacity-90 uppercase tracking-tighter font-bold">
                                {label}
                              </span>
                            )}
                                                       {' '}
                            {s?.isHA && (
                              <Zap
                                size={8}
                                className="absolute top-1 right-1 text-white/50"
                                fill="currentColor"
                              />
                            )}
                                                     {' '}
                          </div>
                        );
                      }
                      return days;
                    })()}
                                     {' '}
                  </div>
                                 {' '}
                </div>
                             {' '}
              </div>
                           {' '}
              {selectedDates.length > 0 && !editingDay && (
                <div className="bg-slate-900 rounded-3xl p-5 text-white flex flex-col gap-4 animate-in slide-in-from-bottom-8 fixed bottom-24 left-6 right-6 z-40 shadow-2xl border border-white/10">
                                   {' '}
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                        <span>{selectedDates.length} Días</span>
                                       {' '}
                    <button onClick={() => setSelectedDates([])}>
                      <X size={16} />
                    </button>
                                     {' '}
                  </div>
                                   {' '}
                  <div className="grid grid-cols-3 gap-2">
                                       {' '}
                    <ActionButton
                      onClick={() => markMulti('vacation')}
                      color="bg-purple-500"
                      icon={<Sun size={14} />}
                      label="Vacas"
                    />
                                       {' '}
                    <ActionButton
                      onClick={() => markMulti('rest')}
                      color="bg-amber-500"
                      icon={<CalendarDays size={14} />}
                      label="Libre"
                    />
                                       {' '}
                    {selectedDates.length === 1 && (
                      <ActionButton
                        onClick={() => openEditHours(selectedDates[0])}
                        color="bg-blue-600"
                        icon={<Edit2 size={14} />}
                        label="Horas"
                      />
                    )}
                                     {' '}
                  </div>
                                 {' '}
                </div>
              )}
                           {' '}
              {editingDay && (
                <div className="bg-white rounded-[2rem] p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95">
                                   {' '}
                  <div className="flex justify-between items-center mb-4 text-xs font-black italic">
                                       {' '}
                    <span className="text-rose-600 uppercase">
                      Ajuste Manual
                    </span>
                                       {' '}
                    <button onClick={() => setEditingDay(null)}>
                      <X size={18} className="text-slate-400" />
                    </button>
                                     {' '}
                  </div>
                                   {' '}
                  <div className="flex items-center justify-center gap-4 mb-6">
                                       {' '}
                    <div className="flex flex-col items-center gap-1">
                                           {' '}
                      <span className="text-[8px] font-black text-slate-400 uppercase">
                        H
                      </span>
                                           {' '}
                      <input
                        type="number"
                        value={editHH}
                        onChange={(e) => setEditHH(e.target.value)}
                        className="w-16 bg-slate-100 p-3 rounded-2xl text-xl font-black text-center outline-none text-slate-800"
                      />
                                         {' '}
                    </div>
                                       {' '}
                    <span className="text-2xl font-black text-slate-300 mt-5">
                      :
                    </span>
                                       {' '}
                    <div className="flex flex-col items-center gap-1">
                                           {' '}
                      <span className="text-[8px] font-black text-slate-400 uppercase">
                        m
                      </span>
                                           {' '}
                      <input
                        type="number"
                        value={editmm}
                        onChange={(e) => handleMinutesChange(e.target.value)}
                        className="w-16 bg-slate-100 p-3 rounded-2xl text-xl font-black text-center outline-none text-slate-800"
                      />
                                         {' '}
                    </div>
                                     {' '}
                  </div>
                                   {' '}
                  <button
                    onClick={saveEditedHours}
                    className="w-full bg-rose-500 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95"
                  >
                                        <Check size={18} /> GUARDAR            
                         {' '}
                  </button>
                                 {' '}
                </div>
              )}
                         {' '}
            </div>
          )}
                   {' '}
          {activeTab === 'support' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
                            {/* BLOQUE OSCAR */}             {' '}
              <div className="bg-white rounded-[2.5rem] p-8 text-center shadow-2xl border border-emerald-50 relative">
                               {' '}
                <div className="w-28 h-28 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 transform rotate-6 border-4 border-white shadow-xl overflow-hidden">
                                   {' '}
                  <User className="text-emerald-700 size-16" />               {' '}
                </div>
                               {' '}
                <h2 className="text-2xl font-black text-slate-800 italic uppercase leading-none">
                  Oscar
                </h2>
                               {' '}
                <p className="text-emerald-600 font-black text-[10px] uppercase tracking-[0.2em] mb-8 mt-1">
                  Delegado Fetico Expansión ANGED
                </p>
                               {' '}
                <a
                  href={`https://wa.me/34600000000?text=${encodeURIComponent(
                    `Hola Oscar, soy ${user.fullName} de la tienda ${user.store}...`
                  )}`}
                  className="w-full bg-[#25D366] text-white py-5 rounded-2xl font-black text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all uppercase tracking-widest"
                >
                                    <MessageCircle fill="white" size={20} />{' '}
                  Contactar WhatsApp                {' '}
                </a>
                             {' '}
              </div>
                            {/* BLOQUE AJUSTES */}             {' '}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                               {' '}
                <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2 uppercase italic tracking-widest border-b pb-3">
                                   {' '}
                  <Settings className="text-slate-400" size={18} /> Ajustes de
                  App                {' '}
                </h3>
                                                {' '}
                <div className="space-y-6">
                                    {/* Toggle Notificaciones */}               
                   {' '}
                  <div className="flex justify-between items-center">
                                       {' '}
                    <div className="flex items-center gap-3">
                                           {' '}
                      <div
                        className={`p-2 rounded-xl ${
                          settings.notifications
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-slate-50 text-slate-400'
                        }`}
                      >
                                               {' '}
                        {settings.notifications ? (
                          <Bell size={18} />
                        ) : (
                          <BellOff size={18} />
                        )}
                                             {' '}
                      </div>
                                           {' '}
                      <span className="text-[11px] font-black text-slate-600 uppercase">
                        Notificaciones
                      </span>
                                         {' '}
                    </div>
                                       {' '}
                    <button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          notifications: !prev.notifications,
                        }))
                      }
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.notifications
                          ? 'bg-emerald-500'
                          : 'bg-slate-200'
                      }`}
                    >
                                             {' '}
                      <div
                        className={`absolute top-1 size-4 bg-white rounded-full transition-all ${
                          settings.notifications ? 'left-7' : 'left-1'
                        }`}
                      ></div>
                                         {' '}
                    </button>
                                     {' '}
                  </div>
                                    {/* Cambio tiempo descanso */}             
                     {' '}
                  <div className="space-y-3">
                                       {' '}
                    <div className="flex items-center gap-3">
                                           {' '}
                      <div className="p-2 rounded-xl bg-slate-50 text-slate-400">
                                                <Timer size={18} />             
                               {' '}
                      </div>
                                           {' '}
                      <span className="text-[11px] font-black text-slate-600 uppercase">
                        Minutos de descanso
                      </span>
                                         {' '}
                    </div>
                                       {' '}
                    <div className="flex flex-wrap gap-2">
                                             {' '}
                      {[15, 20, 30, 45, 60].map((min) => (
                        <button
                          key={min}
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              breakDuration: min,
                            }))
                          }
                          className={`flex-1 min-w-[50px] py-3 rounded-xl text-[10px] font-black transition-all ${
                            settings.breakDuration === min
                              ? 'bg-slate-800 text-white scale-105 shadow-md'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                                                          {min}m                
                                     {' '}
                        </button>
                      ))}
                                         {' '}
                    </div>
                                     {' '}
                  </div>
                                 {' '}
                </div>
                             {' '}
              </div>
                         {' '}
            </div>
          )}
                 {' '}
        </main>
               {' '}
        <nav className="fixed bottom-0 max-w-md w-full bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-around p-4 pb-8 z-50">
                   {' '}
          <NavItem
            icon={<PieChart />}
            label="Resumen"
            isActive={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          />
                   {' '}
          <NavItem
            icon={<Clock />}
            label="Fichar"
            isActive={activeTab === 'track'}
            onClick={() => setActiveTab('track')}
          />
                   {' '}
          <NavItem
            icon={<CalendarIcon />}
            label="Agenda"
            isActive={activeTab === 'calendar'}
            onClick={() => setActiveTab('calendar')}
          />
                   {' '}
          <NavItem
            icon={<MessageCircle />}
            label="Ayuda"
            isActive={activeTab === 'support'}
            onClick={() => setActiveTab('support')}
          />
                 {' '}
        </nav>
             {' '}
      </div>
         {' '}
    </div>
  );
}

// --- COMPONENTES AUXILIARES ---

function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
        isActive ? 'text-emerald-700 -translate-y-1' : 'text-slate-300'
      }`}
    >
           {' '}
      <div
        className={`p-2 rounded-2xl transition-all ${
          isActive ? 'bg-emerald-50 shadow-inner' : ''
        }`}
      >
               {' '}
        {React.cloneElement(icon, { size: 22, strokeWidth: isActive ? 3 : 2 })} 
           {' '}
      </div>
           {' '}
      <span className="text-[9px] font-black uppercase tracking-tighter leading-none">
        {label}
      </span>
         {' '}
    </button>
  );
}

function StatBar({
  label,
  currentValue,
  totalValue,
  percentage,
  color = 'bg-emerald-500',
}) {
  return (
    <div>
           {' '}
      <div className="flex justify-between text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest">
                <span>{label}</span>       {' '}
        <span className="text-slate-800">
          {currentValue} / {totalValue}
        </span>
             {' '}
      </div>
           {' '}
      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
               {' '}
        <div
          className={`${color} h-full transition-all duration-1000 shadow-sm`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
             {' '}
      </div>
         {' '}
    </div>
  );
}

function Modal({ children, close }) {
  return (
    <div className="absolute inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
           {' '}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl w-full border border-emerald-50">
        {children}
      </div>
         {' '}
    </div>
  );
}

function ActionButton({ onClick, color, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`${color} text-white py-3 rounded-xl text-[9px] font-black uppercase flex flex-col items-center gap-1 shadow-md active:scale-95 transition-all`}
    >
            {icon} {label}   {' '}
    </button>
  );
}

function InputGroup({
  label,
  name,
  icon,
  type = 'text',
  maxLength,
  center = false,
}) {
  return (
    <div className="space-y-1">
           {' '}
      <label className="text-[10px] font-black text-emerald-600 ml-1 uppercase tracking-tighter">
        {label}
      </label>
           {' '}
      <div className="relative group">
               {' '}
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
            {icon}
          </div>
        )}
               {' '}
        <input
          name={name}
          type={type}
          maxLength={maxLength}
          required
          className={`w-full ${
            icon ? 'pl-11' : 'px-4'
          } bg-slate-50 border-none p-3.5 rounded-2xl text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all ${
            center ? 'text-center tracking-widest font-black' : ''
          }`}
        />
             {' '}
      </div>
         {' '}
    </div>
  );
}
