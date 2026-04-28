export const LICENCIAS_CATEGORIES = [
  {
    id: "familiares",
    title: "1. Licencias por Acontecimientos Familiares y Vitales",
    items: [
      {
        title: "Matrimonio o Registro de Pareja de Hecho",
        duracion: "15 días naturales.",
        requisito: "Celebración del matrimonio o inscripción oficial en el Registro de Parejas de Hecho.",
        documentacion: "Certificado de matrimonio o certificación de inscripción en el registro correspondiente."
      },
      {
        title: "Accidente, Enfermedad Grave u Hospitalización",
        duracion: "5 días hábiles.",
        requisito: "Accidente, enfermedad grave, hospitalización o intervención quirúrgica sin hospitalización que precise reposo domiciliario. Afecta a cónyuge, pareja de hecho, parientes hasta el 2º grado (padres, hijos, abuelos, hermanos, nietos, suegros, cuñados) y convivientes.",
        documentacion: "Justificante médico o parte de hospitalización/intervención donde conste la gravedad o la necesidad de reposo."
      },
      {
        title: "Fallecimiento de Familiar",
        duracion: "2 días (ampliables a 4 días si requiere desplazamiento).",
        requisito: "Muerte del cónyuge, pareja de hecho o parientes hasta el 2º grado de consanguinidad o afinidad.",
        documentacion: "Certificado de defunción o esquela oficial. Para la ampliación, justificante del desplazamiento (billetes de transporte o prueba de residencia del fallecido)."
      },
      {
        title: "Fuerza Mayor Familiar (Urgencia Imprevista)",
        duracion: "Hasta 4 días laborables al año (se puede disfrutar por horas).",
        requisito: "Motivos familiares urgentes e imprevisibles (enfermedad o accidente) que hagan indispensable la presencia inmediata del trabajador.",
        documentacion: "Justificación posterior que acredite la urgencia (informe de urgencias, llamada del colegio, parte de siniestro en el hogar)."
      }
    ]
  },
  {
    id: "conciliacion",
    title: "2. Licencias de Conciliación y Salud",
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
    id: "especiales",
    title: "3. Bolsa de Licencias Especiales (Art. 37.H)",
    subtitle: "El convenio permite un máximo de 5 días al año para los siguientes supuestos combinados:",
    items: [
      {
        title: "Traslado de Domicilio Habitual",
        duracion: "1 día.",
        requisito: "Mudanza de la vivienda de residencia permanente.",
        documentacion: "Certificado de empadronamiento, contrato de alquiler o factura de la empresa de mudanzas."
      },
      {
        title: "Matrimonio de Parientes",
        duracion: "1 día hábil.",
        requisito: "Boda de familiares hasta el 2º grado de consanguinidad o afinidad.",
        documentacion: "Certificado o invitación oficial que acredite el evento."
      },
      {
        title: "Examen de Conducir",
        duracion: "1 día.",
        requisito: "Realización del examen para la obtención por primera vez del permiso de conducir, coincidiendo con la jornada laboral.",
        documentacion: "Justificante de asistencia al examen expedido por la DGT o la autoescuela."
      },
      {
        title: "Firma de Documentos Notariales",
        duracion: "1 día al año.",
        requisito: "Asistencia personal a firmas ante notario necesarias para la adquisición de la vivienda habitual.",
        documentacion: "Justificante de presencia expedido por la notaría."
      }
    ]
  },
  {
    id: "deberes",
    title: "4. Cumplimiento de Deberes y Formación",
    items: [
      {
        title: "Deber Inexcusable Público y Personal",
        duracion: "El tiempo indispensable.",
        requisito: "Citaciones judiciales (testigo, perito), ejercicio del voto, renovación de DNI si no es posible fuera de horario, o asistencia a mesas electorales.",
        documentacion: "Citación oficial o certificado de asistencia expedido por el organismo competente."
      },
      {
        title: "Exámenes de Estudios Oficiales",
        duracion: "El tiempo necesario para concurrir a los exámenes.",
        requisito: "Cursar con regularidad estudios para la obtención de un título académico o profesional oficial.",
        documentacion: "Certificado de matriculación y justificante de asistencia al examen sellado por el centro de estudios."
      }
    ]
  }
];

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
