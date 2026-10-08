import dotenv from 'dotenv';
dotenv.config();

import { traceable, getCurrentRunTree } from './langsmith';

export interface JevSurveyResult {
  model: string;
  has_person_name: boolean;
  prob_person_name: number;
  identified_person_name?: string;
  has_chair_reference: boolean;
  prob_chair_reference: number;
  identified_chair_name?: string;
  has_insult: boolean;
  prob_insult: number;
  identified_insult?: string;
  has_arg_slang?: boolean;
  prob_arg_slang?: number;
  has_disrespect?: boolean;
  prob_disrespect?: number;
  has_political_gender_discrimination?: boolean;
  prob_political_gender_discrimination?: number;
  political_gender_category?: string;
  toxicity_score: number;
  primary_topic: string;
  recommended_action: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: string;
}

export function getJevApiKey(): string {
  return process.env.JEV_API_KEY || (import.meta as any).env?.JEV_API_KEY || '';
}

/**
 * Extrae fragmentos y frases del texto sin regexes ni diccionarios fijos,
 * para que TypeSafe JEV clasifique inteligentemente nombres, cátedras e insultos.
 */
export function extractTextChunks(text: string): string[] {
  if (!text) return [];
  const words = text
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/[.,;:()¿?¡!"'«»]/g, '').trim())
    .filter(w => w.length >= 2);

  const chunks = new Set<string>();

  // Palabras individuales
  for (const w of words) {
    chunks.add(w);
  }

  // Frases de 2 y 3 palabras consecutivas (ej. "Juan Perez", "Sistemas Operativos", "María Gómez")
  for (let i = 0; i < words.length - 1; i++) {
    chunks.add(`${words[i]} ${words[i + 1]}`);
    if (i + 2 < words.length) {
      chunks.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  // Ordenar priorizando mayúsculas o longitud
  const sorted = Array.from(chunks).sort((a, b) => {
    const aCap = /^[A-ZÁÉÍÓÚÑ]/.test(a) ? 1 : 0;
    const bCap = /^[A-ZÁÉÍÓÚÑ]/.test(b) ? 1 : 0;
    return bCap - aCap || b.length - a.length;
  });

  return sorted.slice(0, 15);
}

export function buildSurveyQuestions(text: string): Record<string, any> {
  const chunks = extractTextChunks(text);

  const critPerson: Record<string, string> = { ninguno: 'No se menciona ninguna persona en particular' };
  const critChair: Record<string, string> = { ninguna: 'No se menciona ninguna materia o cátedra' };
  const critInsult: Record<string, string> = { ninguno: 'No contiene insultos ni términos ofensivos' };

  for (const c of chunks) {
    critPerson[c] = `Término del texto: "${c}"`;
    critChair[c] = `Término del texto: "${c}"`;
    critInsult[c] = `Término del texto: "${c}"`;
  }

  const questions: Record<string, any> = {
    has_person_name: {
      type: 'noul',
      instructions: '¿El texto menciona nombres o apellidos de personas particulares (profesores, ayudantes, alumnos, directivos)?'
    },
    identified_person_name: {
      type: 'choice',
      instructions: '¿Cuál de las siguientes opciones corresponde al nombre o apellido de la persona mencionada?',
      criteria: critPerson
    },
    has_chair_reference: {
      type: 'noul',
      instructions: '¿El texto menciona una cátedra, materia o asignatura específica?'
    },
    identified_chair_name: {
      type: 'choice',
      instructions: '¿Cuál de las siguientes opciones es la cátedra o materia mencionada?',
      criteria: critChair
    },
    has_insult: {
      type: 'noul',
      instructions: '¿El texto contiene insultos, agravios, descalificaciones agresivas o lenguaje vulgar?'
    },
    identified_insult: {
      type: 'choice',
      instructions: '¿Cuál es el insulto o término ofensivo presente en el texto?',
      criteria: critInsult
    },
    has_arg_slang: {
      type: 'noul',
      instructions: '¿El texto contiene términos de jerga o modismos argentinos descalificadores o agresivos (como pelotudo, forro, boludo, choto, sorete, conchudo, mierda, paja, etc.)?'
    },
    has_disrespect: {
      type: 'noul',
      instructions: '¿El texto reporta faltas de respeto, maltrato, descalificaciones o agresiones hacia o por parte de docentes o personas?'
    },
    has_political_gender_discrimination: {
      type: 'noul',
      instructions: '¿El texto contiene contenido de política partidaria, militancia, discriminación o cuestiones de género / acoso?'
    },
    political_gender_category: {
      type: 'choice',
      instructions: 'Si el texto contiene temática de política, discriminación o género, ¿cuál es la categoría principal?',
      criteria: {
        ninguna: 'No contiene ninguna de estas temáticas',
        politica: 'Política partidaria, militancia o adoctrinamiento',
        discriminacion: 'Discriminación por nacionalidad, origen o aspecto',
        genero: 'Cuestiones de género, acoso o trato machista/sexista'
      }
    },
    toxicity_level: {
      type: 'score',
      instructions: 'Nivel de severidad o agresividad del comentario del estudiante',
      criteria: [
        'Constructivo o neutral sin agresiones',
        'Crítica moderada o descontento leve',
        'Queja vehemente sin insultos graves',
        'Ataque personal o falta de respeto',
        'Insultos directos, agravios o violencia verbal explícita'
      ]
    },
    primary_topic: {
      type: 'choice',
      instructions: 'Categoría o motivo principal del comentario',
      criteria: {
        docencia: 'Calidad pedagógica, trato o desempeño de profesores',
        contenidos: 'Dificultad, temas, bibliografía o programa de la materia',
        evaluaciones: 'Exámenes parciales, finales o corrección de trabajos',
        organizacion: 'Horarios, comunicación, cupos o gestión de la cátedra',
        infraestructura: 'Aulas, laboratorios, campus virtual o recursos',
        agresion_personal: 'Agresión personal, agravios o descalificaciones directas',
        positivo_general: 'Elogios, agradecimientos o experiencia satisfactoria'
      }
    },
    recommended_action: {
      type: 'choice',
      instructions: 'Acción de moderación recomendada para publicación pública de la encuesta',
      criteria: {
        publicar_directo: 'Apto para publicar sin modificaciones (no tiene nombres, insultos ni datos sensibles)',
        anonimizar_nombres: 'Contiene nombres de personas que deben ser protegidos/anonimizados',
        anonimizar_catedra: 'Contiene mención de cátedra específica que debe anonimizarse',
        censurar_insultos: 'Contiene insultos o lenguaje inapropiado que debe ser redactado',
        descartar: 'Comentario no publicable por agresión severa, difamación o violencia'
      }
    }
  };

  return questions;
}

/**
 * Ejecuta la llamada directa al motor TypeSafe JEV System One.
 * Registrada como invocación 'llm' en LangSmith con schema, tokens y latencia.
 */
export const callJevSystemOne = traceable(
  async function callJevSystemOne(
    state: string,
    questions: Record<string, any>,
    apiKey: string
  ): Promise<{ model?: string; answers?: Record<string, any>; usage?: { input_tokens: number; output_tokens: number } }> {
    const runTree = getCurrentRunTree();

    const res = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'jev-latest',
        state: state.trim(),
        questions
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Jev API Error (${res.status}): ${errText}`);
    }

    const data = await res.json();

    if (runTree && data.usage) {
      runTree.extra = {
        ...runTree.extra,
        metadata: {
          ...runTree.extra?.metadata,
          model: data.model || 'jev-latest',
          input_tokens: data.usage.input_tokens,
          output_tokens: data.usage.output_tokens,
          total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
        }
      };
    }

    return data;
  },
  {
    name: 'jev_system_one_inference',
    run_type: 'llm',
    tags: ['typesafe-jev', 'system-one', 'ner', 'per', 'moderation']
  }
);

/**
 * Clasifica y analiza un comentario individual de encuesta mediante TypeSafe Jev System One.
 * Traced como 'chain' en LangSmith conteniendo la inferencia del modelo y su resolución semántica.
 */
export const analyzeSurveyComment = traceable(
  async function analyzeSurveyComment(text: string): Promise<JevSurveyResult> {
    const runTree = getCurrentRunTree();
    const apiKey = getJevApiKey();
    if (!apiKey) {
      throw new Error('JEV_API_KEY no encontrada en las variables de entorno.');
    }

    if (!text || !text.trim()) {
      return {
        model: 'none',
        has_person_name: false,
        prob_person_name: 0.0,
        has_chair_reference: false,
        prob_chair_reference: 0.0,
        has_insult: false,
        prob_insult: 0.0,
        has_arg_slang: false,
        prob_arg_slang: 0.0,
        has_disrespect: false,
        prob_disrespect: 0.0,
        has_political_gender_discrimination: false,
        prob_political_gender_discrimination: 0.0,
        political_gender_category: 'ninguna',
        toxicity_score: 1.0,
        primary_topic: 'positivo_general',
        recommended_action: 'publicar_directo'
      };
    }

    try {
      const questions = buildSurveyQuestions(text.trim());
      const data = await callJevSystemOne(text.trim(), questions, apiKey);
      const answers = data.answers || {};

      const probPerson = answers.has_person_name?.noul ?? 0.0;
      const probChair = answers.has_chair_reference?.noul ?? 0.0;
      const probInsult = answers.has_insult?.noul ?? 0.0;
      const probArgSlang = answers.has_arg_slang?.noul ?? 0.0;
      const probDisrespect = answers.has_disrespect?.noul ?? 0.0;
      const probPolGender = answers.has_political_gender_discrimination?.noul ?? 0.0;
      const polGenderCategory = answers.political_gender_category?.choice || 'ninguna';

      let identifiedPersonName: string | undefined = undefined;
      if (answers.identified_person_name && answers.identified_person_name.choice !== 'ninguno') {
        identifiedPersonName = answers.identified_person_name.choice;
      }

      let identifiedChairName: string | undefined = undefined;
      if (answers.identified_chair_name && answers.identified_chair_name.choice !== 'ninguna') {
        identifiedChairName = answers.identified_chair_name.choice;
      }

      let identifiedInsult: string | undefined = undefined;
      if (answers.identified_insult && answers.identified_insult.choice !== 'ninguno') {
        identifiedInsult = answers.identified_insult.choice;
      }

      const toxAnswer = answers.toxicity_level;
      const rawTox = toxAnswer?.score ?? 0.0;
      const normalizedTox = rawTox <= 4.0 ? Math.round((rawTox + 1.0) * 100) / 100 : Math.round(rawTox * 100) / 100;

      let primaryTopic = answers.primary_topic?.choice || 'docencia';
      let recommendedAction = answers.recommended_action?.choice || 'publicar_directo';

      if (probInsult >= 0.7 || normalizedTox >= 4.0 || probDisrespect >= 0.8) {
        recommendedAction = normalizedTox >= 4.5 ? 'descartar' : 'censurar_insultos';
      } else if (probPerson >= 0.5) {
        recommendedAction = 'anonimizar_nombres';
      } else if (probChair >= 0.7 && recommendedAction === 'publicar_directo') {
        recommendedAction = 'anonimizar_catedra';
      }

      const result: JevSurveyResult = {
        model: data.model || 'jev-1.13.0',
        has_person_name: probPerson >= 0.5,
        prob_person_name: Math.round(probPerson * 1000) / 1000,
        identified_person_name: identifiedPersonName,
        has_chair_reference: probChair >= 0.5,
        prob_chair_reference: Math.round(probChair * 1000) / 1000,
        identified_chair_name: identifiedChairName,
        has_insult: probInsult >= 0.5,
        prob_insult: Math.round(probInsult * 1000) / 1000,
        identified_insult: identifiedInsult,
        has_arg_slang: probArgSlang >= 0.5,
        prob_arg_slang: Math.round(probArgSlang * 1000) / 1000,
        has_disrespect: probDisrespect >= 0.5,
        prob_disrespect: Math.round(probDisrespect * 1000) / 1000,
        has_political_gender_discrimination: probPolGender >= 0.5,
        prob_political_gender_discrimination: Math.round(probPolGender * 1000) / 1000,
        political_gender_category: polGenderCategory,
        toxicity_score: normalizedTox,
        primary_topic: primaryTopic,
        recommended_action: recommendedAction,
        usage: data.usage
      };

      if (runTree) {
        runTree.extra = {
          ...runTree.extra,
          metadata: {
            ...runTree.extra?.metadata,
            model: result.model,
            toxicity_score: result.toxicity_score,
            primary_topic: result.primary_topic,
            recommended_action: result.recommended_action,
            has_person_name: result.has_person_name,
            identified_person_name: result.identified_person_name,
            has_chair_reference: result.has_chair_reference,
            identified_chair_name: result.identified_chair_name,
            has_insult: result.has_insult,
            identified_insult: result.identified_insult,
            has_arg_slang: result.has_arg_slang,
            has_disrespect: result.has_disrespect,
            has_political_gender_discrimination: result.has_political_gender_discrimination
          }
        };
      }

      return result;
    } catch (err: any) {
      return {
        model: 'error',
        has_person_name: false,
        prob_person_name: 0.0,
        has_chair_reference: false,
        prob_chair_reference: 0.0,
        has_insult: false,
        prob_insult: 0.0,
        toxicity_score: 1.0,
        primary_topic: 'error',
        recommended_action: 'revisar_manual',
        error: err?.message || 'Error desconocido'
      };
    }
  },
  {
    name: 'jev_analyze_survey_comment',
    run_type: 'chain',
    tags: ['typesafe-jev', 'survey-moderation']
  }
);

/**
 * Procesa un lote de comentarios en paralelo controlado.
 * Traced como 'chain' en LangSmith agregando métricas globales del lote.
 */
export const analyzeBatchComments = traceable(
  async function analyzeBatchComments(
    texts: string[],
    concurrency = 5
  ): Promise<JevSurveyResult[]> {
    const runTree = getCurrentRunTree();
    const results: JevSurveyResult[] = new Array(texts.length);
    let currentIndex = 0;

    async function worker() {
      while (currentIndex < texts.length) {
        const idx = currentIndex++;
        results[idx] = await analyzeSurveyComment(texts[idx]);
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, texts.length) }, () => worker());
    await Promise.all(workers);

    if (runTree) {
      const approvedCount = results.filter(r => r.recommended_action === 'publicar_directo').length;
      const flaggedCount = results.length - approvedCount;
      const avgTox = results.length > 0
        ? Math.round((results.reduce((acc, r) => acc + (r.toxicity_score || 1), 0) / results.length) * 100) / 100
        : 1.0;
      runTree.extra = {
        ...runTree.extra,
        metadata: {
          ...runTree.extra?.metadata,
          total_comments: texts.length,
          concurrency,
          approved_direct: approvedCount,
          flagged_or_censored: flaggedCount,
          avg_toxicity: avgTox
        }
      };
    }

    return results;
  },
  {
    name: 'jev_batch_analysis',
    run_type: 'chain',
    tags: ['typesafe-jev', 'batch-moderation', 'encuestas']
  }
);

