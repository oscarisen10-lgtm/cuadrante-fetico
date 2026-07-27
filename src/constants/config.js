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

// 👇 EMAIL DE ADMINISTRADOR 👇
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";

// Único punto de verdad para "¿este usuario es admin?" (antes repetido en App,
// DashboardView y SettingsView). Comparación de email sin distinguir
// mayúsculas. Nota: es solo para la UI; el control real está en reglas y backend.
export const isAdminUser = (user) =>
  !!(user?.email && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
