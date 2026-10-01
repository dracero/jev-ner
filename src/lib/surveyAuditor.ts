// Motor de Auditoría y Filtros Específicos para Encuestas Estudiantiles

export interface AuditReportItem {
  id: string | number;
  comentario: string;
  detalles?: string;
  palabras?: number;
  categorias?: string[];
}

export interface SurveyAuditResult {
  sheetName: string;
  totalRows: number;
  idColumn: string;
  textColumn: string;
  
  // 1. Tratos inapropiados, maliciosos, faltas de respeto, insultos o hablar mal de personas
  reportDisrespect: AuditReportItem[];
  
  // 2. Nombres propios identificados
  reportProperNames: AuditReportItem[];
  
  // 3. Términos específicos de jerga argentina agresiva
  reportArgSlang: AuditReportItem[];
  
  // 4. Connotación política, discriminación y/o cuestiones de género (IDs uno por fila)
  idsPoliticalGenderDiscrimination: (string | number)[];
  reportPoliticalGenderDiscrimination: AuditReportItem[];
  
  // 5. Más de 120 palabras con connotación negativa (IDs uno por fila)
  idsOver120WordsNegative: (string | number)[];
  reportOver120WordsNegative: AuditReportItem[];
}

// 1. Jerga argentina agresiva (masculino, femenino, singular, plural y variantes inclusivas)
export const ARG_SLANG_PATTERNS = [
  { term: 'paja', regex: /\bpajas?\b/i },
  { term: 'pajero/a', regex: /\bpajer[oasx@]{1,2}\b/i },
  { term: 'boludo/a', regex: /\bbolud[oasx@]{1,2}\b/i },
  { term: 'forro/a', regex: /\bforr[oasx@]{1,2}\b/i },
  { term: 'mierda', regex: /\bmierdas?\b/i },
  { term: 'pelotudo/a', regex: /\bpelotud[oasx@]{1,2}\b/i },
  { term: 'mogólico/a', regex: /\bmog[oó]lic[oasx@]{1,2}\b/i },
  { term: 'estúpido/a', regex: /\best[uú]pid[oasx@]{1,2}\b/i },
  { term: 'garca', regex: /\bgarcas?\b/i },
  { term: 'choto/a', regex: /\bchot[oasx@]{1,2}\b/i },
  { term: 'sorete', regex: /\bsoretes?\b/i },
  { term: 'conchudo/a', regex: /\bconchud[oasx@]{1,2}\b/i },
  { term: 'puto/a', regex: /\bput[oasx@]{1,2}\b/i }
];

// 2. Patrones de trato inapropiado, malicioso, faltas de respeto o hablar mal de personas
export const DISRESPECT_PATTERNS = [
  /\b(?:in[uú]til(?:es)?|chantas?|desastre|verg[uü]enza|miserable|sinverg[uü]enza|impostor(?:a)?)\b/i,
  /\b(?:idiotas?|imb[eé]cil(?:es)?|tarad[oas]{1,2}|cretin[oas]{1,2}|basura|lacra)\b/i,
  /\b(?:trata como|nos trata|me trata|hizo llorar|humill[oó]|agresiv[oas]{1,2}|maltrat[oó]|violencia|maltrata)\b/i,
  /\b(?:cero paciencia|soberbi[oas]{1,2}|arrogante|sobrador(?:a)?|prepotent[ea]|acosador(?:a)?)\b/i,
  /\b(?:no explica nada|le importa nada|se caga en|burla|burl[oó]|forre[aá]|discrimina)\b/i,
  /\b(?:poco serio|muy poco serio|toma cualquier cosa|no vino a la mitad|no vino a clases|p[eé]simo trato)\b/i
];

