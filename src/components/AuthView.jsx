import { useState, useMemo } from 'react';
import { User, Lock, Mail, Store, ShieldCheck, KeyRound, X, ChevronDown, Building2 } from 'lucide-react';
import { loginUser, registerUser, resetPassword } from '../services/firebaseService';
import { InputGroup } from './UIComponents';
import { COMPANY_RULES, OTHER_COMPANY, NON_ANGED_COMPANIES, isKnownCompany } from '../constants/config';
import { storesForCompany, formatStoreName } from '../constants/stores';
import appLogo from '../../icons/icon-192.webp';

// Registro público abierto. Se puso a `false` una temporada mientras la app estaba
// solo en manos de testers; hoy cualquiera puede crear cuenta, y las de ANGED nacen
// PENDIENTES hasta que un delegado las verifica (ver membership en firestore.rules),
// que es lo que de verdad controla el acceso. Ponerlo a `false` oculta el botón de
// registro en esta pantalla, no cierra el alta por API.
const ALLOW_REGISTRATION = true;

// Longitud mínima de contraseña: 6, el mínimo que acepta Firebase.
//
// La auditoría del 22-ago-2026 (F-12) lo subió a 8 por fuerza bruta, y Óscar lo
// devolvió a 6 el 28-ago-2026: el registro lo hacen compañeros de tienda, muchas
// veces con el delegado delante, y cada requisito extra es gente que se atasca y
// no acaba de darse de alta. Decisión consciente, no un descuido — si se vuelve a
// subir, que sea hablándolo con él.
const MIN_PASSWORD = 6;

const getFriendlyErrorMessage = (error, isRegistering) => {
  if (error.message && error.message.includes("Timeout")) {
    return error.message;
  }
  
  const errorCode = error.code;
  switch (errorCode) {
    // Errores de Registro
    case 'auth/email-already-in-use':
      return 'Este correo ya está registrado. Intenta iniciar sesión.';
    case 'auth/invalid-email':
      return 'El correo electrónico no es válido.';
    case 'auth/operation-not-allowed':
      return 'El registro por correo no está habilitado en el servidor.';
    case 'auth/weak-password':
      return `La contraseña es muy débil. Mínimo ${MIN_PASSWORD} caracteres.`;
      
    // Errores de Login
    case 'auth/wrong-password':
      return 'Contraseña incorrecta.';
    case 'auth/user-not-found':
      return 'No existe ninguna cuenta con este correo.';
    case 'auth/invalid-credential':
      return 'Credenciales incorrectas o la cuenta no existe.';
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido desactivada por el administrador.';
      
    // Errores de Firestore / Permisos
    case 'permission-denied':
      return 'Error de permisos al crear tu perfil. Contacta con soporte.';
      
    default:
      return error.message || (isRegistering ? 'Error al crear la cuenta.' : 'Credenciales incorrectas.');
  }
};

