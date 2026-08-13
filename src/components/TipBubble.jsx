import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { hapticLight } from '../utils/haptics';

// Respaldos estables para cuando aún no hay pasos decididos (ver más abajo).
const SIN_PASOS = [];
const PASO_VACIO = {};

/**
 * TipBubble — El bocadillo del tutorial: explica la pantalla que el usuario tiene
 * delante, atenuando la app e iluminando la parte de la que habla. Al cerrarlo,
 * la pantalla queda libre para mirarla con calma; el siguiente aviso llega solo,
 * cuando se abra otra pantalla (ver useScreenTips).
 *
 * Una pantalla puede explicarse de una vez o por partes: si el aviso trae `steps`,
 * el botón pasa a "Siguiente" y va recorriendo sus elementos uno a uno sin salir
 * de la pantalla (es lo que hace la Agenda: mensual → anual → días → festivos).
 *
 * A qué se le hace el foco, por orden:
 *   1. `step.target`  — cualquier selector CSS de la pantalla (data-tour="…").
 *   2. Si no lo hay   — la pestaña activa de la barra de abajo, buscando el
 *      aria-selected="true" que pone NavItem. Así vale aunque la barra cambie de
 *      pestañas según el rol (usuario, delegado, admin).
 *   3. `spotlight:false`, o si el elemento no está en pantalla — sin foco, y el
 *      bocadillo se coloca centrado.
 */
