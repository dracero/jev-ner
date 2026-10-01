import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// 1. Detección de términos de jerga argentina solicitados (masculino/femenino/singular/plural)
const ARG_INSULTS = [
  { term: 'paja', regex: /\bpajas?\b/i },
  { term: 'pajero/a', regex: /\bpajer[oasx@]{1,2}\b/i },
  { term: 'boludo/a', regex: /\bbolud[oasx@]{1,2}\b/i },
  { term: 'forro/a', regex: /\bforr[oasx@]{1,2}\b/i },
  { term: 'mierda', regex: /\bmierdas?\b/i },
  { term: 'pelotudo/a', regex: /\bpelotud[oasx@]{1,2}\b/i },
  { term: 'mogolico/a', regex: /\bmog[oó]lic[oasx@]{1,2}\b/i },
  { term: 'estupido/a', regex: /\best[uú]pid[oasx@]{1,2}\b/i },
  { term: 'garca', regex: /\bgarcas?\b/i },
  { term: 'choto/a', regex: /\bchot[oasx@]{1,2}\b/i },
  { term: 'sorete', regex: /\bsoretes?\b/i },
  { term: 'conchudo/a', regex: /\bconchud[oasx@]{1,2}\b/i },
  { term: 'puto/a', regex: /\bput[oasx@]{1,2}\b/i }
];

// 2. Detección de tratos inapropiados, maliciosos, faltas de respeto o hablar mal de personas
const DISRESPECT_PATTERNS = [
  /\b(?:in[uú]til(?:es)?|chantas?|desastre|verg[uü]enza|miserable|sinverg[uü]enza|impostor(?:a)?)\b/i,
  /\b(?:idiotas?|imb[eé]cil(?:es)?|tarad[oas]{1,2}|cretin[oas]{1,2}|basura|lacra)\b/i,
  /\b(?:trata como|nos trata|me trata|hizo llorar|humill[oó]|agresiv[oas]{1,2}|maltrat[oó]|violencia)\b/i,
  /\b(?:cero paciencia|soberbi[oas]{1,2}|arrogante|sobrador(?:a)?|prepotent[ea]|acosador(?:a)?)\b/i,
  /\b(?:no explica nada|le importa nada|se caga en|burla|burl[oó]|forre[aá]|discrimina)\b/i,
  /\b(?:poco serio|muy poco serio|toma cualquier cosa|no vino a la mitad|no vino a clases)\b/i
];

// 3. Nombres propios (títulos académicos + nombres, o nombres y apellidos frecuentes)
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
  // Título + Nombre(s) en mayúscula (ej: Profesor Juan Perez, Ing. Martínez, Dra. Gómez)
  new RegExp(`\\b${TITLES_REGEX}\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)`, 'g'),
  // Nombre y Apellido comunes con mayúscula
  new RegExp(`\\b(?:${COMMON_NAMES.join('|')})\\s+(?:${COMMON_SURNAMES.join('|')})\\b`, 'g'),
  // Título + Apellido común con mayúscula
  new RegExp(`\\b${TITLES_REGEX}\\s+(?:${COMMON_SURNAMES.join('|')})\\b`, 'g')
];

// 4. Connotación política, discriminación y/o cuestiones de género
const POLITICAL_TERMS = [
  /\b(?:pol[ií]tica?|adoctrinamiento|partidari[oas]{1,2}|militan(?:te|cia)|campora|militan)\b/i,
  /\b(?:kirchneris(?:ta|mo)|peronis(?:ta|mo)|libertari[oas]{1,2}|milei|cristina|macri|marxismo|comunismo)\b/i,
  /\b(?:zurd[oas]{1,2}|fach[oas]{1,2}|gorilas?|frente de izquierda|centro de estudiantes)\b/i
];

const DISCRIMINATION_TERMS = [
  /\b(?:discriminaci[oó]n|discrimina|xenofobi[ao]|racis(?:mo|ta)|clasista|capacitismo)\b/i,
  /\b(?:bolivian[oas]{1,2}|paraguay[oas]{1,2}|negro de mierda|villero|porteño de mierda)\b/i,
  /\b(?:discapacidad|retrasado|down)\b/i
];

