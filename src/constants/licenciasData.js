// Permisos del convenio de ANGED (Grandes Almacenes), artículo 37 «Licencias
// retribuidas», según el texto publicado en el BOE del 9-jun-2023 (BOE-A-2023-13740).
// Solo valen para quien trabaja en una de sus empresas; el resto ve
// LICENCIAS_ET_CATEGORIES (el mínimo legal del Estatuto).
//
// El título de cada permiso lleva SU APARTADO del artículo (A, B, C…) para poder
// contrastarlo con el BOE. Ojo al tocar esto: los apartados E y F son permisos
// independientes, NO entran en la bolsa de 5 días del apartado H (estuvieron mal
// clasificados hasta el 22-ago-2026).
//
// Todos exigen previo aviso y justificación, y se retribuyen con el Salario Base
// de Grupo más los complementos personales.
export const LICENCIAS_CATEGORIES = [
  {
    id: "familiares",
    title: "1. Salud y Acontecimientos Familiares",
    subtitle: "Artículo 37, apartados A, B, C, D y F del convenio.",
    items: [
      {
        title: "Asistencia a Consultorio Médico (Art. 37.A)",
        duracion: "El tiempo preciso.",
        requisito: "Que por razón de enfermedad necesites acudir a consulta médica en horas que coincidan con tu jornada. Vale tanto la medicina pública como la privada, siempre que el facultativo esté habilitado.",
        documentacion: "Justificante de la consulta con el visado del facultativo."
      },
      {
        title: "Matrimonio (Art. 37.B)",
        duracion: "15 días naturales. El cómputo empieza en tu primer día laborable.",
        requisito: "Celebración del matrimonio. Se le puede sumar 1 día hábil más de la bolsa del apartado H.",
        documentacion: "Certificado o libro de familia que acredite el enlace."
      },
      {
        title: "Accidente Grave u Hospitalización de Familiares (Art. 37.C)",
        duracion: "5 días hábiles.",
        requisito: "Accidente grave u hospitalización de parientes hasta el 2º grado de consanguinidad o afinidad, en los supuestos no recogidos en el apartado D.",
        documentacion: "Parte de hospitalización o justificante médico."
      },
      {
        title: "Enfermedad Grave o Fallecimiento de Familiares (Art. 37.D)",
        duracion: "3 días hábiles. Si necesitas un desplazamiento superior a 300 km por trayecto, 5 días hábiles. Salir de una isla o de Ceuta y Melilla cuenta siempre como desplazamiento suficiente para la ampliación.",
        requisito: "Enfermedad grave diagnosticada por el facultativo, o fallecimiento de parientes hasta el 2º grado de consanguinidad o afinidad. Si el fallecido es tu cónyuge, hijo/a, hermano/a o padre/madre por consanguinidad, puedes sumarle hasta 2 días más de la bolsa del apartado H, hasta un máximo de 5 días en total.",
        documentacion: "Certificado de defunción o informe médico que acredite la gravedad. Para la ampliación, justificante del desplazamiento."
      },
      {
        title: "Matrimonio de Parientes (Art. 37.F)",
        duracion: "1 día hábil.",
        requisito: "Boda de parientes hasta el 2º grado de consanguinidad o afinidad.",
        documentacion: "Certificado o invitación oficial que acredite el enlace."
      }
    ]
  },
  {
    id: "traslado-estudios",
    title: "2. Traslado y Estudios",
    subtitle: "Artículo 37, apartados E y G del convenio.",
    items: [
      {
        title: "Traslado del Domicilio Habitual (Art. 37.E)",
        duracion: "1 día hábil.",
        requisito: "Mudanza de tu vivienda de residencia habitual.",
        documentacion: "Certificado de empadronamiento, contrato de alquiler o factura de la empresa de mudanzas."
      },
      {
        title: "Exámenes Finales de Estudios Oficiales (Art. 37.G)",
        duracion: "Las horas precisas para concurrir al examen.",
        requisito: "Exámenes finales, cursando estudios de carácter oficial o académico.",
        documentacion: "Justificación administrativa del centro que avale la solicitud."
      }
    ]
  },
  {
    id: "especiales",
    title: "3. Bolsa Anual de 5 Días (Art. 37.H)",
    subtitle: "Estos cinco supuestos comparten un tope conjunto: sumándolos todos, nunca puedes pasar de 5 días al año. Cada uno tiene además su propio límite.",
    items: [
      {
        title: "Ampliación por Fallecimiento de Familiar Directo (Art. 37.H.1)",
        duracion: "Hasta 2 días hábiles.",
        requisito: "Fallecimiento de tu cónyuge, hijo/a, o de hermanos/as y padres/madres por consanguinidad. Se acumulan a los 3 días del apartado D, hasta un máximo de 5 días en total.",
        documentacion: "Certificado de defunción."
      },
      {
        title: "Firma Notarial para Compra de Vivienda (Art. 37.H.2)",
        duracion: "1 día al año.",
        requisito: "Firma de documentos notariales necesarios para la adquisición de vivienda, siempre que tengas que hacerlo personalmente y coincida con tu horario de trabajo.",
        documentacion: "Justificante de presencia expedido por la notaría."
      },
      {
        title: "Acompañamiento a Urgencias Médicas (Art. 37.H.3)",
        duracion: "Hasta 8 horas al año.",
        requisito: "Acompañar a hijos/as menores de 15 años a una urgencia médica no previsible que coincida con tu horario. Alternativamente, puedes usar esas horas para acompañar a familiares de 1er grado dependientes o mayores de 70 años.",
        documentacion: "Justificante con el visado del facultativo, acreditando la urgencia y el tiempo empleado."
      },
      {
        title: "Día Adicional por Matrimonio Propio (Art. 37.H.4)",
        duracion: "1 día hábil.",
        requisito: "Tu propio matrimonio. Es acumulable a los 15 días naturales del apartado B.",
        documentacion: "Certificado o libro de familia que acredite el enlace."
      },
      {
        title: "Examen del Permiso de Conducir (Art. 37.H.5)",
        duracion: "1 día.",
        requisito: "Examen para la obtención por PRIMERA vez del permiso de conducir, siempre que coincida con tu horario de trabajo.",
        documentacion: "Justificante de asistencia al examen expedido por la DGT o la autoescuela."
      }
    ]
  },
  {
    id: "conciliacion",
    title: "4. Conciliación y Salud",
    items: [
      {
        title: "Bolsa de 20 horas (Acompañamiento Médico)",
        duracion: "Hasta 20 horas anuales.",
        requisito: "Asistencia a exámenes prenatales y técnicas de preparación al parto. Alternativamente, para acompañar a familiares de 1er grado (padres o hijos) dependientes o mayores de 70 años a consultas médicas.",
        documentacion: "Justificante de asistencia a la consulta médica o prueba diagnóstica con visado del facultativo."
      },
      {
        title: "Cuidado del Lactante",
        duracion: "1 hora diaria (divisible en dos fracciones) hasta que el hijo cumpla 9 meses. Puede acumularse en jornadas completas (aprox. 14-16 días laborables).",
        requisito: "Cuidado de hijo menor de 9 meses.",
        documentacion: "Libro de familia o certificado de nacimiento."
      }
    ]
  },
  {
    id: "deberes",
    title: "5. Cumplimiento de Deberes",
    items: [
      {
        title: "Deber Inexcusable Público y Personal",
        duracion: "El tiempo indispensable.",
        requisito: "Citaciones judiciales (testigo, perito), ejercicio del voto, renovación de DNI si no es posible fuera de horario, o asistencia a mesas electorales.",
        documentacion: "Citación oficial o certificado de asistencia expedido por el organismo competente."
      }
    ]
  }
];

