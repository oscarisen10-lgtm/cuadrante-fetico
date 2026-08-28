import { useState, useEffect } from 'react';
import { ChevronDown, X, Plus, Trash2, HeartPulse } from 'lucide-react';
import {
  GRUPOS_PROFESIONALES, TIPO_BAJA, PCT_NOCTURNIDAD,
  antiguedadAnual, mensualDesdeAnual, precioHora, plusNocturnidadHora,
  grupoPorId, etiquetaCuatrienio, eur, num4, num5, CUOTA_SINDICAL_POR_DEFECTO, IRPF_MAXIMO,
} from '../../constants/nomina';

/**
 * ModalConfigNomina — el formulario del que sale TODA la nómina.
 *
 * Vive aparte de NominaView porque es la mitad del código de la pantalla y no
 * comparte nada con ella salvo el objeto de configuración: la vista solo pinta
 * resultados, y aquí solo se recogen datos. Mismo reparto que CalendarView con
 * sus piezas de components/calendar.
 */

/** Campo de euros al mes. Vacío = 0, para no obligar a escribir ceros. */
function CampoEuros({ id, label, valor, onChange, ayuda }) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label htmlFor={id} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <input
          id={id} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00"
          value={valor} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-50 ring-1 ring-slate-200 p-3 pr-9 rounded-xl text-sm outline-none text-slate-800 focus:ring-2 focus:ring-emerald-500"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">€</span>
      </div>
      {ayuda && <p className="text-[10px] text-slate-400 font-medium ml-1 leading-snug">{ayuda}</p>}
    </div>
  );
}


