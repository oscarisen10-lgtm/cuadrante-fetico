import React, { useState, useMemo } from 'react';
import { User, Lock, Mail, Store, ShieldCheck, KeyRound, X, UserCheck, ChevronDown } from 'lucide-react';
import { loginUser, registerUser, resetPassword, loginAsGuest } from '../services/firebaseService';
import { InputGroup } from './UIComponents';
import { COMPANY_RULES } from '../constants/config';
import { STORES } from '../constants/stores';

// ⚠️ MODO TESTERS: Cambiar a `true` para reactivar el registro público
const ALLOW_REGISTRATION = true;

export default function AuthView() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formCompany, setFormCompany] = useState("Supercor");

  const sortedStores = useMemo(() => {
    return [...STORES].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

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
        await loginUser(emailInput, pass);
      } else {
        const confirmPass = formData.get('confirmPassword');
        if (pass !== confirmPass) {
           setRecoveryError("Las contraseñas no coinciden.");
           setIsLoading(false);
           setTimeout(() => setRecoveryError(""), 3000);
           return;
        }

        const newUserProfile = {
          email: emailInput,
          fullName: formData.get('fullName') || 'Compañero/a',
          company: formData.get('company') || "Supercor",
          store: formData.get('store') || "Centro sin definir",
          rank: formData.get('rank') || "Personal base"
        };
        
        await registerUser(emailInput, pass, newUserProfile);
      }
    } catch (error) {
      const isTimeout = error.message && error.message.includes("Timeout");
      setRecoveryError(isTimeout ? error.message : "Credenciales incorrectas o cuenta no existe.");
      setTimeout(() => setRecoveryError(""), 3000);
    }
    setIsLoading(false);
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setRecoveryError("");
    try {
      await loginAsGuest();
    } catch (error) {
      setRecoveryError("Error al entrar como invitado. Inténtalo de nuevo.");
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
      await resetPassword(emailInput);
      setRecoveryError("¡Éxito! Revisa tu email para crear una nueva contraseña.");
      setTimeout(() => { setShowForgotModal(false); setRecoveryError(""); }, 3000);
    } catch (error) {
      setRecoveryError("Cuenta no encontrada en la Nube.");
    }
    setIsLoading(false);
  };

  return (
    <div className="h-[100dvh] bg-emerald-50 flex flex-col items-center justify-center p-4 font-sans overflow-hidden text-slate-800">
      <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-xl border border-emerald-100 flex flex-col max-h-[95vh] overflow-hidden">
        <div className="bg-emerald-600 p-4 text-center text-white shrink-0 relative z-10">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mx-auto mb-1 shadow-inner shrink-0">
            <span className="text-emerald-600 font-black text-xl italic leading-none">F</span>
          </div>
          <h1 className="text-base font-black italic uppercase tracking-tight leading-none">Mi Cuadrante</h1>
          <p className="text-emerald-100 text-[8px] uppercase font-bold tracking-widest mt-1">Registro Horario</p>
        </div>

        <form onSubmit={handleAuth} className="p-4 flex flex-col overflow-hidden relative z-0">
          <div className="space-y-3 overflow-y-auto pr-1 scrollbar-hide flex-1 pb-2">
            {isRegistering && ALLOW_REGISTRATION ? (
              <>
                <InputGroup label="Nombre Apellidos" name="fullName" small icon={<User size={14}/>} />
                <InputGroup label="Email" name="email" type="email" small icon={<Mail size={14}/>} />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-tight">Empresa</label>
                    <select name="company" onChange={(e) => setFormCompany(e.target.value)} className="w-full bg-slate-50 border-none p-1.5 rounded-lg text-sm outline-none ring-1 ring-slate-200">
                      {Object.keys(COMPANY_RULES).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-tight">Rango</label>
                    <select name="rank" className="w-full bg-slate-50 border-none p-1.5 rounded-lg text-sm outline-none ring-1 ring-slate-200">
                      {Object.keys(COMPANY_RULES[formCompany] || {}).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                {formCompany === "Supercor" ? (
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-tight flex items-center gap-1">
                      <Store size={10}/> Centro / Tienda
                    </label>
                    <div className="relative">
                      <select 
                        name="store" 
                        className="w-full bg-slate-50 border-none p-1.5 pr-8 rounded-lg text-sm outline-none ring-1 ring-slate-200 appearance-none font-medium"
                        required
                      >
                        <option value="" disabled selected>Selecciona tu tienda...</option>
                        {sortedStores.map(s => (
                          <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <InputGroup label="Centro / Tienda" name="store" small icon={<Store size={14}/>} />
                )}
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
              {isLoading ? 'CONECTANDO...' : (isRegistering && ALLOW_REGISTRATION ? 'CREAR CUENTA' : 'ENTRAR')}
            </button>

            {/* Botón de Modo Invitado — Visible siempre para testers */}
            <button 
              type="button" 
              onClick={handleGuestLogin} 
              disabled={isLoading}
              className={`w-full bg-slate-800 text-white font-black py-3 rounded-xl uppercase text-xs active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 ${isLoading ? 'opacity-70' : ''}`}
            >
              <UserCheck size={16} /> ENTRAR COMO INVITADO
            </button>

            {ALLOW_REGISTRATION && (
              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setRecoveryError(""); }} className="w-full text-center text-xs font-black text-emerald-700 uppercase tracking-widest leading-none mt-2">
                {isRegistering ? 'Volver atrás' : '¿Eres nuevo? Regístrate'}
              </button>
            )}
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
