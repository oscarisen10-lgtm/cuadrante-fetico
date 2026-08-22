/**
 * Catálogo de tiendas válidas, para validar en el SERVIDOR lo que hoy solo
 * restringía el desplegable del cliente (auditoría 22-ago-2026, F-04).
 *
 * ⚠️ DUPLICADO de los nombres en src/constants/stores.js: functions/ es
 * CommonJS y no puede importar el ESM del frontend directamente. Si se añade,
 * quita o renombra una tienda allí, hay que replicarlo aquí también.
 */
const VALID_STORES = [
  "LAS MATAS", "REYES CAT", "MAJADAHONDA I", "MONTE PILAR", "PARQUE PINAR",
  "LA NAVATA", "VILLALBA", "GUADARRAMA", "VILLALBA PUEBLO", "CERRO ESPINO",
  "MIRASIERRA", "PTA HIERRO", "PINEA", "MORALEJA GREEN", "ZIELO",
  "PASEO IMPERIAL", "TOLEDO", "VALLEHERMOSO", "CONDESA DE VENADITO",
  "MARQUES DE MONDEJAR", "NUÑEZ DE BALBOA", "PONZANO", "EMBAJADORES",
  "MARQUEZ DE LOZOYA", "NARVAEZ", "CLARA DEL REY", "DOCTOR FLEMING",
  "AVDA EUROPA", "AVDA COMUNIDAD MADRID", "JR JIMENEZ", "RIVAS",
  "SUANCES ALCALA 494", "ARAVACA", "LAS ROZAS", "VALDEMARIN", "CASTELLO",
  "CASTELLANA", "CORAZON DE MARIA", "PALACIO DE HIELO", "QUINTANA",
  "VALDEBEBAS", "PINTO", "CEDIAL", "VILLANUEVA CAÑADA", "VILLAVICIOSA",
  "COLMENAR VIEJO", "3 CANTOS", "BARAJAS /CORONALES", "SAN SEBASTIAN REYES",
  "ALCOBENDAS", "MONTE CARMELO", "MARIA MAEZTU", "LAS TABLAS",
  "ARROYOFRESNO / CERRO M", "PRADO SOMOSAGUAS", "MONFORTE LEMOS",
  "ARTURO SORIA", "TORRELODONES", "MERCADO DE SAN ANTON", "BARQUILLO",
  "ODONNEL", "DIEGO DE LEON", "BOADILLA",
  "El Corte Inglés Preciados - Callao", "El Corte Inglés Castellana",
  "El Corte Inglés Goya", "El Corte Inglés Princesa",
  "El Corte Inglés Serrano", "El Corte Inglés Sanchinarro",
  "El Corte Inglés Campo de Las Naciones", "El Corte Inglés Vista Alegre",
  "El Corte Inglés Pozuelo", "El Corte Inglés San José de Valderas",
  "El Corte Inglés El Bercial", "El Corte Inglés Madrid Xanadú",
  "El Corte Inglés Alcalá de Henares",
];

// Valores especiales que también son legítimos aunque no sean un nombre de
// tienda real: "" (empresa no verificada, o vaciar tienda al cambiar de
// empresa) y "Centro sin definir" (perfiles auto-reparados, ver ensureUserDoc
// en el cliente).
const isValidStore = (store) =>
  store === "" || store === "Centro sin definir" || VALID_STORES.includes(store);

module.exports = { VALID_STORES, isValidStore };
