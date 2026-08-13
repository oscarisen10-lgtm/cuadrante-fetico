import { Sparkles, PieChart, Clock, Calendar, FileText, Settings, Newspaper, ClipboardList } from 'lucide-react';

/**
 * Textos del tutorial. NO es un recorrido lineal: cada pantalla tiene su propio
 * aviso y salta la primera vez que el usuario entra en ella, así puede mirar la
 * pantalla con calma en cuanto lo cierra.
 *
 * `id` es lo que se guarda como "ya visto" en el dispositivo: no lo cambies sin
 * querer o el aviso volverá a salir a todo el mundo.
 *
 * El texto va en JSX a propósito, para poder marcar en negrita las tres o cuatro
 * palabras que de verdad importan de cada pantalla.
 */

/** Lo primero que se ve al estrenar la app. Sin foco: no habla de ninguna pestaña. */
export const WELCOME_TIP = {
  id: 'welcome',
  icon: <Sparkles size={17} />,
  title: 'Bienvenido/a a Mi Cuadrante',
  cta: 'Siguiente',
  spotlight: false,
  text: (
    <>
      <p>
        Mi Cuadrante es una herramienta de <strong>gestión personal de turnos</strong>: te ayuda a
        organizar tu cuadrante y a llevar tu propio control de horas.
      </p>
      <p>
        <strong>No sustituye</strong> a la aplicación oficial ni al sistema de registro de jornada
        de la empresa o entidad en la que trabajas. Los fichajes y registros que hagas aquí tienen
        carácter <strong>exclusivamente personal</strong>.
      </p>
    </>
  ),
};