// 3. Títulos y nombres propios (NER para encuestas)
const TITLES_REGEX = "(?:Prof(?:esor|esora)?\\.?|Docente|Ayudante|Titular|Adjunt[oa]|JTP|Ing(?:eniero|eniera)?\\.?|Lic(?:enciad[oa])?\\.?|Dr[a]?\\.?)";
const COMMON_NAMES = [
  "Juan", "Carlos", "María", "Maria", "José", "Jose", "Alejandro", "Martín", "Martin", "Pablo",
  "Diego", "Javier", "Facundo", "Nicolás", "Nicolas", "Federico", "Santiago", "Ignacio", "Lucas",
  "Agustín", "Agustin", "Gonzalo", "Mariano", "Esteban", "Lucía", "Lucia", "Camila", "Florencia",
  "Paula", "Ana", "Laura", "Sofia", "Sofía", "Valeria", "Julieta", "Carolina", "Daniela", "Micaela",
  "Guillermo", "Gustavo", "Eduardo", "Marcelo", "Jorge", "Horacio", "Raúl", "Raul", "Fernando"
];
const COMMON_SURNAMES = [
  "González", "Gonzalez", "Rodríguez", "Rodriguez", "Gómez", "Gomez", "Fernández", "Fernandez",
  "López", "Lopez", "Díaz", "Diaz", "Martínez", "Martinez", "Pérez", "Perez", "García", "Garcia",
  "Sánchez", "Sanchez", "Romero", "Sosa", "Álvarez", "Alvarez", "Torres", "Ruiz", "Ramírez", "Ramirez",
  "Flores", "Benítez", "Benitez", "Acosta", "Medina", "Herrera", "Aguirre", "Pereyra", "Gutiérrez", "Gutierrez",
  "Giménez", "Gimenez", "Molina", "Silva", "Castro", "Rojas", "Ortiz", "Núñez", "Nuñez", "Luna",
  "Juárez", "Juarez", "Cabrera", "Ríos", "Rios", "Morales", "Rossi", "Ferrari", "Bianchi", "Fontana"
];

const PROPER_NAME_PATTERNS = [
  new RegExp(`\\b${TITLES_REGEX}\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)`, 'g'),
  new RegExp(`\\b(?:${COMMON_NAMES.join('|')})\\s+(?:${COMMON_SURNAMES.join('|')})\\b`, 'g'),
  new RegExp(`\\b${TITLES_REGEX}\\s+(?:${COMMON_SURNAMES.join('|')})\\b`, 'g')
];

// 4. Política, Discriminación y Cuestiones de Género
export const POLITICAL_PATTERNS = [
  /\b(?:pol[ií]tica?|adoctrinamiento|partidari[oas]{1,2}|militan(?:te|cia)|la c[aá]mpora|c[aá]mpora)\b/i,
  /\b(?:kirchneris(?:ta|mo)|peronis(?:ta|mo)|libertari[oas]{1,2}|milei|cristina|macri|marxismo|comunismo)\b/i,
  /\b(?:zurd[oas]{1,2}|fach[oas]{1,2}|gorilas?|frente de izquierda|centro de estudiantes|elecciones)\b/i
];

export const DISCRIMINATION_PATTERNS = [
  /\b(?:discriminaci[oó]n|discrimina|xenofobi[ao]|racis(?:mo|ta)|clasista|capacitismo)\b/i,
  /\b(?:bolivian[oas]{1,2}|paraguay[oas]{1,2}|negro de mierda|villero|porteño de mierda)\b/i,
  /\b(?:discapacidad|retrasado|down|autista)\b/i
];

export const GENDER_PATTERNS = [
  /\b(?:machis(?:mo|ta)|patriarcad[o]|misogin[ioa]|sexista|acoso sexual|acosador(?:a)?)\b/i,
  /\b(?:feminazi|feminismo|ideolog[ií]a de g[eé]nero|transf[oó]b(?:ico|ia)|homof[oó]b(?:ico|ia))\b/i,
  /\b(?:por ser mujer|por ser hombre|cuestiones? de g[eé]nero|lenguaje inclusivo|inclusivo)\b/i
];

// 5. Connotación negativa para textos largos (> 120 palabras)
export const NEGATIVE_SENTIMENT_PATTERNS = [
  /\b(?:desastre|p[eé]simo|terrible|mal[ií]sim[oa]|inaceptable|in[uú]til|verg[uü]enza|estafa)\b/i,
  /\b(?:lamentable|decepcion(?:ante)?|fracaso|incompetente|horrible|odio|bronca|indignaci[oó]n)\b/i,
  /\b(?:abuso|maltrato|falta de respeto|prepotencia|arbitrari[oa]|intolerable|desorganizaci[oó]n)\b/i,
  /\b(?:abandono|desatenci[oó]n|antipedag[oó]gico|denunciar|cero empat[ií]a)\b/i
];

export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export function extractProperNames(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const pat of PROPER_NAME_PATTERNS) {
    pat.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pat.exec(text)) !== null) {
      found.add(match[0].trim());
    }
  }
  return Array.from(found);
}

export function extractArgSlang(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const item of ARG_SLANG_PATTERNS) {
    if (item.regex.test(text)) {
      found.push(item.term);
    }
  }
  return found;
}

export function hasDisrespect(text: string): boolean {
  if (!text) return false;
  if (extractArgSlang(text).length > 0) return true;
  return DISRESPECT_PATTERNS.some(p => p.test(text));
}

