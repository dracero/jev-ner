import dotenv from 'dotenv';
dotenv.config();

import { traceable, getCurrentRunTree } from './langsmith';

export interface JevSurveyResult {
  model: string;
  opinion_sentiment: 'buena' | 'mala' | 'neutra';
  prob_sentiment: number;
  has_person_name: boolean;
  prob_person_name: number;
  identified_person_name?: string;
  has_chair_reference: boolean;
  prob_chair_reference: number;
  identified_chair_name?: string;
  has_insult: boolean;
  prob_insult: number;
  identified_insult?: string;
  has_email: boolean;
  prob_email: number;
  identified_email?: string;
  has_phone: boolean;
  prob_phone: number;
  identified_phone?: string;
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
 * Extrae fragmentos y frases del texto respetando caracteres internos (@, ., -, +),
 * para que TypeSafe JEV clasifique inteligentemente nombres, cátedras, insultos, emails y teléfonos.
 * Cero regex de reconocimiento o hardcoding.
 */
export function extractTextChunks(text: string): string[] {
  if (!text) return [];

  // Limpiar solo signos de puntuación exteriores, preservando caracteres internos
  const rawWords = text
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/^[¿¡"'(«<]+|[.,;:?!")»>]+$/g, '').trim())
    .filter(w => w.length >= 2);

  const chunks = new Set<string>();

  // Palabras individuales
  for (const w of rawWords) {
    chunks.add(w);
  }

  // Frases de 2, 3 y 4 palabras consecutivas (nombres compuestos, cátedras, teléfonos con prefijos)
  for (let i = 0; i < rawWords.length - 1; i++) {
    chunks.add(`${rawWords[i]} ${rawWords[i + 1]}`);
    if (i + 2 < rawWords.length) {
      chunks.add(`${rawWords[i]} ${rawWords[i + 1]} ${rawWords[i + 2]}`);
    }
    if (i + 3 < rawWords.length) {
      chunks.add(`${rawWords[i]} ${rawWords[i + 1]} ${rawWords[i + 2]} ${rawWords[i + 3]}`);
    }
  }

  // Ordenar priorizando términos informativos: símbolos @ o +, mayúsculas, dígitos o longitud
  const sorted = Array.from(chunks).sort((a, b) => {
    const aSpecial = /[@+]/.test(a) ? 2 : (/^[A-ZÁÉÍÓÚÑ0-9]/.test(a) ? 1 : 0);
    const bSpecial = /[@+]/.test(b) ? 2 : (/^[A-ZÁÉÍÓÚÑ0-9]/.test(b) ? 1 : 0);
    return bSpecial - aSpecial || b.length - a.length;
  });

  return sorted.slice(0, 30);
}

