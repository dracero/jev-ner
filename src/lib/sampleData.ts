export interface SurveyRecord {
  id_encuesta: number;
  estudiante_id: string;
  materia: string;
  comision: string;
  comentario: string;
  calificacion_general: number;
}

export const SAMPLE_SURVEY: SurveyRecord[] = [
  {
    id_encuesta: 101,
    estudiante_id: "EST-2024-001",
    materia: "Algoritmos y Estructuras de Datos",
    comision: "K2051",
    comentario: "El profesor Juan Perez de Algoritmos es un desastre y un idiota, nunca explica nada y no responde dudas.",
    calificacion_general: 2
  },
  {
    id_encuesta: 102,
    estudiante_id: "EST-2024-002",
    materia: "Sistemas Operativos",
    comision: "K3012",
    comentario: "Excelente cursada en Sistemas Operativos. Los trabajos prácticos fueron muy claros y aprendí un montón.",
    calificacion_general: 9
  },
  {
    id_encuesta: 103,
    estudiante_id: "EST-2024-003",
    materia: "Física I",
    comision: "K1023",
    comentario: "La docente María Gómez de Física I tiene cero paciencia, es una forra que nos trata como imbéciles a todos.",
    calificacion_general: 1
  },
  {
    id_encuesta: 104,
    estudiante_id: "EST-2024-004",
    materia: "Análisis Matemático II",
    comision: "K2001",
    comentario: "Los parciales de Análisis Matemático II estuvieron bien planteados pero faltó tiempo para resolver el ejercicio 4.",
    calificacion_general: 7
  },
  {
    id_encuesta: 105,
    estudiante_id: "EST-2024-005",
    materia: "Arquitectura de Computadoras",
    comision: "K2042",
    comentario: "El Ing. Martínez no vino a la mitad de las clases y después toma cualquier cosa en el examen. Muy poco serio.",
    calificacion_general: 3
  },
  {
    id_encuesta: 106,
    estudiante_id: "EST-2024-006",
    materia: "Bases de Datos",
    comision: "K3055",
    comentario: "Me encantó la materia. Las explicaciones en las clases teóricas ayudaron mucho para el proyecto final.",
    calificacion_general: 10
  },
  {
    id_encuesta: 107,
    estudiante_id: "EST-2024-007",
    materia: "Química General",
    comision: "K1011",
    comentario: "El ayudante Nicolás Fernández fue súper atento en el laboratorio, pero la cátedra de Química General está desorganizada con las fechas de entrega.",
    calificacion_general: 6
  },
  {
    id_encuesta: 108,
    estudiante_id: "EST-2024-008",
    materia: "Ingeniería de Software",
    comision: "K4021",
    comentario: "Una pérdida de tiempo total, la titular es una chanta inútil que se pasa hablando de su vida personal en lugar del temario.",
    calificacion_general: 2
  },
  {
    id_encuesta: 109,
    estudiante_id: "EST-2024-009",
    materia: "Álgebra Lineal",
    comision: "K1005",
    comentario: "Sería muy bueno que actualicen las guías de ejercicios de Álgebra Lineal porque tienen varias erratas en las respuestas.",
    calificacion_general: 8
  },
  {
    id_encuesta: 110,
    estudiante_id: "EST-2024-010",
    materia: "Paradigmas de Programación",
    comision: "K2031",
    comentario: "Excelente el campus virtual y el material de lectura. Se agradece la enorme dedicación y respeto del equipo docente.",
    calificacion_general: 10
  }
];
