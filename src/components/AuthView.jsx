import React, { useState, useMemo } from 'react';
import { User, Lock, Mail, Store, ShieldCheck, KeyRound, X, ChevronDown } from 'lucide-react';
import { loginUser, registerUser, resetPassword, signInWithGoogle, signInWithApple } from '../services/firebaseService';
import { InputGroup } from './UIComponents';
import { COMPANY_RULES } from '../constants/config';
import { STORES, S_ROMERO_STORES } from '../constants/stores';

// ⚠️ MODO TESTERS: Cambiar a `true` para reactivar el registro público
const ALLOW_REGISTRATION = true;

export default function AuthView() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formCompany, setFormCompany] = useState("Supercor");

  const sortedStores = useMemo(() => {
    let filteredStores = STORES;
    if (formCompany === "S. Romero") {
      filteredStores = STORES.filter(s => S_ROMERO_STORES.includes(s.name));
    } else if (formCompany === "Supercor" || formCompany === "S. Express") {
      filteredStores = STORES.filter(s => !S_ROMERO_STORES.includes(s.name));
    }
    return [...filteredStores].sort((a, b) => a.name.localeCompare(b.name));
  }, [formCompany]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setRecoveryError("");
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
      setRecoveryError(`Error Google: ${error.code || error.message}`);
      setTimeout(() => setRecoveryError(""), 12000);
    }
    setIsLoading(false);
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    setRecoveryError("");
    try {
      await signInWithApple();
    } catch (error) {
      console.error(error);
      setRecoveryError(`Error Apple: ${error.code || error.message}`);
      setTimeout(() => setRecoveryError(""), 12000);
    }
    setIsLoading(false);
  };

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
                {["Supercor", "S. Romero", "S. Express", "ECI"].includes(formCompany) ? (
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-tight flex items-center gap-1">
                      <Store size={10}/> Centro / Tienda
                    </label>
                    <div className="relative">
                      {formCompany === "ECI" ? (
                        <select 
                          name="store" 
                          className="w-full bg-slate-50 border-none p-1.5 pr-8 rounded-lg text-sm outline-none ring-1 ring-slate-200 appearance-none font-medium"
                          defaultValue="En construcción"
                          required
                        >
                          <option value="En construcción">En construcción</option>
                        </select>
                      ) : (
                        <select 
                          name="store" 
                          className="w-full bg-slate-50 border-none p-1.5 pr-8 rounded-lg text-sm outline-none ring-1 ring-slate-200 appearance-none font-medium"
                          defaultValue=""
                          required
                        >
                          <option value="" disabled>Selecciona tu tienda...</option>
                          {sortedStores.map(s => (
                            <option key={s.name} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      )}
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

            {ALLOW_REGISTRATION && (
              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setRecoveryError(""); }} className="w-full text-center text-xs font-black text-emerald-700 uppercase tracking-widest leading-none mt-2">
                {isRegistering ? 'Volver atrás' : '¿Eres nuevo? Regístrate'}
              </button>
            )}

            {!isRegistering && (
              <>
                <div className="flex items-center my-3 shrink-0">
                  <div className="flex-1 h-px bg-slate-100"></div>
                  <span className="px-2 text-[9px] font-black text-slate-400 uppercase tracking-wider">O CONTINÚA CON</span>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>

                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 py-2 rounded-xl text-xs font-black text-slate-700 active:scale-95 transition-all animate-in fade-in"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    GOOGLE
                  </button>
                  <button
                    type="button"
                    onClick={handleAppleLogin}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-black py-2 rounded-xl text-xs font-black text-white active:scale-95 transition-all shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.7-1.13 1.84-.99 2.94.1.08.2.12.3.12.9 0 2.02-.65 2.52-1.45z"/>
                    </svg>
                    APPLE
                  </button>
                </div>
              </>
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