/** Aviso de cada pantalla, por su ruta. Sin entrada aquí, esa pantalla no avisa de nada. */
export const SCREEN_TIPS = {
  // El Resumen se explica barra por barra. Los pasos `optional` desaparecen si esa
  // barra no existe para el puesto del usuario (los días HA y los findes de calidad
  // no los tienen todos los rangos); si no queda ninguna —ECI, que aún no tiene
  // gráfico, o cuentas que solo ven noticias—, el aviso no llega a salir.
  '/dashboard': {
    id: 'dashboard',
    icon: <PieChart size={17} />,
    title: 'Resumen',
    steps: [
      {
        target: '[data-tour="res-horas"]',
        optional: true,
        text: (
          <p>
            Tu punto de partida: cada barra enfrenta <strong>lo que llevas realizado</strong> con el{' '}
            <strong>máximo que debes cumplir</strong>, según tu convenio. Esta son las{' '}
            <strong>horas anuales</strong> que llevas registradas.
          </p>
        ),
      },
      {
        target: '[data-tour="res-trabajados"]',
        optional: true,
        text: (
          <p>
            Los <strong>días trabajados</strong>: los que tienen jornada registrada, sobre el total
            que te corresponde en el año.
          </p>
        ),
      },
      {
        target: '[data-tour="res-libres"]',
        optional: true,
        text: (
          <p>
            Los <strong>días libres</strong> que has marcado en la Agenda, sobre los que te
            corresponden.
          </p>
        ),
      },
      {
        target: '[data-tour="res-ha"]',
        optional: true,
        text: (
          <p>
            Los <strong>días HA</strong>: las jornadas que superan las 8 h 30 min. Tu convenio marca
            cuántas puedes hacer al año.
          </p>
        ),
      },
      {
        target: '[data-tour="res-calidad"]',
        optional: true,
        text: (
          <p>
            Los <strong>findes de calidad</strong>: sábado y domingo libres seguidos. Justo debajo
            tienes el desglose entre los <strong>cortos</strong> y los <strong>largos</strong>, que
            dependen de tu puesto.
          </p>
        ),
      },
      {
        target: '[data-tour="res-domingos"]',
        optional: true,
        text: (
          <p>
            Y los <strong>domingos y festivos</strong> que has trabajado, sobre el máximo anual.
          </p>
        ),
      },
    ],
  },
  '/track': {
    id: 'track',
    icon: <Clock size={17} />,
    title: 'Fichar',
    steps: [
      {
        target: '[data-tour="fichar-boton"]',
        text: (
          <p>
            Desde aquí registras tu jornada: este botón la <strong>inicia</strong> y la{' '}
            <strong>cierra</strong>. Púlsalo al entrar y el registro del día se pone en marcha.
          </p>
        ),
      },
      {
        target: '[data-tour="fichar-contador"]',
        text: (
          <p>
            El contador va sumando tu <strong>jornada laboral</strong>, y justo debajo tienes su
            estado: reloj parado, jornada en curso o descanso activo.
          </p>
        ),
      },
      {
        target: '[data-tour="fichar-descanso"]',
        text: (
          <p>
            Con la jornada en marcha puedes activar el <strong>tiempo de descanso</strong>, de 15 a
            60 minutos. La pausa <strong>no computa</strong> como tiempo de trabajo: el contador se
            detiene y vuelve a correr cuando regreses.
          </p>
        ),
      },
      {
        // Se ilumina la pestaña de Agenda: es donde acaba lo que se acaba de registrar.
        // Si esa pestaña no está (modo delegado o admin), no se ilumina nada y el
        // bocadillo se queda centrado.
        target: 'nav[role="tablist"] [role="tab"][aria-label^="Agenda"]',
        text: (
          <p>
            Al finalizar la jornada, el registro se suma a tus <strong>horas anuales</strong> y
            queda reflejado en tu <strong>calendario laboral</strong>.
          </p>
        ),
      },
    ],
  },
  // La Agenda se explica por partes: cada paso ilumina un elemento distinto de la
  // misma pantalla (los data-tour están puestos en CalendarView).
  '/calendar': {
    id: 'calendar',
    icon: <Calendar size={17} />,
    title: 'Agenda',
    steps: [
      {
        target: '[data-tour="cal-mensual"]',
        text: (
          <p>
            Tu calendario laboral <strong>mes a mes</strong>: las horas de cada jornada, los días
            libres, las vacaciones y los festivos, cada cosa con su color.
          </p>
        ),
      },
      {
        target: '[data-tour="cal-anual"]',
        text: (
          <p>
            El mismo registro con una <strong>visión anual</strong> más amplia: los doce meses de un
            vistazo, para ver de un golpe cómo queda repartido tu año.
          </p>
        ),
      },
      {
        target: '#calendar-grid',
        text: (
          <p>
            Toca <strong>uno o varios días</strong> para seleccionarlos. Puedes marcar varios de
            golpe y aplicarles lo mismo a todos de una vez.
          </p>
        ),
      },
      {
        // La ficha del día no existe hasta que hay algo seleccionado, así que este
        // paso selecciona un día él mismo y lo suelta al terminar. Se comprueba
        // antes de tocar nada: al volver atrás y avanzar otra vez, un segundo clic
        // sobre el mismo día lo DESseleccionaría y la ficha desaparecería.
        target: '[data-tour="cal-panel"]',
        prepare: () => {
          if (document.querySelector('[data-tour="cal-panel"]')) return;
          document.querySelector('#calendar-grid button[role="gridcell"]')?.click();
        },
        cleanup: () => {
          document.querySelector('[data-tour="cal-panel"] [aria-label="Deseleccionar fechas"]')?.click();
        },
        text: (
          <p>
            Ahí tienes su <strong>ficha</strong>: el estado y las horas del día, y los botones para
            marcarlo <strong>libre</strong> o de <strong>vacaciones</strong>,{' '}
            <strong>ajustar las horas</strong> y el turno, o borrar el registro.
          </p>
        ),
      },
      {
        target: '[data-tour="cal-festivos"]',
        text: (
          <p>
            Y al final, el <strong>calendario de festivos</strong> del año: nacionales, regionales y
            los locales que corresponden a tu tienda.
          </p>
        ),
      },
    ],
  },
  '/licencias': {
    id: 'licencias',
    icon: <FileText size={17} />,
    title: 'Permisos',
    steps: [
      {
        // La primera licencia, no la lista entera: iluminar los cuatro apartados
        // de golpe daría un foco de media pantalla, y además así se señala justo
        // lo que hay que tocar para desplegarla.
        target: '[data-tour="lic-item"]',
        text: (
          <p>
            Las <strong>licencias y permisos</strong> que recoge tu convenio, agrupadas por tipo.
            Despliega cualquiera y verás su <strong>duración</strong>, el <strong>requisito</strong>{' '}
            para pedirla y la <strong>documentación</strong> que tendrás que presentar.
          </p>
        ),
      },
      {
        target: '[data-tour="lic-grados"]',
        text: (
          <p>
            La <strong>guía de grados de parentesco</strong>: quién entra en cada grado por
            consanguinidad y por afinidad. Es la referencia para saber si un familiar te da derecho
            a la licencia.
          </p>
        ),
      },
      {
        target: '[data-tour="lic-fuente"]',
        text: (
          <p>
            Y si el texto se te queda pequeño, ajústalo con <strong>A−</strong> y{' '}
            <strong>A+</strong>. El tamaño que elijas se guarda en tu dispositivo.
          </p>
        ),
      },
    ],
  },
  '/settings': {
    id: 'settings',
    icon: <Settings size={17} />,
    title: 'Ajustes',
    steps: [
      {
        target: '[data-tour="set-puesto"]',
        text: (
          <p>
            Tu <strong>empresa, puesto, tienda y sección</strong>. De aquí salen los objetivos de
            convenio que ves en el Resumen y los festivos locales de tu calendario, así que mantenlo
            al día si cambias de destino.
          </p>
        ),
      },
      {
        target: '[data-tour="set-sync"]',
        text: (
          <p>
            La <strong>sincronización</strong> es la que te trae los avisos y las noticias de tu
            delegado. Si aparece el botón «Permitir», tenlo activado para no perderte nada.
          </p>
        ),
      },
      {
        target: '[data-tour="set-descanso"]',
        text: (
          <p>
            Los <strong>minutos de descanso</strong>: es la duración que tendrá la pausa cuando la
            actives en Fichar.
          </p>
        ),
      },
      {
        target: '[data-tour="set-biometrico"]',
        text: (
          <p>
            Con el <strong>bloqueo biométrico</strong>, la app te pedirá tu huella o FaceID cada vez
            que la abras. Tu jornada y tus registros quedan a resguardo.
          </p>
        ),
      },
      {
        // Solo lo tienen los delegados: si no está el interruptor, el paso se cae.
        target: '[data-tour="set-delegado"]',
        optional: true,
        text: (
          <p>
            El <strong>Modo Delegado</strong>: encendido trabajas como delegado, con tus pestañas de
            Noticias y Censo. Apagado ves la app como un usuario más, para fichar tu propia jornada.
          </p>
        ),
      },
      {
        target: '[data-tour="set-tutorial"]',
        text: (
          <p>
            Y desde aquí puedes <strong>volver a ver este tutorial</strong> entero, las veces que
            quieras.
          </p>
        ),
      },
    ],
  },

  // ── Pantallas de delegado ──
  // Solo existen para quien lo es (App.jsx redirige al resto), así que no hace
  // falta filtrar por rol aquí. Todos los pasos son prescindibles: un delegado sin
  // tiendas asignadas no tiene ni botones ni listado que enseñar, y en ese caso la
  // propia pantalla ya le dice que hable con el administrador.
  '/delegados': {
    id: 'delegados',
    icon: <Newspaper size={17} />,
    title: 'Noticias',
    steps: [
      {
        target: '[data-tour="del-nueva"]',
        optional: true,
        text: (
          <p>
            Publica un <strong>comunicado para tus tiendas</strong>: aparece en el Resumen de tus
            afiliados, firmado con tu nombre. Puedes acompañarlo de una foto y elegir a qué tiendas
            va dirigido.
          </p>
        ),
      },
      {
        target: '[data-tour="del-push"]',
        optional: true,
        text: (
          <p>
            El <strong>push</strong> va aparte: la noticia se queda en el Resumen sin avisar a
            nadie, y esto sí les llega al <strong>móvil</strong> como notificación. Solo a los
            usuarios de las tiendas que marques.
          </p>
        ),
      },
      {
        target: '[data-tour="del-publicaciones"]',
        optional: true,
        text: (
          <p>
            Aquí tienes <strong>lo que has publicado</strong>, con las tiendas a las que fue
            dirigido. Desde el icono rojo puedes borrar cualquiera, y desaparecerá del Resumen de
            tus afiliados.
          </p>
        ),
      },
    ],
  },
  '/censo': {
    id: 'censo',
    icon: <ClipboardList size={17} />,
    title: 'Censo',
    steps: [
      {
        target: '[data-tour="censo-total"]',
        optional: true,
        text: (
          <p>
            La <strong>afiliación de tus tiendas</strong>: los que ya tienen la app, los futuros que
            apuntes a mano y el porcentaje sobre el censo. La marca de la barra es el{' '}
            <strong>objetivo del 30 %</strong>.
          </p>
        ),
      },
      {
        target: '[data-tour="censo-tienda"]',
        optional: true,
        text: (
          <p>
            Cada tienda con su porcentaje. <strong>Ábrela</strong> y verás sus usuarios: ahí es donde{' '}
            <strong>activas las cuentas nuevas</strong> con su interruptor, y donde puedes apuntar
            futuros afiliados a mano.
          </p>
        ),
      },
      {
        target: '[data-tour="censo-actualizar"]',
        optional: true,
        text: (
          <p>
            Y <strong>Actualizar</strong> vuelve a contar desde el servidor, por si alguien acaba de
            instalarse la app.
          </p>
        ),
      },
    ],
  },
};