// ─── Permisos del ESTATUTO DE LOS TRABAJADORES ──────────────────────────────
// Lo que ve quien trabaja fuera de ANGED: de su convenio no sabemos nada, así que
// se le enseña el MÍNIMO LEGAL, que le aplica seguro trabaje donde trabaje. Su
// convenio puede mejorarlo (nunca recortarlo), y de eso avisa LICENCIAS_ET_NOTA.
// Cada permiso lleva su artículo en el título para que pueda comprobarlo.
export const LICENCIAS_ET_CATEGORIES = [
  {
    id: "et-familiares",
    title: "1. Permisos por Motivos Personales y Familiares",
    subtitle: "Artículos 37.3 y 37.9 del Estatuto de los Trabajadores.",
    items: [
      {
        title: "Matrimonio o Registro de Pareja de Hecho (Art. 37.3.a)",
        duracion: "15 días naturales. Si el enlace cae en un día no laborable para ti, el cómputo empieza el primer día hábil siguiente.",
        requisito: "Celebración del matrimonio o inscripción oficial como pareja de hecho.",
        documentacion: "Certificado de matrimonio o certificación de inscripción en el registro de parejas de hecho."
      },
      {
        title: "Accidente o Enfermedad Grave, Hospitalización o Intervención (Art. 37.3.b)",
        duracion: "5 días.",
        requisito: "Accidente o enfermedad graves, hospitalización, o intervención quirúrgica sin hospitalización que precise reposo domiciliario. Alcanza al cónyuge o pareja de hecho, a los familiares hasta el 2º grado por consanguinidad o afinidad (incluido el familiar consanguíneo de la pareja de hecho) y a cualquier otra persona que conviva contigo en el mismo domicilio y necesite tu cuidado efectivo.",
        documentacion: "Justificante médico o parte de hospitalización o intervención donde conste la gravedad o la necesidad de reposo."
      },
      {
        title: "Fallecimiento de Familiar (Art. 37.3.b bis)",
        duracion: "2 días, ampliables a 4 si necesitas desplazarte.",
        requisito: "Fallecimiento del cónyuge, la pareja de hecho o parientes hasta el 2º grado de consanguinidad o afinidad.",
        documentacion: "Certificado de defunción. Para la ampliación, justificante del desplazamiento."
      },
      {
        title: "Traslado del Domicilio Habitual (Art. 37.3.c)",
        duracion: "1 día.",
        requisito: "Mudanza de tu vivienda de residencia habitual.",
        documentacion: "Certificado de empadronamiento, contrato de alquiler o factura de la empresa de mudanzas."
      },
      {
        title: "Exámenes Prenatales, Preparación al Parto y Adopción (Art. 37.3.f)",
        duracion: "El tiempo indispensable.",
        requisito: "Exámenes prenatales y cursos de técnicas de preparación al parto, y asistencia a sesiones informativas y preparación de informes psicosociales previos a la declaración de idoneidad en procesos de adopción, guarda o acogimiento. Siempre que deban celebrarse dentro de tu jornada laboral.",
        documentacion: "Justificante de asistencia expedido por el centro sanitario o el organismo competente."
      },
      {
        title: "Fuerza Mayor por Motivos Familiares Urgentes (Art. 37.9)",
        duracion: "Las horas equivalentes a un máximo de 4 días al año.",
        requisito: "Motivos familiares urgentes e imprevisibles, por enfermedad o accidente de familiares o personas convivientes, que hagan indispensable tu presencia inmediata.",
        documentacion: "Justificación posterior que acredite la urgencia."
      }
    ]
  },
  {
    id: "et-lactante",
    title: "2. Cuidado del Lactante y Nacimiento",
    subtitle: "Artículos 37.4 y 37.5 del Estatuto de los Trabajadores.",
    items: [
      {
        title: "Cuidado del Lactante (Art. 37.4)",
        duracion: "Hasta que el hijo o hija cumpla 9 meses. Se extiende hasta los 12 meses, con reducción proporcional del salario a partir del noveno, si ambos progenitores lo disfrutan con la misma duración.",
        requisito: "Puedes cogerlo de tres formas: 1 hora de ausencia al día (divisible en dos fracciones de media hora), reducción de media hora de la jornada al inicio o al final, o acumulado en jornadas completas. Desde el Real Decreto-ley 2/2024, la acumulación es un derecho individual e incondicionado.",
        documentacion: "Libro de familia o certificado de nacimiento."
      },
      {
        title: "Nacimiento Prematuro u Hospitalización tras el Parto (Art. 37.5)",
        duracion: "1 hora al día retribuida mientras dure la hospitalización.",
        requisito: "Nacimiento prematuro u hospitalización del recién nacido después del parto. Además tienes derecho a reducir la jornada hasta 2 horas más, estas con reducción proporcional del salario.",
        documentacion: "Informe o justificante de hospitalización expedido por el centro sanitario."
      }
    ]
  },
  {
    id: "et-deberes",
    title: "3. Deberes Públicos, Judiciales y Representación Sindical",
    items: [
      {
        title: "Deber Inexcusable de Carácter Público y Personal (Art. 37.3.d)",
        duracion: "El tiempo indispensable.",
        requisito: "Comparecencia en juicio como testigo o perito, mesa electoral, jurado popular, o renovación obligatoria del DNI cuando coincida con tu jornada.",
        documentacion: "Citación oficial o certificado de asistencia expedido por el organismo competente."
      },
      {
        title: "Funciones Sindicales o de Representación (Art. 37.3.e y Art. 68.e)",
        duracion: "El tiempo indispensable para desempeñarlas. Los delegados de personal y los miembros del comité de empresa disponen además de un crédito de entre 15 y 40 horas mensuales retribuidas, según el tamaño de la plantilla.",
        requisito: "Desempeño de funciones sindicales o de representación del personal, como las comisiones negociadoras de convenios colectivos.",
        documentacion: "Convocatoria o certificado del sindicato o del órgano de representación."
      }
    ]
  },
  {
    id: "et-formacion",
    title: "4. Formación y Desarrollo Profesional",
    subtitle: "Artículo 23 del Estatuto de los Trabajadores.",
    items: [
      {
        title: "Concurrencia a Exámenes (Art. 23.1.a)",
        duracion: "El tiempo necesario para acudir al examen.",
        requisito: "Cursar con regularidad estudios para la obtención de un título académico o profesional.",
        documentacion: "Certificado de matrícula y justificante de asistencia al examen sellado por el centro de estudios."
      },
      {
        title: "Formación Profesional Vinculada al Puesto (Art. 23.3)",
        duracion: "20 horas anuales, acumulables por periodos de hasta 5 años.",
        requisito: "Formación profesional vinculada a la actividad de la empresa, para quien tenga al menos un año de antigüedad.",
        documentacion: "Justificante de matrícula o de asistencia al curso."
      }
    ]
  }
];

