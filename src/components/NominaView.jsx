import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, FileText, SlidersHorizontal, HeartPulse, PiggyBank, FilePlus2 } from 'lucide-react';
import { eur, num4 } from '../constants/nomina';
import {
  calcularNominaDelMes, calcularDeducciones, netoPagaExtra, configDelMes, guardarMes,
} from '../constants/nominaCalculo';
import { calcularIT } from '../constants/nominaBajas';
import { ModalConfigNomina } from './nomina/ModalConfigNomina';

/**
 * NominaView — Pestaña "Nómina" del ADMIN (ocupa el hueco de "Permisos" en Modo Admin).
 *
 * ESTADO: devengos y deducciones se calculan ya ENTEROS a partir de lo que el
 * usuario configura; no queda ninguna cifra de ejemplo en pantalla. Contrastado
 * línea a línea contra tres nóminas reales (ver los tests de nomina.test.js).
 *
 * Mientras esté a medias vive SOLO para el admin (ver la ruta en App.jsx), así se
 * puede publicar sin que lo vea nadie más.
 */


const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/** Cabecera gris de cada bloque. */
function SeccionTitulo({ children }) {
  return (
    <div className="bg-slate-100 px-4 py-3">
      <h3 className="text-[13px] font-black text-slate-700 tracking-tight">{children}</h3>
    </div>
  );
}