const GENDER_TERMS = [
  /\b(?:machis(?:mo|ta)|patriarcad[o]|misogin[ioa]|sexista|acoso sexual|acosador(?:a)?)\b/i,
  /\b(?:feminazi|feminismo|ideolog[ií]a de g[eé]nero|transf[oó]b(?:ico|ia)|homof[oó]b(?:ico|ia))\b/i,
  /\b(?:por ser mujer|por ser hombre|g[eé]nero|lenguaje inclusivo|inclusivo)\b/i
];

// 5. Connotación negativa para comentarios > 120 palabras
const NEGATIVE_MARKERS = [
  /\b(?:desastre|p[eé]simo|terrible|mal[ií]sim[oa]|inaceptable|in[uú]til|verg[uü]enza|estafa)\b/i,
  /\b(?:lamentable|decepcion(?:ante)?|fracaso|incompetente|horrible|odio|bronca|indignaci[oó]n)\b/i,
  /\b(?:abuso|maltrato|falta de respeto|prepotencia|arbitrari[oa]|intolerable|desorganizaci[oó]n)\b/i
];

export function countWords(str) {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export function detectProperNames(text) {
  if (!text) return [];
  const found = new Set();
  for (const pattern of PROPER_NAME_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      found.add(match[0].trim());
    }
  }
  return Array.from(found);
}

export function detectArgInsults(text) {
  if (!text) return [];
  const found = [];
  for (const item of ARG_INSULTS) {
    if (item.regex.test(text)) {
      found.push(item.term);
    }
  }
  return found;
}

export function detectDisrespect(text) {
  if (!text) return false;
  // Si contiene insultos de la jerga o patrones de trato inapropiado
  if (detectArgInsults(text).length > 0) return true;
  for (const pat of DISRESPECT_PATTERNS) {
    if (pat.test(text)) return true;
  }
  return false;
}

export function detectPoliticalGenderDiscrimination(text) {
  if (!text) return { matches: false, tags: [] };
  const tags = [];
  if (POLITICAL_TERMS.some(r => r.test(text))) tags.push('Política');
  if (DISCRIMINATION_TERMS.some(r => r.test(text))) tags.push('Discriminación');
  if (GENDER_TERMS.some(r => r.test(text))) tags.push('Género');
  return {
    matches: tags.length > 0,
    tags
  };
}

export function isNegativeSentiment(text) {
  if (!text) return false;
  if (detectDisrespect(text)) return true;
  return NEGATIVE_MARKERS.some(r => r.test(text));
}

export function analyzeSurveyRows(rows, sheetName = 'Hoja') {
  const result = {
    totalRows: rows.length,
    sheetName,
    req1_disrespect: [],
    req2_properNames: [],
    req3_argTerms: [],
    req4_polGenderDiscr: [],
    req5_longNegative: []
  };

  for (const row of rows) {
    // Normalizar ID y comentario
    const id = row.id_encuesta || row.ID || row.Id || row.id || row['#'] || row.Numero || '';
    const comment = row.comentario || row.Comentario || row.comentarios || row.Comentarios || row.opinion || row.texto || row.Respuesta || row.respuesta || '';

    if (!comment) continue;

    // 1. Tratos inapropiados, insultos, hablar mal de personas
    if (detectDisrespect(comment)) {
      result.req1_disrespect.push({
        id,
        comentario: comment
      });
    }

    // 2. Nombres propios
    const names = detectProperNames(comment);
    if (names.length > 0) {
      result.req2_properNames.push({
        id,
        nombres: names.join(', '),
        comentario: comment
      });
    }

    // 3. Términos jerga argentina
    const terms = detectArgInsults(comment);
    if (terms.length > 0) {
      result.req3_argTerms.push({
        id,
        terminos: terms.join(', '),
        comentario: comment
      });
    }

    // 4. Connotación política, discriminación y/o cuestiones de género
    const polGender = detectPoliticalGenderDiscrimination(comment);
    if (polGender.matches) {
      result.req4_polGenderDiscr.push({
        id,
        categorias: polGender.tags.join(', '),
        comentario: comment
      });
    }

    // 5. Más de 120 palabras con connotación negativa
    const words = countWords(comment);
    if (words > 120 && isNegativeSentiment(comment)) {
      result.req5_longNegative.push({
        id,
        palabras: words,
        comentario: comment
      });
    }
  }

  return result;
}

