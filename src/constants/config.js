export const CONFIG = {
  MAX_DIAS_HA: 15,
  LIMITE_ANUAL_HORAS: 1770,
  MAX_FINES_CALIDAD: 10,
  UMBRAL_DIA_HA_MINUTOS: 510,
  MAX_DOMINGOS: 22,
  FESTIVOS: [
    // Festivos Nacionales (8 fijos)
    "01-01", // Año Nuevo
    "01-06", // Epifanía del Señor (Reyes)
    "05-01", // Fiesta del Trabajo
    "08-15", // Asunción de la Virgen
    "10-12", // Fiesta Nacional de España
    "11-01", // Todos los Santos
    "12-06", // Día de la Constitución
    "12-08", // Inmaculada Concepción
    "12-25", // Natividad del Señor
    
    // Festivos Regionales / Locales (4 ejemplos que puedes cambiar)
    "03-19", // San José (Ejemplo)
    "03-28", // Jueves Santo (Ejemplo - Varía cada año)
    "03-29", // Viernes Santo (Ejemplo - Varía cada año)
    "05-02", // Día de la Comunidad de Madrid (Ejemplo)
  ]
};

// 👇 EMAIL DE ADMINISTRADOR 👇
export const ADMIN_EMAIL = "oscargarcia@fetico.es";