/** Fila concepto → importe, con su línea de detalle opcional debajo. */
function Fila({ concepto, detalle, importe, fuerte = false, calculado = false }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
      <div className="flex flex-col min-w-0">
        <span className="text-[14px] text-slate-800 leading-tight">
          {concepto}
          {/* Marca los conceptos que ya salen de la configuración del usuario, para
              distinguirlos de un vistazo de los que todavía son de ejemplo. */}
          {calculado && <span className="ml-1.5 text-emerald-600" title="Calculado con tu configuración">•</span>}
        </span>
        {detalle && (
          <span className="text-[11px] text-slate-400 leading-tight mt-1">
            {'unidades' in detalle ? (
              <>{detalle.unidades} | <span className="font-bold text-slate-500">{num4(detalle.precio)}€</span></>
            ) : (
              <>({detalle.pct.toLocaleString('es-ES')}% {detalle.base.toLocaleString('es-ES', { minimumFractionDigits: 2, useGrouping: true })})</>
            )}
          </span>
        )}
      </div>
      <span className={`text-[15px] tabular-nums whitespace-nowrap ${fuerte ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>
        {eur(importe)}
      </span>
    </div>
  );
}

/** Fila de total, sobre fondo verde. */
function FilaTotal({ importe }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-emerald-50">
      <span className="text-[14px] font-black text-slate-800">Total:</span>
      <span className="text-[15px] font-black text-slate-900 tabular-nums">{eur(importe)}</span>
    </div>
  );
}

export const NominaView = React.memo(function NominaView({ user, saveToCloud }) {
  const [fecha, setFecha] = useState(() => new Date(2026, 7, 1)); // agosto 2026
  const [configAbierta, setConfigAbierta] = useState(false);

  // Sin `|| {}`: ese objeto nuevo en cada render haría que el useMemo de abajo se
  // recalculara siempre y no memoizara nada. calcularNomina ya tolera undefined.
  const nominaGuardada = user?.nomina;
  const anioVisto = fecha.getFullYear();
  const mesVisto = fecha.getMonth();

  // Cada mes tiene su propia nómina guardada: la nocturnidad cambia, la cuota
  // sindical se deja de pagar algún mes… Si este mes no se ha guardado todavía,
  // `cfg` es null y en vez de la tabla se enseña el aviso de "sin guardar" — antes
  // se repetía la misma nómina en los doce meses.
  const cfg = useMemo(
    () => configDelMes(nominaGuardada, anioVisto, mesVisto),
    [nominaGuardada, anioVisto, mesVisto],
  );
  const nomina = useMemo(
    () => calcularNominaDelMes(cfg, anioVisto, mesVisto),
    [cfg, anioVisto, mesVisto],
  );
  // Para el formulario: lo del mes si ya está guardado, y si no lo último que se
  // usó, para no tener que reescribirlo entero cada mes.
  const cfgFormulario = cfg || { ...(nominaGuardada || {}), meses: undefined };
  const yaConfigurado = Boolean(nominaGuardada?.grupo);

  // Deducciones REALES: las cuatro de cotización salen de los tipos de ley del
  // año que se mira (el MEI cambia cada año), el IRPF del porcentaje que copia
  // el usuario de su nómina, y la especie de la Prima Seg. Vida.
  const dedu = useMemo(
    () => (nomina ? calcularDeducciones({
      baseCotizacion: nomina.baseCotizacion,
      // El IRPF va sobre lo devengado de VERDAD, así que con baja baja también.
      totalDevengos: nomina.totalDevengos,
      tipoIrpf: Number(cfg?.tipoIrpf) || 0,
      cuotaSindical: Number(cfg?.cuotaSindical) || 0,
      primaSegVida: Number(cfg?.primaSegVida) || 0,
    }, anioVisto) : null),
    [nomina, cfg?.tipoIrpf, cfg?.cuotaSindical, cfg?.primaSegVida, anioVisto],
  );

  const liquido = (nomina?.totalDevengos || 0) + (dedu?.total || 0);

  // Aviso de "cuántas bajas llevas ESTE AÑO". Se filtran las de otros años a
  // propósito: el convenio numera "1.ª, 2.ª baja del año NATURAL", así que una
  // baja de 2025 no puede sumar como "segunda" a una de 2026 — cada año empieza
  // a contar de cero. (El Complemento 50/53 de enero SÍ mira el año anterior,
  // pero eso lo hace calcularNominaDelMes por su cuenta, no este aviso.)
  const bajasDelAnio = useMemo(
    () => (cfg?.bajas || []).filter((b) => b?.inicio && Number(b.inicio.slice(0, 4)) === anioVisto),
    [cfg?.bajas, anioVisto],
  );
  const it = useMemo(
    () => (nomina ? calcularIT(bajasDelAnio, {
      salarioDiario: nomina.salarioDiario,
      baseDiaria: nomina.baseCotizacion / 30,
    }) : null),
    [bajasDelAnio, nomina],
  );

  const mover = (salto) => setFecha((f) => new Date(f.getFullYear(), f.getMonth() + salto, 1));

  // Guardar SIEMPRE guarda el mes que se está viendo. Es lo que hace que julio y
  // agosto puedan ser distintos.
  const guardar = (valores) => {
    saveToCloud?.({ profile: { nomina: guardarMes(nominaGuardada, valores, anioVisto, mesVisto) } });
    setConfigAbierta(false);
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300 pb-20">

      {/* Cabecera: mes con flechas. La imagen de referencia traía una "X" de cerrar
          porque allí es un detalle que se abre desde una lista; aquí es una pestaña
          fija, así que ese hueco lo ocupa el navegador de meses. */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-slate-100 text-slate-500 shrink-0">
            <FileText size={17} />
          </span>
          {MESES[fecha.getMonth()]} {fecha.getFullYear()}
        </h2>
        <div className="flex gap-1.5">
          <button onClick={() => mover(-1)} className="p-2 rounded-xl bg-slate-100 text-slate-500 active:scale-95 transition-transform" aria-label="Mes anterior"><ChevronLeft size={18} /></button>
          <button onClick={() => mover(1)} className="p-2 rounded-xl bg-slate-100 text-slate-500 active:scale-95 transition-transform" aria-label="Mes siguiente"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-tight text-amber-700 leading-snug">
          {!nomina
            ? (yaConfigurado
                ? `Todavía no has guardado la nómina de ${MESES[mesVisto].toLowerCase()}.`
                : 'Configura tu nómina para calcular lo que cobras.')
            : Number(cfg?.tipoIrpf) > 0
              ? 'Calculado con las tablas del convenio y tus datos. Compáralo con tu nómina: si no cuadra, pregunta.'
              : 'Falta tu porcentaje de IRPF: sin él, el líquido sale más alto de lo real.'}
        </p>
      </div>

      <div className="bg-emerald-50 rounded-2xl py-7 px-4 text-center">
        <span className="text-[13px] text-slate-600 font-medium">Líquido a percibir</span>
        <div className="text-[34px] font-black text-slate-900 tracking-tight leading-none mt-2 tabular-nums">
          {eur(liquido)}
        </div>
      </div>

      {/* Distinto del aviso de abajo, y con otro color a propósito: aquel dice
          "te lo van a pagar", este dice "esto que ves ya es ese pago". Sale con
          calcularNominaDelMes, que solo lo activa en enero y mirando el año
          ANTERIOR — no puede solaparse con el aviso de "retenido", que mira el
          año que se está viendo. */}
      {nomina?.complemento5053 > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
            <PiggyBank size={18} />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-black text-emerald-900 leading-tight">
              Incluye {eur(nomina.complemento5053)} de tu baja del año pasado
            </span>
            <span className="text-[11px] text-emerald-800 leading-snug mt-1">
              Es el Complemento 50 (Regularización IT): los tres primeros días que
              se retuvieron entonces, ya devueltos porque no volviste a coger la baja.
            </span>
          </div>
        </div>
      )}

      {/* Los tres primeros días de la PRIMERA baja del año se descuentan ya, pero
          vuelven en la nómina de enero si no hay una segunda. Casi nadie lo sabe,
          y es dinero suyo: por eso va destacado y no escondido en una tabla. */}
      {it?.retenido > 0 && it.recuperable && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-amber-100 text-amber-700 shrink-0">
            <PiggyBank size={18} />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-black text-amber-900 leading-tight">
              Tienes {eur(it.retenido)} retenidos
            </span>
            <span className="text-[11px] text-amber-800 leading-snug mt-1">
              Son los tres primeros días de tu baja. Los cobras en la nómina de enero
              <strong> si no vuelves a coger la baja este año</strong>; si hay una segunda, se pierden.
            </span>
          </div>
        </div>
      )}

      {/* Y si ya se han perdido, también hay que decirlo: es lo que explica que la
          nómina venga más corta de lo que uno esperaba. */}
      {it?.perdido > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-rose-100 text-rose-700 shrink-0">
            <HeartPulse size={18} />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-black text-rose-900 leading-tight">
              Dejas de cobrar {eur(it.perdido)} por las bajas
            </span>
            <span className="text-[11px] text-rose-800 leading-snug mt-1">
              {it.totalComunes > 1
                ? `Llevas ${it.totalComunes} bajas comunes este año: a partir de la segunda, los tres primeros días no se recuperan.`
                : 'Los tramos que el convenio no complementa al 100%.'}
            </span>
          </div>
        </div>
      )}

      {/* Sin nómina de ESTE mes pero con otros guardados: no es que falte configurar,
          es que falta confirmar este mes. Se explica el porqué (la nocturnidad y
          demás cambian) para que no parezca que la app ha perdido los datos. */}
      {!nomina && yaConfigurado && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center text-center gap-2">
          <span className="grid place-items-center w-11 h-11 rounded-2xl bg-white ring-1 ring-slate-200 text-slate-400">
            <FilePlus2 size={20} />
          </span>
          <span className="text-[14px] font-black text-slate-700 leading-tight mt-1">
            Sin guardar la nómina de {MESES[mesVisto].toLowerCase()}
          </span>
          <span className="text-[11px] text-slate-500 leading-snug max-w-[17rem]">
            Cada mes se guarda por separado, porque no todos son iguales: cambian las
            horas nocturnas, algún complemento o la cuota sindical. Abre la
            configuración —ya viene con lo último que pusiste— y dale a Guardar.
          </span>
          <button
            onClick={() => setConfigAbierta(true)}
            className="mt-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-transform"
          >
            Guardar la de {MESES[mesVisto].toLowerCase()}
          </button>
        </div>
      )}

      <button
        onClick={() => setConfigAbierta(true)}
        className="w-full flex items-center justify-center gap-2 py-3 text-slate-700 active:scale-[0.98] transition-transform"
        aria-label="Configurar los datos de tu nómina"
      >
        <SlidersHorizontal size={17} />
        <span className="text-[15px] font-bold underline underline-offset-4">Configurar nómina</span>
      </button>

      {nomina && (
        <>
          <div className="rounded-2xl overflow-hidden border border-slate-100">
            <SeccionTitulo>Devengos</SeccionTitulo>
            {nomina.devengos.map((d) => <Fila key={d.concepto} {...d} calculado />)}
            <FilaTotal importe={nomina.totalDevengos} />
          </div>

          <div className="rounded-2xl overflow-hidden border border-slate-100">
            <SeccionTitulo>Deducciones</SeccionTitulo>
            {dedu.lineas.map((d) => <Fila key={d.concepto} {...d} calculado />)}
            <FilaTotal importe={dedu.total} />
          </div>

          <div className="rounded-2xl overflow-hidden border border-slate-100">
            <SeccionTitulo>Bases de cotización para la Seguridad Social</SeccionTitulo>
            <Fila concepto="Total devengos computables" detalle={null} importe={nomina.totalDevengosComputables} />
            <Fila concepto="Prorrata pagas extraordinarias" detalle={null} importe={nomina.prorrataPagas} />
            <Fila concepto="T. Computable de S.S." detalle={null} importe={nomina.baseCotizacion} fuerte />
            {nomina.diasBaja > 0 && (
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-[10px] text-slate-400 font-medium leading-snug">
                  Este mes tienes {nomina.diasBaja} días de baja: la base de cotización
                  se mantiene como si el mes hubiera sido completo, aunque los devengos
                  de arriba estén reducidos a {nomina.diasOrdinarios} días.
                </p>
              </div>
            )}
          </div>

          {/* Verano y Navidad NO son devengo mensual: se cobran enteras en su mes.
              Se enseñan aparte para que se vea el año completo sin confundirlas con
              lo que entra en la nómina de este mes. */}
          <div className="rounded-2xl overflow-hidden border border-slate-100">
            <SeccionTitulo>Pagas extra (no prorrateadas)</SeccionTitulo>
            {[['Paga de Verano', nomina.pagaVerano], ['Paga de Navidad', nomina.pagaNavidad]].map(([nombre, bruto]) => {
              const pe = netoPagaExtra(bruto, cfg?.tipoIrpf);
              return (
                <div key={nombre} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14px] text-slate-800 leading-tight">{nombre}</span>
                    <span className="text-[11px] text-slate-400 leading-tight mt-1">
                      Bruto {eur(pe.bruto)}
                      {pe.irpf > 0 && <> · IRPF −{eur(pe.irpf)}</>}
                    </span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[15px] font-bold text-slate-800 tabular-nums whitespace-nowrap">{eur(pe.neto)}</span>
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none mt-1">Neto</span>
                  </div>
                </div>
              );
            })}
            <div className="px-4 py-3 bg-slate-50">
              <p className="text-[10px] text-slate-400 font-medium leading-snug">
                Se cobran enteras en su mes, no cada mes. Aun así cotizan repartidas
                todo el año: por eso suman {eur(nomina.prorrataPagas)} a la base de cotización de arriba
                {Number(cfg?.tipoIrpf) > 0
                  ? ' — y por eso al neto solo se le resta el IRPF, no la Seguridad Social: esa ya está pagada mes a mes.'
                  : '. Pon tu porcentaje de IRPF para ver el neto.'}
              </p>
            </div>
          </div>
        </>
      )}

      {configAbierta && (
        <ModalConfigNomina
          cfg={cfgFormulario} mesEtiqueta={`${MESES[mesVisto]} ${anioVisto}`}
          onGuardar={guardar} onCerrar={() => setConfigAbierta(false)}
        />
      )}
    </div>
  );
});