// Aviso que acompaña SIEMPRE a los permisos del Estatuto: son un suelo, no un
// techo. Es la diferencia importante respecto a la lista del convenio de ANGED.
export const LICENCIAS_ET_NOTA =
  "Estos permisos son el mínimo legal que fija el Estatuto de los Trabajadores, así que te corresponden trabajes donde trabajes. El convenio colectivo de tu sector o de tu empresa puede mejorarlos o ampliarlos, pero nunca recortarlos: conviene que lo consultes, porque puede que te toque más de lo que ves aquí. Todos exigen previo aviso y justificación. Salvo los fijados en días naturales, como el matrimonio, los permisos de corta duración se cuentan en días laborables según jurisprudencia reiterada del Tribunal Supremo.";

export const GRADOS_CONSANGUINIDAD = [
  {
    grado: "Primer Grado",
    consanguinidad: "Padres e hijos.",
    afinidad: "Cónyuge o pareja de hecho, suegros (padres del cónyuge) y nueras/yernos (cónyuges de los hijos)."
  },
  {
    grado: "Segundo Grado",
    consanguinidad: "Abuelos, nietos y hermanos.",
    afinidad: "Cuñados (hermanos del cónyuge o cónyuges de los hermanos) y abuelos del cónyuge."
  },
  {
    grado: "Tercer Grado",
    consanguinidad: "Tíos, sobrinos, bisabuelos y biznietos.",
    afinidad: "Tíos y sobrinos del cónyuge."
  },
  {
    grado: "Cuarto Grado",
    consanguinidad: "Primos hermanos."
  }
];
