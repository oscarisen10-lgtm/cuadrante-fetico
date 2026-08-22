export const CONFIG = {
  MAX_DIAS_HA: 15,
  LIMITE_ANUAL_HORAS: 1770,
  MAX_FINES_CALIDAD: 10,
  UMBRAL_DIA_HA_MINUTOS: 510,
  MAX_DOMINGOS: 22,
  TARGET_DIAS_TRABAJADOS: 268,
  TARGET_DIAS_LIBRES: 76,
  FESTIVOS: {
    "01-01": "Año Nuevo",
    "01-06": "Epifanía del Señor",
    "04-02": "Jueves Santo",
    "04-03": "Viernes Santo",
    "05-01": "Fiesta del Trabajo",
    "05-02": "Fiesta de la Comunidad de Madrid",
    "08-15": "Asunción de la Virgen",
    "10-12": "Fiesta Nacional de España",
    "11-02": "Traslado de Todos los Santos",
    "12-07": "Traslado del Día de la Constitución",
    "12-08": "Día de la Inmaculada Concepción",
    "12-25": "Natividad del Señor"
  }
};

export const COMPANY_RULES = {
  "Supercor": {
    "Jefes": { horas: 1770, domingos: 22, calidad: 10, trabajados: 235, libres: 99, ha: 0 },
    "Segundos de tiendas": { horas: 1770, domingos: 22, calidad: 10, trabajados: 235, libres: 99, ha: 0 },
    "Gestores": { horas: 1770, domingos: 22, calidad: 10, trabajados: 235, libres: 99, ha: 0 },
    "Coordinadores de frescos": { horas: 1770, domingos: 22, calidad: 10, trabajados: 250, libres: 84, ha: 0 },
    "Personal de fresco": { horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 },
    "Personal de cobro": { horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 },
    "Personal de implantacion": { horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 }
  },
  "S. Romero": {
    "Jefes": { horas: 1770, domingos: 22, calidad: 10, trabajados: 235, libres: 99, ha: 0 },
    "Segundos de tiendas": { horas: 1770, domingos: 22, calidad: 10, trabajados: 235, libres: 99, ha: 0 },
    "Gestores": { horas: 1770, domingos: 22, calidad: 10, trabajados: 235, libres: 99, ha: 0 },
    "Coordinadores de frescos": { horas: 1770, domingos: 22, calidad: 10, trabajados: 250, libres: 84, ha: 0 },
    "Personal de fresco": { horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 },
    "Personal de cobro": { horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 },
    "Personal de implantacion": { horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 }
  },
  "S. Express": {
    "Jefe de tienda": { horas: 1770, domingos: 33, calidad: 12, trabajados: 222, libres: 112, ha: 0 },
    "Coordinador": { horas: 1770, domingos: 33, calidad: 16, trabajados: 222, libres: 112, ha: 0 },
    "Auxiliar de sala": { horas: 1770, domingos: 33, calidad: 16, trabajados: 222, libres: 112, ha: 0 },
    "Personal de cobro": { horas: 1770, domingos: 33, calidad: 16, trabajados: 222, libres: 112, ha: 0 },
    "Personal implantacion": { horas: 1770, domingos: 33, calidad: 16, trabajados: 222, libres: 112, ha: 0 },
    "Personal de frescos": { horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 },
    "Personal panaderia": { horas: 1770, domingos: 33, calidad: 16, trabajados: 222, libres: 112, ha: 0 }
  },
  "ECI": {
    "Jefes": { horas: 1770, domingos: 22, calidad: 10, trabajados: 235, libres: 99, ha: 0 },
    "Segundos de tiendas": { horas: 1770, domingos: 22, calidad: 10, trabajados: 235, libres: 99, ha: 0 },
    "Gestores": { horas: 1770, domingos: 22, calidad: 10, trabajados: 235, libres: 99, ha: 0 },
    "Coordinadores de frescos": { horas: 1770, domingos: 22, calidad: 10, trabajados: 250, libres: 84, ha: 0 },
    "Personal de fresco": { horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 },
    "Personal de cobro": { horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 },
    "Personal de implantacion": { horas: 1770, domingos: 22, calidad: 10, trabajados: 258, libres: 76, ha: 15 }
  }
};

// Puestos cuyo "finde de calidad largo" abarca 4 días (sábado+domingo+lunes+martes)
// en vez de 3 (sábado+domingo+lunes). Reparto teórico del objetivo de 10 findes:
// 2 cortos / 8 largos. El resto de puestos tiene largo de 3 días y reparto 6 cortos / 4 largos.
// Punto único de verdad: usado por el cálculo (useShifts) y por el desglose (DashboardView).
export const RANGOS_FINDE_LARGO_4_DIAS = ["Coordinadores de frescos", "Jefes", "Segundos de tiendas", "Gestores"];
export const tieneFindeLargoDe4Dias = (rank) => RANGOS_FINDE_LARGO_4_DIAS.includes(rank);