/** Modal de configuración: de aquí sale toda la nómina. */
export function ModalConfigNomina({ cfg, mesEtiqueta, onGuardar, onCerrar }) {
  const [g, setG] = useState(cfg.grupo || '');
  // Ya no es editable: llega derivado de la fecha de alta (ver configDelMes).
  const c = Number(cfg.cuatrienios) || 0;
  const sinFechaAlta = !cfg.fechaAlta;
  // Los importes se llevan como texto mientras se teclean: un input numérico
  // controlado con Number() se pelea con el usuario en cuanto borra o escribe coma.
  const [puesto, setPuesto] = useState(cfg.complementoPuesto ?? '');
  const [compSr, setCompSr] = useState(cfg.compensacionFijaSr ?? '');
  const [prima, setPrima] = useState(cfg.primaSegVida ?? '');
  const [cuota, setCuota] = useState(cfg.cuotaSindical ?? '');
  const [irpf, setIrpf] = useState(cfg.tipoIrpf ?? '');
  const [noct, setNoct] = useState(cfg.horasNocturnas ?? '');
  const [bajas, setBajas] = useState(() => (Array.isArray(cfg.bajas) ? cfg.bajas : []));
  const [abiertoBajas, setAbiertoBajas] = useState(Boolean(cfg.bajas?.length));

  const cambiarBaja = (i, campo, valor) =>
    setBajas((bs) => bs.map((b, j) => (j === i ? { ...b, [campo]: valor } : b)));
  // Lista de complementos con nombre. Se admite el formato viejo (un número suelto
  // en `otrosComplementos`) para no perder lo que ya hubiera configurado nadie.
  const [comps, setComps] = useState(() => {
    if (Array.isArray(cfg.complementos) && cfg.complementos.length) return cfg.complementos;
    if (Number(cfg.otrosComplementos) > 0) return [{ nombre: '', importe: cfg.otrosComplementos }];
    return [];
  });
  // El bloque de los de 12 pagas arranca plegado salvo que ya haya algo dentro:
  // es el caso menos común y no debe robar sitio a lo que sí usa todo el mundo.
  const [abierto12, setAbierto12] = useState(Boolean(cfg.complementoPuesto || cfg.compensacionFijaSr));

  const cambiarComp = (i, campo, valor) =>
    setComps((cs) => cs.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));

  const gr = grupoPorId(g);
  const baseMes = gr ? mensualDesdeAnual(gr.anual) : 0;
  const antMes = mensualDesdeAnual(antiguedadAnual(c));
  const sumaComps = comps.reduce((t, x) => t + (Number(x.importe) || 0), 0);
  const baseDePagas = baseMes + antMes + sumaComps;
  // Para que el desplegable cerrado avise de que lleva algo dentro.
  const total12 = (Number(puesto) || 0) + (Number(compSr) || 0);
  const paga = baseDePagas / 12;
  // Se avisa en vez de recortar en silencio: quien escribe 656 queriendo 6,56
  // tiene que enterarse, no ver un número corregido sin explicación.
  const irpfFueraDeRango = Number(irpf) > IRPF_MAXIMO;

  // Con el modal abierto, la página de detrás no debe moverse. `overscroll-contain`
  // ya corta el encadenado del gesto, pero en iOS el rebote elástico del body se
  // cuela igual: bloquearlo aquí es lo que evita que la nómina se desplace por
  // debajo mientras se rellena el formulario.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previo; };
  }, []);

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" role="dialog" aria-modal="true" aria-label="Configurar nómina">
      {/* Tres zonas: cabecera y botón FIJOS, y solo el formulario con scroll.
          Antes el bloque entero era un único `overflow-y-auto`, así que Guardar
          quedaba al final de un formulario muy largo y había que bajar del todo
          para alcanzarlo, medio tapado por el borde. */}
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm animate-in zoom-in-95 flex flex-col max-h-[85vh] overflow-hidden">
        {/* El mes va en la cabecera porque Guardar afecta SOLO a ese mes: sin
            decirlo, se guardaría en agosto creyendo estar editando julio. */}
        <div className="flex justify-between items-start px-6 pt-6 pb-3 border-b border-slate-100 shrink-0">
          <span className="flex flex-col min-w-0">
            <span className="text-xs font-black uppercase italic tracking-widest text-emerald-700">Configurar nómina</span>
            {mesEtiqueta && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{mesEtiqueta}</span>
            )}
          </span>
          <button onClick={onCerrar} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200 text-slate-300 shrink-0" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {/* `overscroll-contain` corta el scroll chaining: sin él, al llegar al final
            de esta lista el gesto se encadenaba a la nómina de detrás y parecía que
            el modal se quedaba clavado mientras se movía el fondo. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-4">

        <div className="flex flex-col gap-1.5 mb-5">
          <label htmlFor="cfg-grupo" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grupo profesional</label>
          <select
            id="cfg-grupo" value={g} onChange={(e) => setG(e.target.value)}
            className="w-full bg-slate-50 ring-1 ring-slate-200 p-3 rounded-xl text-sm outline-none text-slate-800 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="" disabled>Selecciona tu grupo…</option>
            {GRUPOS_PROFESIONALES.map((x) => (
              <option key={x.id} value={x.id}>{x.label}</option>
            ))}
          </select>
          {gr && (
            <p className="text-[10px] text-slate-400 font-medium ml-1 mt-1 leading-snug">
              {eur(gr.anual)} al año ÷ 16 pagas = <span className="font-black text-slate-600">{eur(baseMes)}</span> al mes
              <br />
              Hora efectiva: <span className="font-bold text-slate-500">{num5(precioHora(gr.anual))} €/h</span> (1.770 h al año)
            </p>
          )}
        </div>

        {/* La antigüedad ya NO se elige: se calcula desde la fecha de alta, que se
            pone una vez en Ajustes. Un desplegable a mano se queda obsoleto —nadie
            vuelve aquí el día que cumple ocho años— y podía contradecir a la fecha. */}
        <div className="flex flex-col gap-1.5 mb-6">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Antigüedad</span>
          <div className="bg-slate-50 ring-1 ring-slate-200 p-3 rounded-xl">
            <p className="text-sm text-slate-800 leading-tight">{etiquetaCuatrienio(c)}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1.5 leading-snug">
              {sinFechaAlta
                ? 'Se calcula sola con tu fecha de alta. Ponla en Ajustes → Mi Puesto.'
                : c > 0
                  ? <>Suma de los {c} {c === 1 ? 'tramo' : 'tramos'}: {eur(antiguedadAnual(c))} al año = <span className="font-black text-slate-600">{eur(antMes)}</span> al mes</>
                  : 'Calculada con tu fecha de alta. Aún no llegas al primer cuatrienio.'}
            </p>
          </div>
        </div>

        {/* COMPLEMENTOS (16 pagas). Con nombre y tantos como haga falta: hay quien
            tiene varios (nocturnidad, adecuación ANGED…) y cada uno sale con su
            nombre en la nómina. Estos SÍ entran en la base de las pagas. */}
        <div className="border-t border-slate-100 pt-4 mb-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Complementos</p>
          <p className="text-[10px] text-slate-400 font-medium mb-3 leading-snug">
            Suman a las pagas de Beneficios, Fomento, Verano y Navidad.
          </p>

          {comps.map((x, i) => (
            <div key={i} className="flex gap-2 mb-2.5 items-start">
              <input
                type="text" placeholder="Nombre (ej. Nocturnidad)" maxLength={30}
                value={x.nombre || ''} onChange={(e) => cambiarComp(i, 'nombre', e.target.value)}
                className="flex-1 min-w-0 bg-slate-50 ring-1 ring-slate-200 p-3 rounded-xl text-sm outline-none text-slate-800 focus:ring-2 focus:ring-emerald-500"
                aria-label={`Nombre del complemento ${i + 1}`}
              />
              <div className="relative w-28 shrink-0">
                <input
                  type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00"
                  value={x.importe ?? ''} onChange={(e) => cambiarComp(i, 'importe', e.target.value)}
                  className="w-full bg-slate-50 ring-1 ring-slate-200 p-3 pr-7 rounded-xl text-sm outline-none text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  aria-label={`Importe del complemento ${i + 1}`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">€</span>
              </div>
              <button
                onClick={() => setComps((cs) => cs.filter((_, j) => j !== i))}
                className="p-3 text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                aria-label={`Quitar el complemento ${i + 1}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <button
            onClick={() => setComps((cs) => [...cs, { nombre: '', importe: '' }])}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-500 text-[11px] font-black uppercase tracking-widest active:scale-[0.98] transition-transform"
          >
            <Plus size={14} /> Añadir complemento
          </button>
        </div>

        {/* COMPLEMENTOS EN 12 PAGAS. Plegado por defecto: son un caso menos común y
            no deben robar sitio. Se cobran en 12 mensualidades en vez de en 16, así
            que NO generan paga extra y quedan fuera de Beneficios/Fomento/Verano/Navidad. */}
        <div className="border-t border-slate-100 pt-4 mb-4">
          {/* Con caja, fondo y flecha en círculo: las etiquetas de las otras secciones
              son texto suelto, así que sin este contraste no se distingue que esto
              se pulsa. La segunda línea adelanta lo que hay dentro, para no tener
              que abrirlo solo por curiosidad. */}
          <button
            onClick={() => setAbierto12((v) => !v)}
            className={`w-full flex items-center justify-between gap-3 text-left p-3.5 rounded-xl ring-1 transition-colors ${
              abierto12
                ? 'bg-emerald-50 ring-emerald-200'
                : 'bg-slate-50 ring-slate-200 hover:bg-slate-100'
            }`}
            aria-expanded={abierto12}
            aria-controls="bloque-12-pagas"
          >
            <span className="flex flex-col min-w-0">
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest leading-none">
                Complementos en 12 pagas
              </span>
              <span className="text-[10px] text-slate-400 font-medium mt-1.5 leading-tight truncate">
                {total12 > 0
                  ? `${eur(total12)} al mes · toca para ${abierto12 ? 'cerrar' : 'editar'}`
                  : 'Complemento Puesto · Compensación Fija SR'}
              </span>
            </span>
            <span className={`grid place-items-center w-7 h-7 rounded-full shrink-0 transition-all ${
              abierto12 ? 'bg-emerald-600 text-white rotate-180' : 'bg-white text-slate-500 ring-1 ring-slate-200'
            }`}>
              <ChevronDown size={16} />
            </span>
          </button>

          {abierto12 && (
            <div id="bloque-12-pagas" className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-[10px] text-slate-400 font-medium mb-3 leading-snug">
                Estos NO generan paga extra: no cuentan para Beneficios, Fomento, Verano ni Navidad.
              </p>
              <CampoEuros id="cfg-puesto" label="Complemento Puesto" valor={puesto} onChange={setPuesto} />
              <CampoEuros id="cfg-compsr" label="Compensación Fija SR" valor={compSr} onChange={setCompSr} />
            </div>
          )}
        </div>

        {/* NOCTURNIDAD. El precio NO se pregunta: es el 20% de la hora ordinaria del
            grupo, así que sabiendo el grupo ya está. Solo hacen falta las horas. */}
        <div className="border-t border-slate-100 pt-4 mb-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nocturnidad</p>
          <p className="text-[10px] text-slate-400 font-medium mb-3 leading-snug">
            Horas trabajadas entre las 22:00 y las 06:00 este mes.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cfg-noct" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Horas nocturnas</label>
            <div className="relative">
              <input
                id="cfg-noct" type="number" inputMode="decimal" min="0" step="0.5" placeholder="0"
                value={noct} onChange={(e) => setNoct(e.target.value)}
                className="w-full bg-slate-50 ring-1 ring-slate-200 p-3 pr-9 rounded-xl text-sm outline-none text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">h</span>
            </div>
            {gr && (
              <p className="text-[10px] text-slate-400 font-medium ml-1 mt-1 leading-snug">
                Tu hora nocturna: <span className="font-bold text-slate-500">{num4(plusNocturnidadHora(gr.anual))} €/h</span>{' '}
                ({PCT_NOCTURNIDAD * 100}% de {num4(precioHora(gr.anual))} €/h)
                {Number(noct) > 0 && (
                  <> = <span className="font-black text-slate-600">{eur(Math.round(Number(noct) * plusNocturnidadHora(gr.anual) * 100) / 100)}</span></>
                )}
              </p>
            )}
          </div>
        </div>

        {/* BAJAS. El orden de las fechas importa: de qué número de baja del año se
            trate es lo que decide cuánto se cobra, así que calcularIT las ordena. */}
        <div className="border-t border-slate-100 pt-4 mb-4">
          <button
            onClick={() => setAbiertoBajas((v) => !v)}
            className={`w-full flex items-center justify-between gap-3 text-left p-3.5 rounded-xl ring-1 transition-colors ${
              abiertoBajas ? 'bg-emerald-50 ring-emerald-200' : 'bg-slate-50 ring-slate-200 hover:bg-slate-100'
            }`}
            aria-expanded={abiertoBajas}
            aria-controls="bloque-bajas"
          >
            <span className="flex flex-col min-w-0">
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest leading-none flex items-center gap-1.5">
                <HeartPulse size={13} className="text-slate-400" /> Bajas este año
              </span>
              <span className="text-[10px] text-slate-400 font-medium mt-1.5 leading-tight truncate">
                {bajas.length > 0
                  ? `${bajas.length} ${bajas.length === 1 ? 'registrada' : 'registradas'} · toca para ${abiertoBajas ? 'cerrar' : 'editar'}`
                  : 'Afectan a lo que cobras según cuántas lleves'}
              </span>
            </span>
            <span className={`grid place-items-center w-7 h-7 rounded-full shrink-0 transition-all ${
              abiertoBajas ? 'bg-emerald-600 text-white rotate-180' : 'bg-white text-slate-500 ring-1 ring-slate-200'
            }`}>
              <ChevronDown size={16} />
            </span>
          </button>

          {abiertoBajas && (
            <div id="bloque-bajas" className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-[10px] text-slate-400 font-medium mb-3 leading-snug">
                Apunta cada proceso por separado. La primera baja del año se trata
                distinto que la segunda, y eso cambia lo que cobras.
              </p>

              {bajas.map((b, i) => (
                <div key={i} className="bg-slate-50 ring-1 ring-slate-200 rounded-xl p-3 mb-2.5">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="date" value={b.inicio || ''} onChange={(e) => cambiarBaja(i, 'inicio', e.target.value)}
                      className="flex-1 min-w-0 bg-white ring-1 ring-slate-200 p-2.5 rounded-lg text-[13px] outline-none text-slate-800 focus:ring-2 focus:ring-emerald-500"
                      aria-label={`Fecha de inicio de la baja ${i + 1}`}
                    />
                    <div className="relative w-24 shrink-0">
                      <input
                        type="number" min="1" step="1" placeholder="días" value={b.dias ?? ''}
                        onChange={(e) => cambiarBaja(i, 'dias', e.target.value)}
                        className="w-full bg-white ring-1 ring-slate-200 p-2.5 pr-8 rounded-lg text-[13px] outline-none text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        aria-label={`Días de la baja ${i + 1}`}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[13px] pointer-events-none">d</span>
                    </div>
                    <button
                      onClick={() => setBajas((bs) => bs.filter((_, j) => j !== i))}
                      className="px-1 text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                      aria-label={`Quitar la baja ${i + 1}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <select
                    value={b.tipo || TIPO_BAJA.COMUN} onChange={(e) => cambiarBaja(i, 'tipo', e.target.value)}
                    className="w-full bg-white ring-1 ring-slate-200 p-2.5 rounded-lg text-[13px] outline-none text-slate-800 focus:ring-2 focus:ring-emerald-500 mb-2"
                    aria-label={`Tipo de la baja ${i + 1}`}
                  >
                    <option value={TIPO_BAJA.COMUN}>Enfermedad común / accidente no laboral</option>
                    <option value={TIPO_BAJA.PROFESIONAL}>Accidente de trabajo / enf. profesional</option>
                  </select>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox" checked={Boolean(b.hospitalizacion)}
                      onChange={(e) => cambiarBaja(i, 'hospitalizacion', e.target.checked)}
                      className="w-4 h-4 rounded accent-emerald-600"
                    />
                    <span className="text-[11px] text-slate-500 font-medium leading-tight">
                      Con hospitalización o cirugía <span className="text-slate-400">(entonces cobras el 100% desde el día 1)</span>
                    </span>
                  </label>
                </div>
              ))}

              <button
                onClick={() => setBajas((bs) => [...bs, { inicio: '', dias: '', tipo: TIPO_BAJA.COMUN, hospitalizacion: false }])}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-500 text-[11px] font-black uppercase tracking-widest active:scale-[0.98] transition-transform"
              >
                <Plus size={14} /> Añadir baja
              </button>
            </div>
          )}
        </div>

        {/* IRPF. Es el ÚNICO dato de toda la nómina que la app no puede deducir:
            la retención depende de la situación personal de cada uno (hijos,
            estado civil, discapacidad…), y dos personas con el mismo sueldo
            tienen porcentajes distintos. Se copia de la propia nómina, que es
            donde viene escrito, en vez de intentar calcularlo y fallar. */}
        <div className="border-t border-slate-100 pt-4 mb-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Retención de IRPF</p>
          <p className="text-[10px] text-slate-400 font-medium mb-3 leading-snug">
            Míralo en tu última nómina, en la línea «I.R.P.F.»: es el porcentaje
            entre paréntesis. Depende de tu situación personal, así que no se puede calcular.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cfg-irpf" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tu porcentaje</label>
            <div className="relative">
              <input
                id="cfg-irpf" type="number" inputMode="decimal" min="0" max={IRPF_MAXIMO} step="0.01" placeholder="0,00"
                value={irpf} onChange={(e) => setIrpf(e.target.value)}
                className={`w-full bg-slate-50 ring-1 p-3 pr-9 rounded-xl text-sm outline-none text-slate-800 focus:ring-2 ${
                  irpfFueraDeRango ? 'ring-rose-300 focus:ring-rose-500' : 'ring-slate-200 focus:ring-emerald-500'
                }`}
                aria-invalid={irpfFueraDeRango}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">%</span>
            </div>
            {/* El `max` del input no valida nada por su cuenta: no hay <form>, se
                guarda con un onClick. Este aviso es el que de verdad lo caza. */}
            {irpfFueraDeRango && (
              <p className="text-[10px] text-rose-600 font-bold ml-1 leading-snug">
                Un {Number(irpf).toLocaleString('es-ES')}% no es posible: el máximo en España es el {IRPF_MAXIMO}%.
                ¿Querías escribir {(Number(irpf) / 100).toLocaleString('es-ES')}%?
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 mb-2">
          <CampoEuros id="cfg-prima" label="Prima Seg. Vida" valor={prima} onChange={setPrima} />
          <CampoEuros
            id="cfg-cuota" label="Cuota sindical" valor={cuota} onChange={setCuota}
            ayuda={`Solo si estás afiliado. Se descuenta de la nómina; lo habitual son ${eur(CUOTA_SINDICAL_POR_DEFECTO)} al mes. Si tienes baja el MES COMPLETO, no se paga: ponlo a 0 solo ese mes.`}
          />
        </div>

        {gr && (
          <div className="bg-emerald-50 rounded-xl px-3.5 py-3 mb-5">
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              Paga de Beneficios y de Fomento:{' '}
              <span className="font-black text-slate-700">{eur(Math.round(paga * 100) / 100)}</span> al mes cada una.
              <br />
              Verano y Navidad:{' '}
              <span className="font-black text-slate-700">{eur(Math.round(baseDePagas * 100) / 100)}</span> cada una.
            </p>
          </div>
        )}

        </div>

        {/* Fuera del área con scroll: siempre visible, sin tener que bajar a buscarlo. */}
        <div className="px-6 pb-6 pt-4 border-t border-slate-100 shrink-0 bg-white">
        <button
          onClick={() => onGuardar({
            grupo: g, cuatrienios: c,
            complementoPuesto: Number(puesto) || 0,
            compensacionFijaSr: Number(compSr) || 0,
            // Se descartan las filas vacías: se añaden con el botón y puede quedar
            // alguna sin rellenar. `nombre` vacío lo resuelve calcularNomina.
            complementos: comps
              .filter((x) => Number(x.importe) > 0)
              .map((x) => ({ nombre: (x.nombre || '').trim(), importe: Number(x.importe) })),
            horasNocturnas: Number(noct) || 0,
            bajas: bajas
              .filter((b) => b.inicio && Number(b.dias) > 0)
              .map((b) => ({
                inicio: b.inicio, dias: Number(b.dias),
                tipo: b.tipo || TIPO_BAJA.COMUN,
                hospitalizacion: Boolean(b.hospitalizacion),
              })),
            primaSegVida: Number(prima) || 0,
            cuotaSindical: Number(cuota) || 0,
            tipoIrpf: Number(irpf) || 0,
          })}
          disabled={!g || irpfFueraDeRango}
          className={`w-full bg-emerald-600 text-white py-3.5 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all ${!g || irpfFueraDeRango ? 'opacity-40' : ''}`}
        >
          {mesEtiqueta ? `Guardar ${mesEtiqueta}` : 'Guardar'}
        </button>
        </div>
      </div>
    </div>
  );
}
