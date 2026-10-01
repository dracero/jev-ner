import dotenv from 'dotenv';
dotenv.config();

export interface JevSurveyResult {
  model: string;
  has_person_name: boolean;
  prob_person_name: number;
  has_chair_reference: boolean;
  prob_chair_reference: number;
  has_insult: boolean;
  prob_insult: number;
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

export const SURVEY_QUESTIONS = {
  has_person_name: {
    type: 'noul',
    instructions: '¿El texto menciona nombres o apellidos de personas particulares (profesores, ayudantes, alumnos, directivos)?'
  },
  has_chair_reference: {
    type: 'noul',
    instructions: '¿El texto menciona una cátedra, materia, asignatura o departamento académico específico?'
  },
  has_insult: {
    type: 'noul',
    instructions: '¿El texto contiene insultos, agravios, descalificaciones agresivas, groserías o lenguaje vulgar/inapropiado?'
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

export async function analyzeSurveyComment(text: string): Promise<JevSurveyResult> {
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
      toxicity_score: 1.0,
      primary_topic: 'positivo_general',
      recommended_action: 'publicar_directo'
    };
  }

  try {
    const res = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'jev-latest',
        state: text.trim(),
        questions: SURVEY_QUESTIONS
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Jev API Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const answers = data.answers || {};

    const probPerson = answers.has_person_name?.noul ?? 0.0;
    const probChair = answers.has_chair_reference?.noul ?? 0.0;
    const probInsult = answers.has_insult?.noul ?? 0.0;

    const toxAnswer = answers.toxicity_level;
    const rawTox = toxAnswer?.score ?? 0.0;
    // Scale 0-4 to 1-5
    const normalizedTox = rawTox <= 4.0 ? Math.round((rawTox + 1.0) * 100) / 100 : Math.round(rawTox * 100) / 100;

    let primaryTopic = answers.primary_topic?.choice || 'docencia';
    let recommendedAction = answers.recommended_action?.choice || 'publicar_directo';

    // Calibrated thresholds
    if (probInsult >= 0.7 || normalizedTox >= 4.0) {
      recommendedAction = normalizedTox >= 4.5 ? 'descartar' : 'censurar_insultos';
    } else if (probPerson >= 0.65) {
      recommendedAction = 'anonimizar_nombres';
    } else if (probChair >= 0.7 && recommendedAction === 'publicar_directo') {
      recommendedAction = 'anonimizar_catedra';
    }

    return {
      model: data.model || 'jev-1.13.0',
      has_person_name: probPerson >= 0.5,
      prob_person_name: Math.round(probPerson * 1000) / 1000,
      has_chair_reference: probChair >= 0.5,
      prob_chair_reference: Math.round(probChair * 1000) / 1000,
      has_insult: probInsult >= 0.5,
      prob_insult: Math.round(probInsult * 1000) / 1000,
      toxicity_score: normalizedTox,
      primary_topic: primaryTopic,
      recommended_action: recommendedAction,
      usage: data.usage
    };
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
}

export async function analyzeBatchComments(
  texts: string[],
  concurrency = 5
): Promise<JevSurveyResult[]> {
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
  return results;
}
