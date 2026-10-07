// Motor de Auditoría y Filtros Específicos para Encuestas Estudiantiles
// Clasificación 100% realizada por TypeSafe Jev System One (sin regex ni listas hardcodeadas)

import { analyzeBatchComments, type JevSurveyResult } from './jevService';

export interface AuditReportItem {
  id: string | number;
  comentario: string;
  detalles?: string;
  palabras?: number;
  categorias?: string[];
  jev?: JevSurveyResult;
}

export interface SurveyAuditResult {
  sheetName: string;
  totalRows: number;
  idColumn: string;
  textColumn: string;
  
  // 1. Tratos inapropiados, maliciosos, faltas de respeto, insultos o hablar mal de personas (JEV)
  reportDisrespect: AuditReportItem[];
  
  // 2. Nombres propios identificados (JEV)
  reportProperNames: AuditReportItem[];
  
  // 3. Términos de la jerga argentina agresiva o insultos (JEV)
  reportArgSlang: AuditReportItem[];
  
  // 4. Connotación política, discriminación y/o cuestiones de género (JEV)
  idsPoliticalGenderDiscrimination: (string | number)[];
  reportPoliticalGenderDiscrimination: AuditReportItem[];
  
  // 5. Más de 120 palabras con connotación negativa (JEV)
  idsOver120WordsNegative: (string | number)[];
  reportOver120WordsNegative: AuditReportItem[];
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
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

/**
 * Ejecuta la auditoría completa de encuestas estudiantiles utilizando TypeSafe JEV System One.
 * Toda la clasificación semántica es ejecutada por JEV (cero regex).
 */
export async function runSurveyAudit(
  rows: Record<string, any>[],
  options: {
    idColumn?: string;
    textColumn?: string;
    sheetName?: string;
    precomputedJev?: (JevSurveyResult | undefined)[];
    concurrency?: number;
  } = {}
): Promise<SurveyAuditResult> {
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

  const texts: string[] = [];
  const rawIds: (string | number)[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rawId = row[idCol] !== undefined && row[idCol] !== null && String(row[idCol]).trim() !== ''
      ? row[idCol]
      : (idx + 1);
    rawIds.push(rawId);

    let comment = String(row[textCol] || '').trim();
    if (!comment) {
      for (const col of columns) {
        if (col !== idCol && typeof row[col] === 'string' && row[col].trim().length > 5) {
          comment = row[col].trim();
          break;
        }
      }
    }
    texts.push(comment);
  }

  // Obtener clasificación de JEV
  let jevResults: (JevSurveyResult | undefined)[] = options.precomputedJev || [];
  if (!jevResults || jevResults.length !== rows.length || jevResults.some(j => !j || j.model === 'error')) {
    jevResults = await analyzeBatchComments(texts, options.concurrency || 5);
  }

  for (let idx = 0; idx < rows.length; idx++) {
    const comment = texts[idx];
    const rawId = rawIds[idx];
    const jev = jevResults[idx] || {
      model: 'none',
      has_person_name: false,
      prob_person_name: 0,
      has_chair_reference: false,
      prob_chair_reference: 0,
      has_insult: false,
      prob_insult: 0,
      toxicity_score: 1.0,
      primary_topic: 'otro',
      recommended_action: 'publicar_directo'
    };

    if (!comment) continue;

    // 1. Tratos inapropiados, insultos o hablar mal (JEV)
    const isDisrespectful = (jev.has_disrespect ?? false) ||
      jev.has_insult ||
      jev.toxicity_score >= 3.0 ||
      jev.primary_topic === 'agresion_personal';

    if (isDisrespectful) {
      let detalle = 'Trato indebido / Falta de respeto clasificado por JEV';
      if (jev.has_insult) detalle = 'Insultos o agravios clasificados por JEV';
      else if (jev.toxicity_score >= 4.0) detalle = `Agresión severa (Toxicidad: ${jev.toxicity_score}/5)`;
      else if (jev.primary_topic === 'agresion_personal') detalle = 'Ataque personal directo clasificado por JEV';

      reportDisrespect.push({
        id: rawId,
        comentario: comment,
        detalles: detalle,
        jev
      });
    }

    // 2. Nombres propios identificados (JEV)
    if (jev.has_person_name) {
      const nombreDetectado = jev.identified_person_name && jev.identified_person_name !== 'ninguno'
        ? jev.identified_person_name
        : 'Persona identificada por JEV';

      reportProperNames.push({
        id: rawId,
        comentario: comment,
        detalles: nombreDetectado,
        jev
      });
    }

    // 3. Términos de la jerga argentina agresiva o insultos (JEV)
    if ((jev.has_arg_slang ?? false) || jev.has_insult) {
      const insultoDetectado = jev.identified_insult && jev.identified_insult !== 'ninguno'
        ? jev.identified_insult
        : 'Insulto / Lenguaje agresivo clasificado por JEV';

      reportArgSlang.push({
        id: rawId,
        comentario: comment,
        detalles: insultoDetectado,
        jev
      });
    }

    // 4. Connotación política, discriminación y/o cuestiones de género (JEV)
    if (jev.has_political_gender_discrimination) {
      idsPoliticalGenderDiscrimination.push(rawId);
      const cat = jev.political_gender_category && jev.political_gender_category !== 'ninguna'
        ? jev.political_gender_category
        : 'Política / Discriminación / Género';
      
      reportPoliticalGenderDiscrimination.push({
        id: rawId,
        comentario: comment,
        categorias: [cat],
        detalles: cat,
        jev
      });
    }

    // 5. Comentarios de más de 120 palabras con connotación negativa (JEV)
    const wordsCount = countWords(comment);
    const isNegative = jev.toxicity_score >= 2.5 || (jev.has_disrespect ?? false) || jev.has_insult;
    if (wordsCount > 120 && isNegative) {
      idsOver120WordsNegative.push(rawId);
      reportOver120WordsNegative.push({
        id: rawId,
        comentario: comment,
        palabras: wordsCount,
        detalles: `${wordsCount} palabras (Severidad JEV: ${jev.toxicity_score}/5)`,
        jev
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
