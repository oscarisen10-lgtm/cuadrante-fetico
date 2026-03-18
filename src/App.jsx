import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from './firebase'; 
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { 
  Clock, Calendar as CalendarIcon, PieChart, MessageCircle, Play, Square, 
  Coffee, User, Lock, LogOut, ChevronLeft, ChevronRight, Timer, X, Newspaper, Settings
} from 'lucide-react';

// --- CONFIGURACIÓN ANGED ---
const CONFIG = {
  MAX_DIAS_HA: 15,
  LIMITE_ANUAL_HORAS: 1770,
  MAX_FINES_CALIDAD: 10,
  UMBRAL_DIA_HA_MINUTOS: 510,
  COLORES: { FETICO_GREEN: '#059669', FETICO_LIGHT: '#ecfdf5' }
};

const getFormattedDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [activeTab, setActiveTab] = useState('dashboard');
  const [shifts, setShifts] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- LÓGICA DE NUBE ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUser({ ...docSnap.data(), uid: firebaseUser.uid });
            setShifts(docSnap.data().shifts || []);
          }
        });
        return () => unsubDoc();
      } else {
        setUser(null);
        setShifts([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const syncToCloud = async (newShifts) => {
    if (auth.currentUser) {
      await setDoc(doc(db, "users", auth.currentUser.uid), { shifts: newShifts }, { merge: true });
    }
  };

  // --- LÓGICA DE TIEMPO ---
  useEffect(() => {
    let interval;
    if (activeShift) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - activeShift.startTime) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeShift]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    // Validación rápida
    if (password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      if (isRegistering) {
        // CREAR CUENTA
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", res.user.uid), {
          username: formData.get('username'),
          store: formData.get('store'),
          company: formData.get('company'),
          shifts: []
        });
        alert("¡Cuenta creada con éxito!");
      } else {
        // ENTRAR
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message); // Esto nos dirá qué está fallando exactamente
    }
  };

  const cerrarTurno = (esHA) => {
    const hoyStr = getFormattedDate(new Date());
    const hoursDecimal = elapsed / 3600;
    const newShift = { id: Date.now(), date: hoyStr, type: 'work', hours: hoursDecimal, isHA: esHA };
    const updatedShifts = [...shifts.filter(s => s.date !== hoyStr), newShift];
    setShifts(updatedShifts);
    syncToCloud(updatedShifts);
    setActiveShift(null);
  };

  // --- CÁLCULOS ANGED ---
  const stats = useMemo(() => {
    let horasTotales = 0;
    let contadorHA = 0;
    shifts.forEach(s => {
      if (s.type === 'work') {
        horasTotales += s.hours;
        if (s.isHA) contadorHA++;
      }
    });
    return { horasTotales, contadorHA };
  }, [shifts]);

  if (loading) return <div className="h-screen flex items-center justify-center text-emerald-600 font-bold">Conectando...</div>;

  if (!user) {
    return (
      <div className="h-[100dvh] bg-emerald-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-xl overflow-hidden border border-emerald-100">
          <div className="bg-emerald-600 p-6 text-center text-white">
            <h1 className="text-xl font-black italic uppercase">Mi Cuadrante</h1>
            <p className="text-emerald-100 text-[10px] uppercase font-bold tracking-widest">Fetico • Expansión</p>
          </div>
          <form onSubmit={handleAuth} className="p-6 space-y-4">
            <input name="email" type="email" placeholder="Email" required className="w-full p-3 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 outline-none focus:ring-emerald-500 text-sm" />
            {isRegistering && (
              <>
                <input name="username" placeholder="Nombre" required className="w-full p-3 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 outline-none text-sm" />
                <input name="store" placeholder="Centro (Ej: Supercor Majadahonda)" required className="w-full p-3 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 outline-none text-sm" />
                <select name="company" className="w-full p-3 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 text-sm"><option>Supercor</option><option>Sánchez Romero</option></select>
              </>
            )}
            <input name="password" type="password" placeholder="PIN / Contraseña (mín. 6)" required className="w-full p-3 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 outline-none text-sm" />
            <button type="submit" className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl uppercase text-sm shadow-md">{isRegistering ? 'Registrar' : 'Entrar'}</button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-center text-[10px] font-bold text-emerald-700 uppercase tracking-widest">{isRegistering ? 'Tengo cuenta' : 'Crear cuenta nueva'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex justify-center font-sans overflow-hidden">
      <div className="w-full max-w-md bg-white h-full flex flex-col relative overflow-hidden shadow-2xl">
        
        <header className="bg-emerald-600 text-white p-4 rounded-b-[2rem] shadow-lg shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="font-black text-lg italic leading-tight">Hola, {user.username}</h1>
              <span className="text-[9px] uppercase font-bold opacity-80">{user.store} • {user.company}</span>
            </div>
            <button onClick={() => signOut(auth)} className="bg-white/20 p-2 rounded-xl"><LogOut size={18} /></button>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-y-auto pb-24">
          {activeTab === 'dashboard' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <StatBar label="Horas Anuales" value={`${Math.round(stats.horasTotales)}h`} total="1770h" percentage={(stats.horasTotales/1770)*100} color="bg-pink-300" />
                <StatBar label="Días HA" value={stats.contadorHA} total="15" percentage={(stats.contadorHA/15)*100} color="bg-blue-600" />
              </div>
              <div className="bg-slate-900 p-5 rounded-3xl text-white">
                <h3 className="text-[10px] font-black uppercase text-emerald-400 mb-3 tracking-widest">Noticias Fetico</h3>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <h4 className="text-xs font-black uppercase mb-1">Nuevo acuerdo ANGED</h4>
                  <p className="text-[10px] text-white/60">Actualización sobre calendarios de domingos en Supercor.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'track' && (
            <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in zoom-in">
              <div className="text-5xl font-black text-slate-800 font-mono">
                {new Date(elapsed * 1000).toISOString().substr(11, 8)}
              </div>
              <button 
                onClick={() => activeShift ? cerrarTurno((elapsed/3600) >= 8.5) : setActiveShift({startTime: Date.now()})}
                className={`w-32 h-32 rounded-full flex flex-col items-center justify-center shadow-xl transition-all active:scale-95 border-[6px] ${activeShift ? 'bg-rose-500 border-rose-100' : 'bg-emerald-600 border-emerald-100'}`}
              >
                {activeShift ? <Square size={24} className="text-white fill-white"/> : <Play size={24} className="text-white fill-white ml-1"/>}
                <span className="text-white font-black text-[9px] mt-1.5 uppercase">{activeShift ? 'Cerrar' : 'Entrar'}</span>
              </button>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 text-center">
                <p className="text-xs font-black text-slate-400 uppercase italic">Tu agenda de {currentDate.toLocaleDateString('es-ES', {month:'long'})}</p>
                <div className="grid grid-cols-7 gap-1 mt-4">
                  {/* Aquí iría el dibujo de los días - simplificado para el ejemplo */}
                  <p className="col-span-7 text-[10px] text-slate-300">Calendario sincronizado en la nube de Fetico</p>
                </div>
              </div>
            </div>
          )}
        </main>

        <nav className="h-20 bg-white border-t border-slate-100 flex justify-around items-center px-6 fixed bottom-0 max-w-md w-full pb-4">
           <NavItem icon={<PieChart />} label="Resumen" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
           <NavItem icon={<Clock />} label="Fichar" active={activeTab === 'track'} onClick={() => setActiveTab('track')} />
           <NavItem icon={<CalendarIcon />} label="Agenda" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
           <NavItem icon={<MessageCircle />} label="Ayuda" active={activeTab === 'support'} onClick={() => setActiveTab('support')} />
        </nav>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center ${active ? 'text-emerald-700 font-black' : 'text-slate-300'}`}>
      {React.cloneElement(icon, { size: 20 })}
      <span className="text-[8px] uppercase mt-1 tracking-tighter">{label}</span>
    </button>
  );
}

function StatBar({ label, value, total, percentage, color }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-black uppercase italic text-slate-500">
        <span>{label}</span>
        <span className="text-slate-900">{value} / {total}</span>
      </div>
      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-50">
        <div className={`${color} h-full transition-all duration-1000`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
      </div>
    </div>
  );
}