// ─── Empresas fuera de ANGED ────────────────────────────────────────────────
// COMPANY_RULES solo cubre las empresas de ANGED, las únicas cuyo convenio
// conocemos. Quien trabaje en otra empresa se registra eligiendo OTHER_COMPANY y
// escribe a mano el nombre de su empresa y su puesto. De esa empresa NO sabemos
// ni su convenio ni sus objetivos, así que no se los inventamos: o los mete él a
// mano en Ajustes (profile.customTargets) o el Resumen va sin objetivos.
export const OTHER_COMPANY = "Otra empresa";

export const isKnownCompany = (company) =>
  Object.prototype.hasOwnProperty.call(COMPANY_RULES, company);

// ¿Conocemos el convenio de este usuario? El registro de "Otra empresa" marca
// profile.companyVerified = false; se comprueba ANTES que el nombre porque la
// empresa la escribe el propio usuario y podría coincidir con una de ANGED.
// Los perfiles antiguos no llevan el campo y se deciden por el nombre, como siempre.
export const hasKnownConvenio = (user) =>
  user?.companyVerified !== false && isKnownCompany(user?.company);

// Objetivos que puede fijarse a mano un usuario de empresa no verificada.
// A propósito NO están "calidad" ni "ha": son figuras del convenio de ANGED que
// no tienen por qué existir en otra empresa (con 0 sus barras no se pintan).
export const CUSTOM_TARGET_FIELDS = [
  { key: "horas", label: "Horas anuales", max: 4000 },
  { key: "trabajados", label: "Días trabajados", max: 366 },
  { key: "libres", label: "Días libres", max: 366 },
  { key: "domingos", label: "Domingos/festivos", max: 366 }
];

// Sanea los objetivos escritos a mano (vienen de un input, pueden ser basura).
// Devuelve null si el usuario no ha puesto NINGUNO todavía; el Resumen lo usa
// para saber que tiene que pintarse en modo simple (contadores, sin barras).
export const normalizeCustomTargets = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const out = { horas: 0, trabajados: 0, libres: 0, domingos: 0, calidad: 0, ha: 0, custom: true };
  let alguno = false;
  CUSTOM_TARGET_FIELDS.forEach(({ key, max }) => {
    const n = Number(raw[key]);
    if (Number.isFinite(n) && n > 0) {
      out[key] = Math.min(Math.round(n), max);
      alguno = true;
    }
  });
  return alguno ? out : null;
};

// Punto ÚNICO de verdad de "¿contra qué objetivos comparo a este usuario?".
// Empresa de ANGED → su convenio. Empresa no verificada → solo lo que haya
// puesto a mano, o null. Nunca los de Supercor: para alguien de fuera serían
// una cifra inventada, y un objetivo falso es peor que ningún objetivo.
export const resolveTargets = (user) => {
  if (hasKnownConvenio(user)) {
    return COMPANY_RULES[user.company][user?.rank] || COMPANY_RULES["Supercor"]["Personal de fresco"];
  }
  return normalizeCustomTargets(user?.customTargets);
};

// Festivos de CONFIG.FESTIVOS que son autonómicos de Madrid, no nacionales.
// Todas las empresas de ANGED están en la Comunidad de Madrid, así que a ellas
// se les pintan todos. De un usuario de fuera no sabemos ni la comunidad, así
// que se le quitan: darle el 2 de mayo sería regalarle un festivo que no tiene.
// OJO al revisar los festivos cada año: si se añade otro autonómico, va aquí.
export const FESTIVOS_AUTONOMICOS_MADRID = ["05-02"];

export const FESTIVOS_NACIONALES = Object.fromEntries(
  Object.entries(CONFIG.FESTIVOS).filter(([mmdd]) => !FESTIVOS_AUTONOMICOS_MADRID.includes(mmdd))
);

// Festivos comunes que le tocan a este usuario. Los de ANGED, la lista completa
// (Madrid); los de fuera, solo los nacionales.
export const getFestivosComunes = (user) =>
  hasKnownConvenio(user) ? CONFIG.FESTIVOS : FESTIVOS_NACIONALES;

// 👇 EMAIL DE ADMINISTRADOR 👇
// Ya NO decide quién es admin (ver isAdminUser). Se conserva porque la app lo usa
// para mostrar a quién escribir en los textos de contacto/soporte.
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";

// Único punto de verdad para "¿este usuario es admin?" (antes repetido en App,
// DashboardView y SettingsView).
//
// ⚠️ Va por CUSTOM CLAIM (auditoría 22-ago-2026). Antes comparaba user.email con
// ADMIN_EMAIL, pero ese `email` NO es el de Firebase Auth: sale de users/{uid}.profile,
// que el propio usuario puede reescribir. Y como VITE_ADMIN_EMAIL viaja en el bundle,
// cualquiera podía copiarlo a su perfil y abrir el panel de administración.
// El claim lo pone solo el backend (scripts/set-admin-claim.js) y llega firmado en el
// token, así que el cliente no puede falsearlo. Sigue siendo solo para la UI: el control
// real está en firestore.rules y en las functions, que ya usaban el claim.
//
// isAdminClaim lo rellena useAuth leyendo getIdTokenResult(). Si el panel de admin
// desaparece, es que la cuenta NO tiene el claim puesto: re-ejecutar
// scripts/set-admin-claim.js y volver a entrar en la app.
export const isAdminUser = (user) => user?.isAdminClaim === true;