export default function AuthView() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Empieza VACÍA a propósito: con "Supercor" preseleccionado, quien no se fijaba
  // se registraba en una empresa que no es la suya (y con ella, en una tienda y un
  // convenio ajenos). Sin valor por defecto, elegir empresa es un acto consciente.
  const [formCompany, setFormCompany] = useState("");
  // Empresa de fuera de ANGED: la escribe el usuario, igual que su puesto.
  const esOtraEmpresa = formCompany === OTHER_COMPANY;
  // Solo las empresas de ANGED tienen convenio conocido, y por tanto rango y
  // centro. Mientras no haya empresa elegida no se enseña ninguno de los dos:
  // antes salían los de Supercor por el valor por defecto.
  const esANGED = isKnownCompany(formCompany);

  const sortedStores = useMemo(
    () => [...storesForCompany(formCompany)].sort((a, b) => a.name.localeCompare(b.name)),
    [formCompany]
  );

  const handleAuth = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const emailInput = formData.get('email')?.trim().toLowerCase();
    const pass = formData.get('password');

    // Solo se exige la longitud nueva al REGISTRARSE. Al iniciar sesión no: quien
    // creó su cuenta cuando el mínimo eran 6 seguiría entrando con la suya, y
    // rechazársela aquí le dejaría fuera de su propia cuenta sin explicación.
    if (isRegistering && pass.length < MIN_PASSWORD) {
      setRecoveryError(`La contraseña debe tener mínimo ${MIN_PASSWORD} caracteres.`);
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

        // Sin `|| "Supercor"`: ese respaldo tenía sentido cuando el desplegable
        // nacía en Supercor, pero ahora "" es un estado real (nadie ha elegido). Si
        // se colara, registraría al usuario en una empresa que no es la suya, con su
        // convenio y sus tiendas. El `required` del select ya lo impide en el
        // navegador; esto es el cinturón por si el formulario se envía de otro modo.
        const selectedCompany = formData.get('company');
        if (!selectedCompany) {
          setRecoveryError("Selecciona tu empresa.");
          setIsLoading(false);
          setTimeout(() => setRecoveryError(""), 3000);
          return;
        }
        // Fuera de ANGED es TODO lo que no está en COMPANY_RULES: tanto "Otra empresa"
        // como las cadenas que salen por su nombre (Mercadona, Lidl…). Comprobar solo
        // `=== OTHER_COMPANY`, como se hacía antes de añadirlas, habría metido a quien
        // eligiera "Mercadona" por la rama de ANGED: con el convenio de Supercor, una
        // tienda por defecto y la cuenta esperando a un delegado que no existe.
        const otraEmpresa = !isKnownCompany(selectedCompany);

        // El desplegable de rango no tenía opción vacía: un <select> sin nada elegido
        // muestra su PRIMERA opción, que en Supercor/S.Romero/ECI es "Jefes" (S.Express:
        // "Jefe de tienda"). Quien no tocaba el desplegable quedaba dado de alta como
        // jefe sin querer, con objetivos de convenio completamente distintos a los
        // suyos. Igual que con la empresa: el `required` del select ya lo impide en el
        // navegador, esto es el cinturón por si el formulario se envía de otro modo.
        const selectedRank = otraEmpresa ? "" : formData.get('rank');
        if (!otraEmpresa && !selectedRank) {
          setRecoveryError("Selecciona tu rango.");
          setIsLoading(false);
          setTimeout(() => setRecoveryError(""), 3000);
          return;
        }

        const newUserProfile = otraEmpresa
          ? {
              email: emailInput,
              fullName: formData.get('fullName') || 'Compañero/a',
              // Si viene del desplegable ya trae nombre; "Otra empresa" es la única
              // que lo pide por escrito.
              company: selectedCompany === OTHER_COMPANY
                ? (formData.get('companyName')?.trim() || OTHER_COMPANY)
                : selectedCompany,
              // Marca explícita de "no conocemos su convenio": manda sobre el
              // nombre, que lo escribe el usuario y podría coincidir con una de
              // ANGED. Ver hasKnownConvenio().
              companyVerified: false,
              // Sin centro ni rango: no tienen sentido fuera de ANGED y no
              // calculan nada. El centro VACÍO además evita que, escribiendo el
              // nombre de una tienda real, se le colaran las noticias del
              // delegado de esa tienda (la consulta se salta si no hay tienda).
              store: "",
              rank: "",
              // De aquí sale la parte proporcional de las pagas extra para quien
              // no lleva el periodo entero. Vacío = se asume paga completa.
              fechaAlta: formData.get('fechaAlta') || ''
            }
          : {
              email: emailInput,
              fullName: formData.get('fullName') || 'Compañero/a',
              company: selectedCompany,
              store: formData.get('store') || "Centro sin definir",
              rank: selectedRank,
              fechaAlta: formData.get('fechaAlta') || ''
            };

        await registerUser(emailInput, pass, newUserProfile);
      }
    } catch (error) {
      console.error("Auth error details:", error);
      const friendlyMsg = getFriendlyErrorMessage(error, isRegistering);
      setRecoveryError(friendlyMsg);
      // Mantener el error en pantalla más tiempo si es un error de registro (10s) para que el usuario pueda leerlo y decírtelo
      setTimeout(() => setRecoveryError(""), isRegistering ? 10000 : 4000);
    }
    setIsLoading(false);
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const emailInput = formData.get('email')?.trim().toLowerCase();
    setIsLoading(true);
    // MISMA respuesta exista o no la cuenta. Antes se decía "Cuenta no encontrada en
    // la Nube" cuando el email no estaba registrado, así que el formulario servía para
    // averiguar QUIÉN tiene cuenta (el comentario decía lo contrario que el código).
    // El fallo se traga a propósito: si el envío falla de verdad, el usuario
    // simplemente no recibe el correo, que es lo mismo que ve quien no tiene cuenta.
    try {
      await resetPassword(emailInput);
    } catch (error) {
      console.warn("resetPassword:", error?.code || error);
    }
    setRecoveryError("Si ese correo tiene cuenta, te hemos enviado un email para crear una nueva contraseña.");
    setTimeout(() => { setShowForgotModal(false); setRecoveryError(""); }, 4000);
    setIsLoading(false);
  };

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center p-4 font-sans overflow-hidden text-slate-800 relative" style={{ background: 'radial-gradient(120% 90% at 50% -10%, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)' }}>
      <div className="pointer-events-none absolute -top-16 -left-12 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)' }} />
      <div className="pointer-events-none absolute -bottom-16 -right-12 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(5,150,105,0.22), transparent 70%)' }} />
      <div className="relative w-full max-w-sm rounded-[2rem] flex flex-col max-h-[95vh] overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 30px 70px -20px rgba(5,80,60,0.45), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(16,185,129,0.15)' }}>
        <div className="p-5 text-center text-white shrink-0 relative z-10 overflow-hidden" style={{ background: 'linear-gradient(160deg,#10b981,#059669 55%,#047857)' }}>
          <div className="pointer-events-none absolute -top-8 -right-4 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%)' }} />
          <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 shrink-0 overflow-hidden" style={{ background: 'linear-gradient(180deg,#fff,#e8efe9)', boxShadow: '0 6px 14px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.9)' }}>
            <img src={appLogo} alt="Mi Cuadrante" className="w-full h-full object-cover" />
          </div>
          <h1 className="relative text-lg font-black italic uppercase tracking-tight leading-none">Mi Cuadrante</h1>
          <p className="relative text-emerald-100 text-[8px] uppercase font-bold tracking-[0.25em] mt-1.5">Registro Horario</p>
        </div>

        <form onSubmit={handleAuth} className="p-4 flex flex-col overflow-hidden relative z-0">
          <div className="space-y-3 overflow-y-auto pr-1 scrollbar-hide flex-1 pb-2">
            {isRegistering && ALLOW_REGISTRATION ? (
              <>
                <InputGroup label="Nombre Apellidos" name="fullName" small icon={<User size={14}/>} />
                <InputGroup label="Email" name="email" type="email" small icon={<Mail size={14}/>} />
                {/* El select de EMPRESA se pinta UNA sola vez, fuera de cualquier
                    rama condicional, y es CONTROLADO (`value={formCompany}`).
                    Antes había dos copias, una en cada rama del ternario, y ninguna
                    era controlada: al elegir "Otra empresa", React desmontaba una y
                    montaba la otra, que al nacer sin valor se posicionaba en su
                    primera opción ("Supercor"). Los campos de debajo sí cambiaban,
                    pero el desplegable mostraba Supercor y había que elegir dos
                    veces. Con un único elemento controlado, eso no puede pasar.

                    La rejilla de dos columnas solo se activa cuando hay Rango al
                    lado; el select no se mueve de sitio en el árbol, así que
                    cambiar de empresa nunca lo remonta. */}
                <div className={esANGED ? "grid grid-cols-2 gap-2" : ""}>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-tight">Empresa</label>
                    <select
                      name="company"
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                      required
                      className="w-full bg-slate-50 border-none p-1.5 rounded-lg text-sm outline-none ring-1 ring-slate-200"
                    >
                      <option value="" disabled>Selecciona tu empresa...</option>
                      {/* Agrupadas porque son 26: sin separar, encontrar la tuya en una
                          lista plana es un scroll a ciegas. El grupo también dice la
                          verdad de por qué unas piden centro y rango y otras no. */}
                      <optgroup label="Con convenio en la app">
                        {Object.keys(COMPANY_RULES).map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                      <optgroup label="Otras empresas">
                        {NON_ANGED_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value={OTHER_COMPANY}>{OTHER_COMPANY}</option>
                      </optgroup>
                    </select>
                  </div>
                  {/* Rango: solo con empresa de ANGED (es su convenio quien lo define).
                      `key` fuerza a empezar de cero al cambiar de empresa: sin él, el
                      rango ya elegido se quedaba pegado aunque no existiera en la
                      empresa nueva (los de S. Express no son los de Supercor).
                      Empieza VACÍO y es obligatorio, igual que la empresa: sin la opción
                      vacía, el navegador mostraba la primera de la lista ("Jefes") y
                      quien no tocaba el desplegable se daba de alta con ese rango y sus
                      objetivos de convenio, que no son los suyos. */}
                  {esANGED && (
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-tight">Rango</label>
                      <select key={formCompany} name="rank" required defaultValue="" className="w-full bg-slate-50 border-none p-1.5 rounded-lg text-sm outline-none ring-1 ring-slate-200">
                        <option value="" disabled>Selecciona tu rango...</option>
                        {Object.keys(COMPANY_RULES[formCompany] || {}).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Centro/tienda: igual que el rango, solo para ANGED. El `key`
                    devuelve el desplegable a "Selecciona tu tienda..." al cambiar de
                    empresa — si no, se podía enviar una tienda de Supercor con la
                    empresa ECI ya seleccionada. */}
                {esANGED && (
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-tight flex items-center gap-1">
                      <Store size={10}/> Centro / Tienda
                    </label>
                    <div className="relative">
                      <select
                        key={formCompany}
                        name="store"
                        className="w-full bg-slate-50 border-none p-1.5 pr-8 rounded-lg text-sm outline-none ring-1 ring-slate-200 appearance-none font-medium"
                        defaultValue=""
                        required
                      >
                        <option value="" disabled>Selecciona tu tienda...</option>
                        {sortedStores.map(s => (
                          <option key={s.name} value={s.name}>{formatStoreName(s.name)}</option>
                        ))}
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Fuera de ANGED: solo el nombre que escriba. Ni rango ni centro —
                    puede ser camarero o albañil, y no le calculan nada. */}
                {esOtraEmpresa && (
                  <InputGroup label="Nombre de empresa" name="companyName" maxLength={60} small icon={<Building2 size={14}/>} />
                )}
                {/* Opcional: sin fecha se asume año completo — paga extra entera y
                    objetivos del convenio sin recortar, que es lo de quien lleva más
                    de un año. Solo cambia algo para las altas recientes, así que no
                    se pide como obligatorio. */}
                <div className="space-y-1.5 flex flex-col">
                  <label htmlFor="input-fechaAlta" className="text-xs font-black text-emerald-600 uppercase ml-1 tracking-tight">
                    Fecha de alta en la empresa
                  </label>
                  <input
                    id="input-fechaAlta" name="fechaAlta" type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full px-3 border-none p-3 text-sm rounded-2xl outline-none text-slate-800 leading-none transition-all ring-1 ring-slate-200/80 shadow-[inset_0_2px_4px_rgba(15,23,42,0.07)] focus:ring-2 focus:ring-emerald-500"
                    style={{ background: 'linear-gradient(180deg,#f6f7f9,#eef0f3)' }}
                  />
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight ml-1 leading-tight">
                    Opcional. Ajusta tus objetivos del año y tus pagas de verano y navidad si entraste a mitad de año.
                  </span>
                </div>
                <InputGroup label={`Contraseña (mín. ${MIN_PASSWORD})`} name="password" type="password" minLength={MIN_PASSWORD} small icon={<Lock size={14}/>} />
                <InputGroup label="Repetir Contraseña" name="confirmPassword" type="password" minLength={MIN_PASSWORD} small icon={<ShieldCheck size={14}/>} />
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
            <button type="submit" disabled={isLoading} className="btn3d sheen w-full text-white font-black py-3 rounded-2xl uppercase text-sm" style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 8px 18px rgba(5,150,105,0.4), inset 0 1.5px 1px rgba(255,255,255,0.45)' }}>
              {isLoading ? 'CONECTANDO...' : (isRegistering && ALLOW_REGISTRATION ? 'CREAR CUENTA' : 'ENTRAR')}
            </button>

            {ALLOW_REGISTRATION && (
              <button 
                type="button" 
                onClick={() => { setIsRegistering(!isRegistering); setRecoveryError(""); }} 
                className={`w-full text-center text-xs font-black py-2.5 rounded-xl uppercase transition-all mt-2 active:scale-95 tracking-wider ${
                  isRegistering 
                    ? 'text-slate-500 bg-slate-100 hover:bg-slate-200' 
                    : 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/70 shadow-sm'
                }`}
              >
                {isRegistering ? 'Volver al Inicio de Sesión' : '¿Eres nuevo? Regístrate aquí'}
              </button>
            )}

          </div>
        </form>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="rounded-[2rem] p-5 w-full max-w-sm relative animate-in zoom-in-95" style={{ background: 'linear-gradient(180deg,#ffffff,#f4f6f7)', boxShadow: '0 24px 60px rgba(0,0,0,0.4), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.05)' }}>
              <button onClick={() => { setShowForgotModal(false); setRecoveryError(""); }} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500"><X size={20} /></button>
              <div className="mx-auto mb-2 grid place-items-center w-14 h-14 rounded-2xl text-white" style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 6px 14px rgba(5,150,105,0.4), inset 0 1px 1px rgba(255,255,255,0.45)' }}><KeyRound size={26}/></div>
              <h3 className="text-base font-black text-center text-slate-800 mb-1 italic uppercase leading-none">Recuperar Acceso</h3>
              <p className="text-center text-slate-500 text-[10px] mb-4 uppercase font-bold tracking-tight">Recibirás un email seguro para cambiar contraseña</p>
              <form onSubmit={handleRecovery} className="space-y-4">
                  <InputGroup label="Email Registrado" name="email" type="email" icon={<Mail size={14}/>} />
                  {recoveryError && <div className={`p-1.5 rounded text-center text-[9px] font-black uppercase ${recoveryError.includes('Éxito') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{recoveryError}</div>}
                  <button type="submit" disabled={isLoading} className="btn3d w-full text-white font-black py-3 rounded-2xl uppercase text-xs mt-2" style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 7px 16px rgba(5,150,105,0.4), inset 0 1.5px 1px rgba(255,255,255,0.45)' }}>
                    {isLoading ? 'ENVIANDO...' : 'ENVIAR EMAIL DE RECUPERACIÓN'}
                  </button>
              </form>
          </div>
        </div>
      )}
    </div>
  );
}
