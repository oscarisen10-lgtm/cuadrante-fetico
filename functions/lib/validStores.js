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

/**
 * Empresas de ANGED, las únicas cuyo convenio conocemos.
 * ⚠️ DUPLICADO de las claves de COMPANY_RULES en src/constants/config.js, por el
 * mismo motivo que VALID_STORES (functions/ es CommonJS y no importa el ESM).
 */
const ANGED_COMPANIES = ["Supercor", "S. Romero", "S. Express", "ECI"];

const isAngedCompany = (company) => ANGED_COMPANIES.includes(company);

// Tiendas por empresa. ⚠️ DUPLICADO de S_ROMERO_STORES / ECI_STORES /
// SUPERCOR_EXPRESS_STORES en src/constants/stores.js.
const S_ROMERO_STORES = [
  "ARTURO SORIA", "CASTELLANA", "CERRO ESPINO", "CORAZON DE MARIA",
  "MIRASIERRA", "MORALEJA GREEN", "PINEA", "PTA HIERRO", "ZIELO",
];

const ECI_STORES = VALID_STORES.filter((s) => s.startsWith("El Corte Inglés"));

const SUPERCOR_EXPRESS_STORES = [
  "3 CANTOS", "ALCOBENDAS", "ARAVACA", "ARROYOFRESNO / CERRO M",
  "AVDA COMUNIDAD MADRID", "AVDA EUROPA", "BARAJAS /CORONALES", "BARQUILLO",
  "CASTELLO", "CEDIAL", "CLARA DEL REY", "COLMENAR VIEJO",
  "CONDESA DE VENADITO", "DIEGO DE LEON", "DOCTOR FLEMING", "EMBAJADORES",
  "JR JIMENEZ", "LAS ROZAS", "LAS TABLAS", "MARIA MAEZTU",
  "MARQUES DE MONDEJAR", "MARQUEZ DE LOZOYA", "MERCADO DE SAN ANTON",
  "MONFORTE LEMOS", "MONTE CARMELO", "NARVAEZ", "NUÑEZ DE BALBOA", "ODONNEL",
  "PONZANO", "PRADO SOMOSAGUAS", "RIVAS", "SAN SEBASTIAN REYES",
  "SUANCES ALCALA 494", "TORRELODONES", "VALDEMARIN", "VALLEHERMOSO",
  "VILLALBA PUEBLO", "VILLANUEVA CAÑADA", "VILLAVICIOSA",
];

/**
 * ¿Es `store` un centro de `company`? Espejo de storesForCompany() del cliente,
 * Supercor incluido, que se calcula por RESTA (una tienda nueva sin clasificar
 * cae en Supercor en vez de quedarse sin empresa).
 *
 * Sirve para que la callable no acepte una combinación que el desplegable nunca
 * ofrecería — p. ej. company "ECI" con una tienda de Exprés, que metería al
 * usuario en el censo de un delegado que no es el suyo.
 * "" y "Centro sin definir" pasan siempre: son estados intermedios legítimos.
 */
const storeBelongsToCompany = (store, company) => {
  if (store === "" || store === "Centro sin definir") return true;
  if (company === "S. Romero") return S_ROMERO_STORES.includes(store);
  if (company === "ECI") return ECI_STORES.includes(store);
  if (company === "S. Express") return SUPERCOR_EXPRESS_STORES.includes(store);
  if (company === "Supercor") {
    return !S_ROMERO_STORES.includes(store) &&
           !ECI_STORES.includes(store) &&
           !SUPERCOR_EXPRESS_STORES.includes(store);
  }
  return false; // empresa de fuera de ANGED: no le corresponde ninguna tienda
};

module.exports = {
  VALID_STORES,
  isValidStore,
  ANGED_COMPANIES,
  isAngedCompany,
  storeBelongsToCompany,
};