export function classifyPoliticalGenderDiscrimination(text: string): { matches: boolean; categories: string[] } {
  if (!text) return { matches: false, categories: [] };
  const categories: string[] = [];
  if (POLITICAL_PATTERNS.some(p => p.test(text))) categories.push('Política');
  if (DISCRIMINATION_PATTERNS.some(p => p.test(text))) categories.push('Discriminación');
  if (GENDER_PATTERNS.some(p => p.test(text))) categories.push('Cuestiones de Género');
  return {
    matches: categories.length > 0,
    categories
  };
}

export function hasNegativeSentiment(text: string): boolean {
  if (!text) return false;
  if (hasDisrespect(text)) return true;
  return NEGATIVE_SENTIMENT_PATTERNS.some(p => p.test(text));
}

export function detectIdColumn(columns: string[]): string {
  const candidateIdNames = ['id_encuesta', 'id', 'id_fila', 'identificador', 'numero', 'nro', '#', 'estudiante_id', 'codigo'];
  for (const candidate of candidateIdNames) {
    const match = columns.find(c => c.toLowerCase().trim() === candidate);
    if (match) return match;
  }
  const partialMatch = columns.find(c => c.toLowerCase().includes('id'));
  if (partialMatch) return partialMatch;
  return columns[0] || 'id';
}

export function runSurveyAudit(
  rows: Record<string, any>[],
  options: {
    idColumn?: string;
    textColumn?: string;
    sheetName?: string;
  } = {}
): SurveyAuditResult {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const idCol = options.idColumn || detectIdColumn(columns);
  const textCol = options.textColumn || 'comentario';
  const sheetName = options.sheetName || 'Comentarios 2026 1C';

  const reportDisrespect: AuditReportItem[] = [];
  const reportProperNames: AuditReportItem[] = [];
  const reportArgSlang: AuditReportItem[] = [];
  const idsPoliticalGenderDiscrimination: (string | number)[] = [];
  const reportPoliticalGenderDiscrimination: AuditReportItem[] = [];
  const idsOver120WordsNegative: (string | number)[] = [];
  const reportOver120WordsNegative: AuditReportItem[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rawId = row[idCol] !== undefined && row[idCol] !== null && String(row[idCol]).trim() !== ''
      ? row[idCol]
      : (idx + 1);
    
    // Find text content
    let comment = String(row[textCol] || '').trim();
    if (!comment) {
      // Fallback to first non-empty text column
      for (const col of columns) {
        if (col !== idCol && typeof row[col] === 'string' && row[col].trim().length > 5) {
          comment = row[col].trim();
          break;
        }
      }
    }

    if (!comment) continue;

    // 1. Tratos inapropiados, maliciosos, faltas de respeto, insultos o hablar mal
    if (hasDisrespect(comment)) {
      reportDisrespect.push({
        id: rawId,
        comentario: comment,
        detalles: 'Reporta falta de respeto, descalificación docente o trato indebido'
      });
    }

    // 2. Nombres propios identificados
    const names = extractProperNames(comment);
    if (names.length > 0) {
      reportProperNames.push({
        id: rawId,
        comentario: comment,
        detalles: names.join(', ')
      });
    }

    // 3. Términos de la jerga argentina agresiva
    const slangMatches = extractArgSlang(comment);
    if (slangMatches.length > 0) {
      reportArgSlang.push({
        id: rawId,
        comentario: comment,
        detalles: slangMatches.join(', ')
      });
    }

    // 4. Connotación política, discriminación y/o cuestiones de género
    const polGender = classifyPoliticalGenderDiscrimination(comment);
    if (polGender.matches) {
      idsPoliticalGenderDiscrimination.push(rawId);
      reportPoliticalGenderDiscrimination.push({
        id: rawId,
        comentario: comment,
        categorias: polGender.categories,
        detalles: polGender.categories.join(' / ')
      });
    }

    // 5. Comentarios de más de 120 palabras con connotación negativa
    const wordsCount = countWords(comment);
    if (wordsCount > 120 && hasNegativeSentiment(comment)) {
      idsOver120WordsNegative.push(rawId);
      reportOver120WordsNegative.push({
        id: rawId,
        comentario: comment,
        palabras: wordsCount,
        detalles: `${wordsCount} palabras (connotación negativa)`
      });
    }
  }

  return {
    sheetName,
    totalRows: rows.length,
    idColumn: idCol,
    textColumn: textCol,
    reportDisrespect,
    reportProperNames,
    reportArgSlang,
    idsPoliticalGenderDiscrimination,
    reportPoliticalGenderDiscrimination,
    idsOver120WordsNegative,
    reportOver120WordsNegative
  };
}
