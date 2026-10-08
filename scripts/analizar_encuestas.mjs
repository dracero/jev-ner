import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config();

import { traceable, getCurrentRunTree } from 'langsmith/traceable';
import { Client } from 'langsmith';

if (process.env.LANGSMITH_PROJECT && !process.env.LANGCHAIN_PROJECT) {
  process.env.LANGCHAIN_PROJECT = process.env.LANGSMITH_PROJECT.replace(/['"]/g, '');
}
if (process.env.LANGSMITH_TRACING === 'true' && !process.env.LANGCHAIN_TRACING_V2) {
  process.env.LANGCHAIN_TRACING_V2 = 'true';
}


export function countWords(str) {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export function extractTextChunks(text) {
  if (!text) return [];
  const words = text
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/[.,;:()¿?¡!"'«»]/g, '').trim())
    .filter(w => w.length >= 2);

  const chunks = new Set();
  for (const w of words) chunks.add(w);
  for (let i = 0; i < words.length - 1; i++) {
    chunks.add(`${words[i]} ${words[i + 1]}`);
    if (i + 2 < words.length) {
      chunks.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  const sorted = Array.from(chunks).sort((a, b) => {
    const aCap = /^[A-ZÁÉÍÓÚÑ]/.test(a) ? 1 : 0;
    const bCap = /^[A-ZÁÉÍÓÚÑ]/.test(b) ? 1 : 0;
    return bCap - aCap || b.length - a.length;
  });

  return sorted.slice(0, 15);
}

export const classifyWithJev = traceable(
  async function classifyWithJev(text, apiKey) {
    const runTree = getCurrentRunTree();
    if (!text || !text.trim() || !apiKey) {
      return {

      has_person_name: false,
      identified_person_name: 'ninguno',
      has_disrespect: false,
      has_insult: false,
      identified_insult: 'ninguno',
      has_arg_slang: false,
      has_political_gender_discrimination: false,
      political_gender_category: 'ninguna',
      toxicity_score: 1.0
    };
  }

  const chunks = extractTextChunks(text);
  const critPerson = { ninguno: 'No se menciona ninguna persona en particular' };
  const critInsult = { ninguno: 'No contiene insultos ni términos ofensivos' };

  for (const c of chunks) {
    critPerson[c] = `Término del texto: "${c}"`;
    critInsult[c] = `Término del texto: "${c}"`;
  }

  const questions = {
    has_person_name: {
      type: 'noul',
      instructions: '¿El texto menciona nombres o apellidos de personas particulares (profesores, ayudantes, alumnos, directivos)? No contar cargos genéricos sin nombre.'
    },
    identified_person_name: {
      type: 'choice',
      instructions: '¿Cuál de las siguientes opciones es el nombre o apellido de la persona mencionada?',
      criteria: critPerson
    },
    has_insult: {
      type: 'noul',
      instructions: '¿El texto contiene insultos, agravios, groserías o descalificaciones agresivas explícitas?'
    },
    identified_insult: {
      type: 'choice',
      instructions: '¿Cuál es el insulto o término agresivo presente en el texto?',
      criteria: critInsult
    },
    has_arg_slang: {
      type: 'noul',
      instructions: '¿El texto contiene términos de jerga o modismos argentinos descalificadores o agresivos (como pelotudo, forro, boludo, choto, sorete, conchudo, mierda, paja, etc.)?'
    },
    has_disrespect: {
      type: 'noul',
      instructions: '¿El texto reporta faltas de respeto, descalificaciones, maltrato o hablar mal de personas?'
    },
    has_political_gender_discrimination: {
      type: 'noul',
      instructions: '¿El texto contiene contenido de política partidaria, militancia, discriminación o cuestiones de género / acoso?'
    },
    political_gender_category: {
      type: 'choice',
      instructions: 'Si contiene política, discriminación o género, ¿cuál es la categoría principal?',
      criteria: {
        ninguna: 'No contiene ninguna de estas temáticas',
        politica: 'Política partidaria, militancia o adoctrinamiento',
        discriminacion: 'Discriminación por nacionalidad, origen o aspecto',
        genero: 'Cuestiones de género, acoso o trato machista/sexista'
      }
    },
    toxicity_level: {
      type: 'score',
      instructions: 'Nivel de severidad o agresividad del comentario',
      criteria: [
        'Constructivo o neutral',
        'Crítica moderada',
        'Queja vehemente sin insultos',
        'Ataque personal o falta de respeto',
        'Insultos directos o violencia verbal'
      ]
    }
  };

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
        questions
      })
    });

    if (!res.ok) {
      throw new Error(`Jev API Error: ${res.status}`);
    }

    const data = await res.json();
    const answers = data.answers || {};

    const probPerson = answers.has_person_name?.noul ?? 0.0;
    const probInsult = answers.has_insult?.noul ?? 0.0;
    const probArgSlang = answers.has_arg_slang?.noul ?? 0.0;
    const probDisrespect = answers.has_disrespect?.noul ?? 0.0;
    const probPolGender = answers.has_political_gender_discrimination?.noul ?? 0.0;
    const polCategory = answers.political_gender_category?.choice || 'ninguna';
    const identifiedName = answers.identified_person_name?.choice || 'ninguno';
    const identifiedInsult = answers.identified_insult?.choice || 'ninguno';

    const rawTox = answers.toxicity_level?.score ?? 0.0;
    const normalizedTox = rawTox <= 4.0 ? Math.round((rawTox + 1.0) * 100) / 100 : Math.round(rawTox * 100) / 100;

    const classified = {
      has_person_name: probPerson >= 0.5,
      prob_person_name: probPerson,
      identified_person_name: identifiedName,
      has_insult: probInsult >= 0.5,
      identified_insult: identifiedInsult,
      has_arg_slang: probArgSlang >= 0.5,
      has_disrespect: probDisrespect >= 0.5,
      has_political_gender_discrimination: probPolGender >= 0.5,
      political_gender_category: polCategory,
      toxicity_score: normalizedTox
    };

    if (runTree && data.usage) {
      runTree.extra = {
        ...runTree.extra,
        metadata: {
          ...runTree.extra?.metadata,
          model: data.model || 'jev-latest',
          input_tokens: data.usage.input_tokens,
          output_tokens: data.usage.output_tokens,
          toxicity_score: normalizedTox
        }
      };
    }

    return classified;
  } catch (err) {
    console.warn(`[WARN] Error llamando a Jev: ${err.message}`);
    return {
      has_person_name: false,
      identified_person_name: 'ninguno',
      has_disrespect: false,
      has_insult: false,
      identified_insult: 'ninguno',
      has_arg_slang: false,
      has_political_gender_discrimination: false,
      political_gender_category: 'ninguna',
      toxicity_score: 1.0
    };
  }
},
{
  name: 'jev_cli_system_one_inference',
  run_type: 'llm',
  tags: ['typesafe-jev', 'cli', 'moderation']
});

export const analyzeSurveyRows = traceable(
  async function analyzeSurveyRows(rows, sheetName = 'Hoja', apiKey = process.env.JEV_API_KEY) {
    const runTree = getCurrentRunTree();
    const result = {
      totalRows: rows.length,
      sheetName,
      req1_disrespect: [],

    req2_properNames: [],
    req3_argTerms: [],
    req4_polGenderDiscr: [],
    req5_longNegative: []
  };

  console.log(`[INFO] Clasificando ${rows.length} respuestas con TypeSafe JEV System One (100% libre de regex)...`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const id = row.id_encuesta || row.ID || row.Id || row.id || row['#'] || row.Numero || (i + 1);
    const comment = row.comentario || row.Comentario || row.comentarios || row.Comentarios || row.opinion || row.texto || row.Respuesta || row.respuesta || '';

    if (!comment) continue;

    const jev = await classifyWithJev(comment, apiKey);

    // 1. Tratos inapropiados, insultos, hablar mal de personas (clasificado por JEV)
    if (jev.has_disrespect || jev.has_insult || jev.toxicity_score >= 3.0) {
      result.req1_disrespect.push({
        id,
        comentario: comment,
        detalles: jev.has_insult ? 'Insultos clasificados por JEV' : 'Falta de respeto / Trato indebido clasificado por JEV'
      });
    }

    // 2. Nombres propios (clasificado por JEV)
    if (jev.has_person_name) {
      const nombre = jev.identified_person_name && jev.identified_person_name !== 'ninguno'
        ? jev.identified_person_name
        : 'Persona identificada por JEV';

      result.req2_properNames.push({
        id,
        nombres: nombre,
        comentario: comment
      });
    }

    // 3. Términos de jerga agresiva / insultos (clasificado por JEV)
    if (jev.has_arg_slang || jev.has_insult) {
      const insulto = jev.identified_insult && jev.identified_insult !== 'ninguno'
        ? jev.identified_insult
        : 'Insulto / jerga clasificada por JEV';

      result.req3_argTerms.push({
        id,
        terminos: insulto,
        comentario: comment
      });
    }

    // 4. Connotación política, discriminación y/o cuestiones de género (clasificado por JEV)
    if (jev.has_political_gender_discrimination) {
      const cat = jev.political_gender_category && jev.political_gender_category !== 'ninguna'
        ? jev.political_gender_category
        : 'Política / Discriminación / Género';

      result.req4_polGenderDiscr.push({
        id,
        categorias: cat,
        comentario: comment
      });
    }

    // 5. Más de 120 palabras con connotación negativa (clasificado por JEV)
    const words = countWords(comment);
    if (words > 120 && (jev.toxicity_score >= 2.5 || jev.has_disrespect || jev.has_insult)) {
      result.req5_longNegative.push({
        id,
        palabras: words,
        comentario: comment
      });
    }
  }

    if (runTree) {
      runTree.extra = {
        ...runTree.extra,
        metadata: {
          ...runTree.extra?.metadata,
          sheet_name: sheetName,
          total_rows: rows.length,
          disrespect_matches: result.req1_disrespect.length,
          proper_names_matches: result.req2_properNames.length,
          arg_slang_matches: result.req3_argTerms.length,
          political_gender_matches: result.req4_polGenderDiscr.length,
          long_negative_matches: result.req5_longNegative.length
        }
      };
    }

    return result;
  },
  {
    name: 'jev_cli_survey_analysis',
    run_type: 'chain',
    tags: ['typesafe-jev', 'cli', 'survey-auditor']
  }
);


// Ejecución CLI directa
if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = process.argv[2] || 'public/sample/encuestas_estudiantes_ejemplo.xlsx';
  const targetSheet = process.argv[3] || 'Sheet1';

  console.log(`[INFO] Leyendo archivo: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] El archivo no existe: ${filePath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath);
  console.log(`[INFO] Hojas disponibles: ${wb.SheetNames.join(', ')}`);

  let matchedSheet = wb.SheetNames.find(s => s.trim().toLowerCase() === targetSheet.trim().toLowerCase());
  if (!matchedSheet) {
    matchedSheet = wb.SheetNames.find(s => s.toLowerCase().includes('2026') || s.toLowerCase().includes('comentario')) || wb.SheetNames[0];
  }

  console.log(`[INFO] Analizando hoja: "${matchedSheet}"`);
  const sheet = wb.Sheets[matchedSheet];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const apiKey = process.env.JEV_API_KEY;
  if (!apiKey) {
    console.error('[ERROR] JEV_API_KEY no encontrada en .env');
    process.exit(1);
  }

  analyzeSurveyRows(rows, matchedSheet, apiKey).then(async (results) => {
    console.log(`\n### 1. Tabla Exportable: Tratos inapropiados, maliciosos, faltas de respeto, insultos o hablar mal de personas (Clasificado por JEV)\n`);
    console.log(`| ID | Comentario |`);
    console.log(`| :--- | :--- |`);
    if (results.req1_disrespect.length === 0) {
      console.log(`| *Sin coincidencias* | - |`);
    } else {
      for (const r of results.req1_disrespect) {
        console.log(`| **${r.id}** | ${r.comentario.replace(/\|/g, '\\|')} |`);
      }
    }

    console.log(`\n### 2. Tabla Exportable: IDs con nombres propios clasificados por JEV (Hoja: ${matchedSheet})\n`);
    console.log(`| ID | Nombres Propios Identificados por JEV | Comentario |`);
    console.log(`| :--- | :--- | :--- |`);
    if (results.req2_properNames.length === 0) {
      console.log(`| *Sin coincidencias* | - | - |`);
    } else {
      for (const r of results.req2_properNames) {
        console.log(`| **${r.id}** | \`${r.nombres}\` | ${r.comentario.replace(/\|/g, '\\|')} |`);
      }
    }

    console.log(`\n### 3. Tabla Exportable: Comentarios con términos de jerga agresiva o insultos clasificados por JEV\n`);
    console.log(`| ID | Insulto / Término Clasificado por JEV | Comentario |`);
    console.log(`| :--- | :--- | :--- |`);
    if (results.req3_argTerms.length === 0) {
      console.log(`| *Sin coincidencias* | - | - |`);
    } else {
      for (const r of results.req3_argTerms) {
        console.log(`| **${r.id}** | \`${r.terminos}\` | ${r.comentario.replace(/\|/g, '\\|')} |`);
      }
    }

    console.log(`\n### 4. Lista de IDs con connotación política, discriminación y/o cuestiones de género clasificados por JEV\n`);
    if (results.req4_polGenderDiscr.length === 0) {
      console.log(`*(Ningún ID coincide con estos criterios en las fuentes analizadas)*`);
    } else {
      for (const r of results.req4_polGenderDiscr) {
        console.log(r.id);
      }
    }

    console.log(`\n### 5. Lista de IDs con comentarios de más de 120 palabras con connotación negativa clasificados por JEV\n`);
    if (results.req5_longNegative.length === 0) {
      console.log(`*(Ningún ID coincide con más de 120 palabras y connotación negativa en las fuentes analizadas)*`);
    } else {
      for (const r of results.req5_longNegative) {
        console.log(r.id);
      }
    }

    const outDir = path.resolve('output_reportes');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const csvDisrespect = ['ID,Comentario'].concat(
      results.req1_disrespect.map(r => `"${r.id}","${r.comentario.replace(/"/g, '""')}"`)
    ).join('\n');
    fs.writeFileSync(path.join(outDir, '1_tratos_inapropiados_insultos.csv'), csvDisrespect, 'utf-8');

    const csvNames = ['ID,Nombres_Propios,Comentario'].concat(
      results.req2_properNames.map(r => `"${r.id}","${r.nombres.replace(/"/g, '""')}","${r.comentario.replace(/"/g, '""')}"`)
    ).join('\n');
    fs.writeFileSync(path.join(outDir, '2_nombres_propios.csv'), csvNames, 'utf-8');

    const csvArg = ['ID,Terminos_Jerga,Comentario'].concat(
      results.req3_argTerms.map(r => `"${r.id}","${r.terminos.replace(/"/g, '""')}","${r.comentario.replace(/"/g, '""')}"`)
    ).join('\n');
    fs.writeFileSync(path.join(outDir, '3_terminos_jerga_argentina.csv'), csvArg, 'utf-8');

    const txtReq4 = results.req4_polGenderDiscr.map(r => String(r.id)).join('\n');
    fs.writeFileSync(path.join(outDir, '4_ids_politica_discriminacion_genero.txt'), txtReq4, 'utf-8');

    const txtReq5 = results.req5_longNegative.map(r => String(r.id)).join('\n');
    fs.writeFileSync(path.join(outDir, '5_ids_mas_120_palabras_negativas.txt'), txtReq5, 'utf-8');

    console.log(`\n[OK] Reportes exportables guardados en la carpeta: ${outDir}/`);

    try {
      const client = new Client();
      await client.awaitPendingTraceBatches();
      const projName = process.env.LANGSMITH_PROJECT || 'jev_ner_test';
      console.log(`\n[LangSmith] 🎯 Toda la trayectoria fue registrada con éxito en el proyecto: "${projName}"`);
      console.log(`[LangSmith] 🔗 Panel web: https://smith.langchain.com/o/default/projects/p/${encodeURIComponent(projName)}`);
    } catch (err) {
      console.warn('[LangSmith] Advertencia sincronizando trazas:', err.message);
    }
  });
}