// Ejecución CLI directa
if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = process.argv[2] || 'public/sample/encuestas_estudiantes_ejemplo.xlsx';
  const targetSheet = process.argv[3] || 'Comentarios 2026 1C';

  console.log(`[INFO] Leyendo archivo: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] El archivo no existe: ${filePath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath);
  console.log(`[INFO] Hojas disponibles: ${wb.SheetNames.join(', ')}`);

  // Buscar hoja especificada o por coincidencia aproximada
  let matchedSheet = wb.SheetNames.find(s => s.trim().toLowerCase() === targetSheet.trim().toLowerCase());
  if (!matchedSheet) {
    matchedSheet = wb.SheetNames.find(s => s.toLowerCase().includes('2026') || s.toLowerCase().includes('comentario')) || wb.SheetNames[0];
  }

  console.log(`[INFO] Analizando hoja: "${matchedSheet}"`);
  const sheet = wb.Sheets[matchedSheet];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const results = analyzeSurveyRows(rows, matchedSheet);

  console.log(`\n### 1. Tabla Exportable: Tratos inapropiados, maliciosos, faltas de respeto, insultos o hablar mal de personas\n`);
  console.log(`| ID | Comentario |`);
  console.log(`| :--- | :--- |`);
  if (results.req1_disrespect.length === 0) {
    console.log(`| *Sin coincidencias* | - |`);
  } else {
    for (const r of results.req1_disrespect) {
      console.log(`| **${r.id}** | ${r.comentario.replace(/\|/g, '\\|')} |`);
    }
  }

  console.log(`\n### 2. Tabla Exportable: IDs con nombres propios (Hoja: ${matchedSheet})\n`);
  console.log(`| ID | Nombres Propios Detectados | Comentario |`);
  console.log(`| :--- | :--- | :--- |`);
  if (results.req2_properNames.length === 0) {
    console.log(`| *Sin coincidencias* | - | - |`);
  } else {
    for (const r of results.req2_properNames) {
      console.log(`| **${r.id}** | \`${r.nombres}\` | ${r.comentario.replace(/\|/g, '\\|')} |`);
    }
  }

  console.log(`\n### 3. Tabla Exportable: Comentarios con términos de jerga argentina agresiva\n`);
  console.log(`*(paja, boludo/a, forro/a, mierda, pelotudo/a, mogólico/a, estúpido/a, garca, choto/a, sorete, conchudo/a, puto/a, pajero/a)*\n`);
  console.log(`| ID | Término(s) Jerga Detectado(s) | Comentario |`);
  console.log(`| :--- | :--- | :--- |`);
  if (results.req3_argTerms.length === 0) {
    console.log(`| *Sin coincidencias* | - | - |`);
  } else {
    for (const r of results.req3_argTerms) {
      console.log(`| **${r.id}** | \`${r.terminos}\` | ${r.comentario.replace(/\|/g, '\\|')} |`);
    }
  }

  console.log(`\n### 4. Lista de IDs con connotación política, discriminación y/o cuestiones de género (uno por fila)\n`);
  if (results.req4_polGenderDiscr.length === 0) {
    console.log(`*(Ningún ID coincide con estos criterios en las fuentes analizadas)*`);
  } else {
    for (const r of results.req4_polGenderDiscr) {
      console.log(r.id);
    }
  }

  console.log(`\n### 5. Lista de IDs con comentarios de más de 120 palabras con connotación negativa (uno por fila)\n`);
  if (results.req5_longNegative.length === 0) {
    console.log(`*(Ningún ID coincide con más de 120 palabras y connotación negativa en las fuentes analizadas)*`);
  } else {
    for (const r of results.req5_longNegative) {
      console.log(r.id);
    }
  }

  // Generar archivos CSV exportables
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

}