export function buildSurveyQuestions(text: string): Record<string, any> {
  const chunks = extractTextChunks(text);

  const critPerson: Record<string, string> = { ninguno: 'No se menciona ninguna persona en particular' };
  const critChair: Record<string, string> = { ninguna: 'No se menciona ninguna materia o cátedra' };
  const critInsult: Record<string, string> = { ninguno: 'No contiene insultos ni agresiones verbales (críticas u opiniones negativas legítimas NO son insultos)' };
  const critEmail: Record<string, string> = { ninguno: 'No se menciona ninguna dirección de correo electrónico' };
  const critPhone: Record<string, string> = { ninguno: 'No se menciona ningún número de teléfono o celular' };

  for (const c of chunks) {
    critPerson[c] = `Término del texto: "${c}"`;
    critChair[c] = `Término del texto: "${c}"`;
    critInsult[c] = `Término del texto: "${c}"`;
    critEmail[c] = `Término del texto: "${c}"`;
    critPhone[c] = `Término del texto: "${c}"`;
  }

  const questions: Record<string, any> = {
    opinion_sentiment: {
      type: 'choice',
      instructions: '¿Cuál es la valoración o sentimiento general de la opinión expresada en el comentario del estudiante?',
      criteria: {
        buena: 'Opinión positiva, favorable, elogio o satisfacción con la cursada, profesor o materia',
        mala: 'Opinión negativa, crítica, queja o descontento sobre la materia o el docente (sin ser necesariamente un insulto)',
        neutra: 'Opinión neutral, puramente informativa, sugerencia moderada o sin carga emocional definida'
      }
    },
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
      instructions: '¿El texto contiene insultos explícitos, agresiones verbales o palabras soeces dirigidas a personas? ATENCIÓN: Las críticas negativas, quejas pedagógicas o desacuerdos sin agresiones verbales son opiniones malas o críticas legítimas, pero NO son insultos.'
    },
    identified_insult: {
      type: 'choice',
      instructions: '¿Cuál es el insulto o término agresivo explícito presente en el texto? Si es una crítica negativa o queja sin insultos, seleccionar "ninguno".',
      criteria: critInsult
    },
    has_email: {
      type: 'noul',
      instructions: '¿El texto contiene una dirección de correo electrónico o email?'
    },
    identified_email: {
      type: 'choice',
      instructions: '¿Cuál de las siguientes opciones corresponde a la dirección de correo electrónico mencionada en el texto?',
      criteria: critEmail
    },
    has_phone: {
      type: 'noul',
      instructions: '¿El texto contiene un número de teléfono, celular o contacto de WhatsApp?'
    },
    identified_phone: {
      type: 'choice',
      instructions: '¿Cuál de las siguientes opciones corresponde al número de teléfono, celular o WhatsApp mencionado en el texto?',
      criteria: critPhone
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
        anonimizar_datos_contacto: 'Contiene datos de contacto personales (teléfonos o correos electrónicos) que deben ser anonimizados',
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
        opinion_sentiment: 'neutra',
        prob_sentiment: 1.0,
        has_person_name: false,
        prob_person_name: 0.0,
        has_chair_reference: false,
        prob_chair_reference: 0.0,
        has_insult: false,
        prob_insult: 0.0,
        has_email: false,
        prob_email: 0.0,
        has_phone: false,
        prob_phone: 0.0,
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

      const sentimentAns = answers.opinion_sentiment;
      const rawSentiment = sentimentAns?.choice;
      const opinionSentiment: 'buena' | 'mala' | 'neutra' =
        rawSentiment === 'buena' || rawSentiment === 'mala' || rawSentiment === 'neutra'
          ? rawSentiment
          : 'neutra';
      const probSentiment = sentimentAns?.probabilities
        ? (sentimentAns.probabilities[opinionSentiment] ?? 1.0)
        : 1.0;

      const probPerson = answers.has_person_name?.noul ?? 0.0;
      const probChair = answers.has_chair_reference?.noul ?? 0.0;
      const probInsult = answers.has_insult?.noul ?? 0.0;
      const probEmail = answers.has_email?.noul ?? 0.0;
      const probPhone = answers.has_phone?.noul ?? 0.0;
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

      let identifiedEmail: string | undefined = undefined;
      if (answers.identified_email && answers.identified_email.choice !== 'ninguno') {
        identifiedEmail = answers.identified_email.choice;
      }

      let identifiedPhone: string | undefined = undefined;
      if (answers.identified_phone && answers.identified_phone.choice !== 'ninguno') {
        identifiedPhone = answers.identified_phone.choice;
      }

      const hasPerson = probPerson >= 0.5 && Boolean(identifiedPersonName);
      const hasChair = probChair >= 0.5 && Boolean(identifiedChairName);
      // Una opinión mala NO es insulto: solo clasificar como insulto si hay agravios o términos agresivos explícitos
      const hasInsult = probInsult >= 0.6 && Boolean(identifiedInsult) && identifiedInsult !== 'ninguno';
      const hasEmail = probEmail >= 0.5 && Boolean(identifiedEmail);
      const hasPhone = probPhone >= 0.5 && Boolean(identifiedPhone);

      const toxAnswer = answers.toxicity_level;
      const rawTox = toxAnswer?.score ?? 0.0;
      const normalizedTox = rawTox <= 4.0 ? Math.round((rawTox + 1.0) * 100) / 100 : Math.round(rawTox * 100) / 100;

      let primaryTopic = answers.primary_topic?.choice || 'docencia';
      let recommendedAction = answers.recommended_action?.choice || 'publicar_directo';

      if (hasInsult && (probInsult >= 0.7 || normalizedTox >= 4.0 || probDisrespect >= 0.8)) {
        recommendedAction = normalizedTox >= 4.5 ? 'descartar' : 'censurar_insultos';
      } else if (hasPerson) {
        recommendedAction = 'anonimizar_nombres';
      } else if ((hasEmail || hasPhone) && recommendedAction === 'publicar_directo') {
        recommendedAction = 'anonimizar_datos_contacto';
      } else if (hasChair && recommendedAction === 'publicar_directo') {
        recommendedAction = 'anonimizar_catedra';
      } else {
        recommendedAction = 'publicar_directo';
      }

      const result: JevSurveyResult = {
        model: data.model || 'jev-1.13.0',
        opinion_sentiment: opinionSentiment,
        prob_sentiment: Math.round(probSentiment * 1000) / 1000,
        has_person_name: hasPerson,
        prob_person_name: Math.round(probPerson * 1000) / 1000,
        identified_person_name: identifiedPersonName,
        has_chair_reference: hasChair,
        prob_chair_reference: Math.round(probChair * 1000) / 1000,
        identified_chair_name: identifiedChairName,
        has_insult: hasInsult,
        prob_insult: Math.round(probInsult * 1000) / 1000,
        identified_insult: identifiedInsult,
        has_email: hasEmail,
        prob_email: Math.round(probEmail * 1000) / 1000,
        identified_email: identifiedEmail,
        has_phone: hasPhone,
        prob_phone: Math.round(probPhone * 1000) / 1000,
        identified_phone: identifiedPhone,
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
            opinion_sentiment: result.opinion_sentiment,
            prob_sentiment: result.prob_sentiment,
            toxicity_score: result.toxicity_score,
            primary_topic: result.primary_topic,
            recommended_action: result.recommended_action,
            has_person_name: result.has_person_name,
            identified_person_name: result.identified_person_name,
            has_chair_reference: result.has_chair_reference,
            identified_chair_name: result.identified_chair_name,
            has_insult: result.has_insult,
            identified_insult: result.identified_insult,
            has_email: result.has_email,
            identified_email: result.identified_email,
            has_phone: result.has_phone,
            identified_phone: result.identified_phone,
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
        opinion_sentiment: 'neutra',
        prob_sentiment: 0.0,
        has_person_name: false,
        prob_person_name: 0.0,
        has_chair_reference: false,
        prob_chair_reference: 0.0,
        has_insult: false,
        prob_insult: 0.0,
        has_email: false,
        prob_email: 0.0,
        has_phone: false,
        prob_phone: 0.0,
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