export function TipBubble({ tip, onDismiss }) {
  // Pasos que se van a contar de verdad. Los marcados `optional` se caen si su
  // elemento no está en pantalla: no todas las barras del Resumen existen para
  // todos los puestos (los días HA solo los tienen algunos, y ECI no tiene gráfico
  // todavía), y explicar algo que el usuario no ve solo confunde.
  //
  // Se calcula en un efecto, NO al construir el estado: durante el render la
  // pantalla de debajo aún no está en el DOM, así que preguntar por sus elementos
  // ahí devolvería que no existe ninguno y se caerían todos los pasos.
  const [steps, setSteps] = useState(null); // null = todavía sin decidir
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState(null);
  const [cardHeight, setCardHeight] = useState(0);
  const cardRef = useRef(null);
  const indexRef = useRef(0); // paso actual, legible desde los temporizadores
  const { pathname } = useLocation();

  // Los respaldos son constantes de módulo, no literales: creados aquí serían un
  // objeto nuevo en cada render y el efecto que mide el foco —que lleva `step` en
  // sus dependencias— se relanzaría sin parar.
  const list = steps || SIN_PASOS;
  const step = list[index] || list[0] || PASO_VACIO;
  const isLast = index === list.length - 1;

  useLayoutEffect(() => {
    const all = tip.steps || [tip];
    const calcular = () => all.filter((s) => !s.optional || (s.target && document.querySelector(s.target)));
    setSteps(calcular());

    // Hay pantallas que traen su contenido del servidor y tardan: el Censo del
    // delegado no tiene tarjetas de tienda hasta que responde la red, así que al
    // abrirse el aviso ese paso parecía no existir y se caía. Se vuelve a mirar un
    // par de veces por si aparece algo que al principio no estaba.
    //
    // Solo se acepta el cambio mientras el usuario sigue en el PRIMER paso: un
    // paso que reaparece se coloca en su sitio del guion, y si ya hubiera avanzado
    // le movería los pasos bajo los pies.
    const revisar = () => setSteps((previos) => {
      const ahora = calcular();
      return (indexRef.current === 0 && ahora.length > (previos?.length ?? 0)) ? ahora : previos;
    });
    const t1 = setTimeout(revisar, 400);
    const t2 = setTimeout(revisar, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [tip]);

  // Si no quedó ningún paso que enseñar (p. ej. el Resumen de ECI, que aún no tiene
  // gráfico), se da por visto y no se muestra nada, en vez de un bocadillo vacío.
  useEffect(() => {
    if (steps && steps.length === 0) onDismiss();
  }, [steps, onDismiss]);

  // Medida del foco.
  //
  // Se mide DOS veces a propósito: una ya mismo y otra dos frames después, cuando
  // la pantalla ha terminado de pintar. La primera es la que salva la situación si
  // los frames no llegan a correr —app en segundo plano, pestaña oculta—, que es
  // cuando requestAnimationFrame se queda congelado; la segunda deja el foco en su
  // sitio definitivo.
  useLayoutEffect(() => {
    if (tip.spotlight === false) { setTarget(null); return; }

    let raf1, raf2, timer;
    const find = () => (step.target
      ? document.querySelector(step.target)
      : document.querySelector('nav[role="tablist"] [role="tab"][aria-selected="true"]'));

    // Si lo que toca explicar está fuera de la parte visible (la Agenda es larga y
    // se desplaza), se trae a la vista. Sin animación: medir a mitad de un
    // desplazamiento suave da un recuadro que ya no vale cuando termina.
    //
    // Va DENTRO de measure a propósito: lo que crea `prepare` no existe hasta que
    // React procesa el cambio, así que la primera pasada no lo encuentra y solo lo
    // ve la medida diferida.
    const bring = (el) => {
      const r = el.getBoundingClientRect();
      if (r.top >= 8 && r.bottom <= window.innerHeight - 8) return;
      // Lo alto se alinea arriba, para que quede hueco debajo donde poner el
      // bocadillo; lo pequeño se centra, que se ve mejor.
      el.scrollIntoView({ block: r.height > window.innerHeight * 0.45 ? 'start' : 'center' });
    };

    const measure = () => {
      const el = find();
      if (!el) { setTarget(null); return; }
      if (step.target) bring(el);
      const r = el.getBoundingClientRect();
      setTarget({ left: r.left, top: r.top, width: r.width, height: r.height });
    };

    // Hay pasos que necesitan que la pantalla esté de una forma concreta para poder
    // enseñar algo: la ficha del día de la Agenda no existe hasta que hay un día
    // seleccionado, así que ese paso lo selecciona él (ver constants/screenTips).
    step.prepare?.();

    measure();
    raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(measure); });
    // Tercer intento fuera de los frames: lo que acaba de crear `prepare` no está
    // en el DOM hasta que React procesa ese cambio, y si los frames están
    // congelados (app en segundo plano) esta es la única medida que lo pilla.
    timer = setTimeout(measure, 0);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
      // Deshacer lo que preparó este paso, tanto al pasar al siguiente como al
      // cerrarse el aviso: la pantalla se queda como estaba.
      //
      // Aplazado a propósito: esto corre dentro del commit de React, y el cambio de
      // estado que provoca (deseleccionar el día) se pierde ahí. Fuera del commit
      // se aplica con normalidad. Comprobado: el clic se ejecutaba, pero la ficha
      // se quedaba abierta igualmente.
      if (step.cleanup) setTimeout(step.cleanup, 0);
    };
  }, [tip.spotlight, step, index, pathname]);

  useLayoutEffect(() => { indexRef.current = index; }, [index]);

  // Alto real del bocadillo: cambia con el texto de cada paso, y de él depende a
  // qué lado cabe. offsetHeight es medida de maquetación, así que no le afecta la
  // animación de entrada (que es una transformación).
  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [index, target]);

  const close = useCallback(() => { hapticLight(); onDismiss(); }, [onDismiss]);
  const next = useCallback(() => {
    hapticLight();
    if (isLast) onDismiss(); else setIndex((i) => i + 1);
  }, [isLast, onDismiss]);
  const back = useCallback(() => { hapticLight(); setIndex((i) => Math.max(0, i - 1)); }, []);

  // `null` = aún sin decidir qué pasos hay (un frame); vacío = nada que enseñar.
  if (list.length === 0) return null;

  const DIM = 'rgba(2,20,15,0.74)';

  // Colocación del bocadillo. Se mide su alto real (abajo, con cardRef) en vez de
  // suponerlo, porque de eso depende que quepa: se pone debajo de lo iluminado si
  // hay sitio, si no encima, y si lo iluminado es tan grande que no deja hueco a
  // ningún lado —la rejilla del mes ocupa media pantalla—, se queda flotando abajo
  // sin pico. Así nunca tapa lo que está explicando ni se sale de la pantalla.
  const GAP = 16;
  const height = cardHeight || 230; // primera pasada, antes de haberlo medido
  const spaceBelow = target ? window.innerHeight - (target.top + target.height) - GAP : 0;
  const spaceAbove = target ? target.top - GAP : 0;
  // `+ MARGEN`: que quepa justo no basta, tiene que quedar algo de aire por fuera
  // o el bocadillo acaba clavado en el borde de la pantalla. Poco margen a
  // propósito: pasarse de exigente lo manda a flotar, y flotando sí que tapa lo
  // que está explicando.
  const MARGEN = 8;
  const placement = !target ? 'floating'
    : spaceBelow >= height + MARGEN ? 'below'
      : spaceAbove >= height + MARGEN ? 'above'
        : 'floating';
  const placeBelow = placement === 'below';
  const bubblePosition = placement === 'below'
    ? { top: `${target.top + target.height + GAP}px` }
    : placement === 'above'
      ? { bottom: `${window.innerHeight - target.top + GAP}px` }
      : { bottom: 'calc(env(safe-area-inset-bottom) + 6.5rem)' };
  const showArrow = !!target && placement !== 'floating';
  // Borde izquierdo real del bocadillo (left-4, con ancho máximo y centrado), para
  // plantar el pico justo en el centro de lo iluminado.
  const bubbleLeft = Math.max(16, (window.innerWidth - 512) / 2);

  return (
    <div className="fixed inset-0 z-[130]" role="dialog" aria-modal="true" aria-label={tip.title}>
      {/* Capa que se come los toques: mientras el aviso está abierto, la app se ve
          pero no se toca (si no, se puede cambiar de pantalla por detrás). */}
      <div className="absolute inset-0" style={{ background: target ? 'transparent' : DIM }} />

      {/* Foco: el agujero lo hace la sombra gigante, así el resto de la pantalla
          queda atenuado de una pieza y lo explicado se ve nítido. */}
      {target && (
        <div
          className="fixed rounded-2xl pointer-events-none transition-all duration-300"
          style={{
            left: target.left, top: target.top, width: target.width, height: target.height,
            boxShadow: `0 0 0 9999px ${DIM}, 0 0 0 3px rgba(52,211,153,0.9)`,
          }}
          aria-hidden="true"
        />
      )}

      <div
        className="fixed left-4 right-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={bubblePosition}
      >
        <div
          ref={cardRef}
          className="relative max-w-md sm:max-w-lg mx-auto rounded-[1.75rem] p-5"
          style={{ background: 'linear-gradient(180deg,#ffffff,#f6f8fa)', boxShadow: '0 24px 60px rgba(0,0,0,0.45), inset 0 1.5px 1px rgba(255,255,255,0.9)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          {/* Pico apuntando a lo iluminado, arriba o abajo según dónde se haya puesto */}
          {showArrow && (
            <div
              className="absolute w-4 h-4 rotate-45"
              style={{
                left: `clamp(20px, ${target.left + target.width / 2 - bubbleLeft - 8}px, calc(100% - 36px))`,
                ...(placeBelow
                  ? { top: -8, background: '#ffffff', borderLeft: '1px solid rgba(16,185,129,0.2)', borderTop: '1px solid rgba(16,185,129,0.2)' }
                  : { bottom: -8, background: '#f6f8fa', borderRight: '1px solid rgba(16,185,129,0.2)', borderBottom: '1px solid rgba(16,185,129,0.2)' }),
              }}
              aria-hidden="true"
            />
          )}

          <div className="flex justify-between items-start gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {tip.icon && (
                <span
                  className="grid place-items-center w-9 h-9 rounded-xl text-white shrink-0"
                  style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 5px 12px rgba(5,150,105,0.4), inset 0 1px 1px rgba(255,255,255,0.5)' }}
                  aria-hidden="true"
                >
                  {tip.icon}
                </span>
              )}
              <h3 className="text-[13px] font-black text-slate-800 uppercase italic tracking-tight leading-tight min-w-0">{tip.title}</h3>
            </div>
            <button
              onClick={close}
              className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 active:scale-90 transition-all shrink-0"
              aria-label="Cerrar el aviso"
            >
              <X size={18} />
            </button>
          </div>

          <div className="text-[12.5px] text-slate-600 leading-relaxed space-y-2.5">{step.text}</div>

          <div className="flex items-center justify-between gap-3 mt-5">
            {/* Puntos de avance: solo cuando la pantalla se explica por partes */}
            {list.length > 1 ? (
              <div className="flex items-center gap-1.5 shrink-0" aria-label={`Paso ${index + 1} de ${list.length}`}>
                {list.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === index ? 18 : 6, height: 6,
                      background: i === index ? 'linear-gradient(90deg,#34d399,#059669)' : i < index ? '#a7f3d0' : '#e2e8f0',
                    }}
                  />
                ))}
              </div>
            ) : <span />}

            <div className="flex items-center gap-2 shrink-0">
              {index > 0 && (
                <button
                  onClick={back}
                  className="btn3d px-3.5 py-3 rounded-2xl text-slate-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5"
                  style={{ background: 'linear-gradient(180deg,#f1f3f5,#e2e5e9)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.08)' }}
                >
                  <ArrowLeft size={13} /> Atrás
                </button>
              )}
              <button
                onClick={next}
                className={`btn3d py-3.5 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 ${list.length > 1 ? 'px-5' : 'flex-1 w-full'}`}
                style={{ background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 8px 18px rgba(5,150,105,0.4), inset 0 1.5px 1px rgba(255,255,255,0.45)' }}
              >
                {isLast ? (tip.cta || 'Entendido') : 'Siguiente'} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
