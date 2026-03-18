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
  Coffee, User, Lock, LogOut, ChevronLeft, ChevronRight, Timer, X
} from 'lucide-react';

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

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    try {
      if (isRegistering) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", res.user.uid), {
          username: formData.get('username'),
          store: formData.get('store'),
          company: formData.get('company'),
          shifts: []
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) { setAuthError("Error en los datos"); }
  };

  const cerrarTurno = (esHA) => {
    const hoyStr = getFormattedDate(new Date());
    const newShift = { id: Date.now(), date: hoyStr, type: 'work', hours: 8, isHA: esHA };
    const updatedShifts = [...shifts.filter(s => s.date !== hoyStr), newShift];
    setShifts(updatedShifts);
    syncToCloud(updatedShifts);
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-emerald-600 font-bold">Conectando...</div>;

  if (!user) {
    return (
      <div className="h-[100dvh] bg-emerald-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-xl overflow-hidden">
          <div className="bg-emerald-600 p-6 text-center text-white">
            <h1 className="text-xl font-black italic">MI CUADRANTE</h1>
            <p className="text-[10px] font-bold opacity-80 uppercase">Fetico ANGED</p>
          </div>
          <form onSubmit={handleAuth} className="p-6 space-y-4">
            <input name="email" type="email" placeholder="Email" required className="w-full p-3 bg-slate-50 rounded-xl ring-1 ring-slate-200 outline-none focus:ring-emerald-500" />
            {isRegistering && (
              <>
                <input name="username" placeholder="Tu Nombre" required className="w-full p-3 bg-slate-50 rounded-xl ring-1 ring-slate-200 outline-none" />
                <input name="store" placeholder="Tienda (Ej: Majadahonda)" required className="w-full p-3 bg-slate-50 rounded-xl ring-1 ring-slate-200 outline-none" />
                <select name="company" className="w-full p-3 bg-slate-50 rounded-xl ring-1 ring-slate-200"><option>Supercor</option><option>Sánchez Romero</option></select>
              </>
            )}
            <input name="password" type="password" placeholder="Contraseña (mín. 6)" required className="w-full p-3 bg-slate-50 rounded-xl ring-1 ring-slate-200 outline-none" />
            <button type="submit" className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl uppercase">{isRegistering ? 'Registrar' : 'Entrar'}</button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-[10px] font-bold text-emerald-700 uppercase">{isRegistering ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col items-center font-sans overflow-hidden">
      <div className="w-full max-w-md bg-white h-full flex flex-col relative shadow-2xl">
        <header className="bg-emerald-600 text-white p-6 rounded-b-[2rem] shadow-lg shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="font-black text-xl italic leading-none">Hola, {user.username}</h1>
              <span className="text-[10px] uppercase font-bold opacity-80">{user.store} • {user.company}</span>
            </div>
            <button onClick={() => signOut(auth)} className="bg-white/20 p-2 rounded-xl"><LogOut size={20} /></button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto pb-24 text-center">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl mb-6">
            <p className="text-emerald-800 text-[10px] font-black uppercase italic">Sincronizado con Google Cloud ✅</p>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
               <h3 className="text-xs font-black text-slate-400 uppercase mb-4">Días HA realizados</h3>
               <div className="text-4xl font-black text-emerald-600">{shifts.filter(s => s.isHA).length} / 15</div>
            </div>
            
            <button 
              onClick={() => cerrarTurno(true)}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all"
            >
              REGISTRAR DÍA HA HOY
            </button>
          </div>
        </main>

        <nav className="h-20 bg-white border-t border-slate-100 flex justify-around items-center fixed bottom-0 max-w-md w-full">
           <div className="text-emerald-600 flex flex-col items-center"><PieChart size={24}/><span className="text-[8px] font-black uppercase">Resumen</span></div>
           <div className="text-slate-300 flex flex-col items-center"><CalendarIcon size={24}/><span className="text-[8px] font-black uppercase">Agenda</span></div>
        </nav>
      </div>
    </div>
  );
}