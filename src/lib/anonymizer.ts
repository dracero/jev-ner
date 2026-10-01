export interface EntitySpan {
  type: 'PER' | 'CATEDRA' | 'INSULTO';
  label: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

const TITLES_REGEX = "(?:Prof(?:esor|esora)?|Docente|Ayudante|Titular|Adjunt[oa]|JTP|Ing(?:eniero|eniera)?|Lic(?:enciad[oa])?|Dr[a]?\\.?)";

const COMMON_CHAIRS = [
  "sistemas operativos",
  "algoritmos(?: y estructuras de datos)?",
  "estructuras de datos",
  "análisis matemático(?: [iIvV1-3]+)?",
  "álgebra(?: lineal)?(?: [iIvV1-3]+)?",
  "física(?: [iIvV1-3]+)?",
  "química(?: general)?(?: [iIvV1-3]+)?",
  "bases de datos(?: [iIvV1-3]+)?",
  "redes(?: de información| de computadoras)?",
  "ingeniería de software(?: [iIvV1-3]+)?",
  "paradigmas de programación",
  "diseño de sistemas",
  "teoría de la computación",
  "probabilidad y estadística",
  "arquitectura de computadoras",
  "seguridad informática",
  "inteligencia artificial",
  "gestión de datos",
  "comunicación de datos",
  "legislación",
  "economía"
];

const INSULT_TERMS = [
  "pelotud[oa]s?",
  "forr[oa]s?",
  "inútil(?:es)?",
  "chantas?",
  "mierdas?",
  "hijos? de puta",
  "hdp",
  "garcas?",
  "idiotas?",
  "estúpid[oa]s?",
  "imbécil(?:es)?",
  "vagos?",
  "vagas?",
  "ladrones?",
  "ladrona",
  "estafadores?",
  "corrupt[oa]s?",
  "asco",
  "porquería",
  "odio a",
  "tarad[oa]s?",
  "miserable",
  "sinvergüenza"
];

const COMMON_SURNAMES = [
  "González", "Gonzalez", "Rodríguez", "Rodriguez", "Gómez", "Gomez", "Fernández", "Fernandez",
  "López", "Lopez", "Díaz", "Diaz", "Martínez", "Martinez", "Pérez", "Perez", "García", "Garcia",
  "Sánchez", "Sanchez", "Romero", "Sosa", "Álvarez", "Alvarez", "Torres", "Ruiz", "Ramírez", "Ramirez",
  "Flores", "Benítez", "Benitez", "Acosta", "Medina", "Herrera", "Aguirre", "Pereyra", "Gutiérrez", "Gutierrez",
  "Giménez", "Gimenez", "Molina", "Silva", "Castro", "Rojas", "Ortiz", "Núñez", "Nuñez", "Luna",
  "Juárez", "Juarez", "Cabrera", "Ríos", "Rios", "Morales", "Rossi", "Ferrari", "Bianchi", "Fontana"
];

const COMMON_FIRSTNAMES = [
  "Juan", "Carlos", "María", "Maria", "José", "Jose", "Alejandro", "Martín", "Martin", "Pablo",
  "Diego", "Javier", "Facundo", "Nicolás", "Nicolas", "Federico", "Santiago", "Ignacio", "Lucas",
  "Agustín", "Agustin", "Gonzalo", "Mariano", "Esteban", "Lucía", "Lucia", "Camila", "Florencia",
  "Paula", "Ana", "Laura", "Sofia", "Sofía", "Valeria", "Julieta", "Carolina", "Daniela", "Micaela",
  "Guillermo", "Gustavo", "Eduardo", "Marcelo", "Jorge", "Horacio", "Raúl", "Raul", "Fernando"
];

export function extractEntitiesFromText(
  text: string,
  hasPersonFlag = false,
  hasChairFlag = false,
  hasInsultFlag = false
): EntitySpan[] {
  if (!text) return [];

  const entities: EntitySpan[] = [];

  // 1. Person Names (PER)
  // Pattern A: Title + Capitalized Name(s)
  const patternTitleName = new RegExp(`\\b(${TITLES_REGEX})\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = patternTitleName.exec(text)) !== null) {
    entities.push({
      type: 'PER',
      label: 'Persona / Docente',
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.95
    });
  }

  // Pattern B: "el profe [Nombre]", "la docente [Nombre]"
  const patternDocente = /\b(?:el\s+profe|la\s+profe|el\s+docente|la\s+docente|el\s+titular|la\s+titular)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b/gi;
  while ((match = patternDocente.exec(text)) !== null) {
    entities.push({
      type: 'PER',
      label: 'Persona / Docente',
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.92
    });
  }

  // Pattern C: Firstname + Surname
  const firstnamesRegex = new RegExp(`\\b(${COMMON_FIRSTNAMES.join('|')})\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\\b`, 'g');
  while ((match = firstnamesRegex.exec(text)) !== null) {
    entities.push({
      type: 'PER',
      label: 'Persona (PER)',
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.90
    });
  }

  // If Jev flagged person name, match surnames
  if (hasPersonFlag) {
    const surnamesRegex = new RegExp(`\\b(${COMMON_SURNAMES.join('|')})\\b`, 'gi');
    while ((match = surnamesRegex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (!entities.some(e => e.start <= start && end <= e.end)) {
        entities.push({
          type: 'PER',
          label: 'Apellido / Docente',
          text: match[0],
          start,
          end,
          confidence: 0.85
        });
      }
    }
  }

  // 2. Cátedras / Materias
  const patternCatedraExplicit = /\b(?:cátedra|catedra|materia|asignatura|curso|taller|laboratorio)\s+(?:de\s+)?([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s]{3,30}?)(?=[,.;\n]|\s+(?:es|fue|no|tiene|con|del|de|y|pero)\b)/gi;
  while ((match = patternCatedraExplicit.exec(text)) !== null) {
    entities.push({
      type: 'CATEDRA',
      label: 'Cátedra / Materia',
      text: match[0].trim(),
      start: match.index,
      end: match.index + match[0].trim().length,
      confidence: 0.90
    });
  }

  for (const chairPat of COMMON_CHAIRS) {
    const reg = new RegExp(`\\b${chairPat}\\b`, 'gi');
    while ((match = reg.exec(text)) !== null) {
      entities.push({
        type: 'CATEDRA',
        label: 'Cátedra Específica',
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.88
      });
    }
  }

  // 3. Insultos / Lenguaje Inapropiado
  for (const insultPat of INSULT_TERMS) {
    const reg = new RegExp(`\\b${insultPat}\\b`, 'gi');
    while ((match = reg.exec(text)) !== null) {
      entities.push({
        type: 'INSULTO',
        label: 'Lenguaje Inapropiado',
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.95
      });
    }
  }

  // Deduplicate overlapping spans
  entities.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const deduped: EntitySpan[] = [];
  let lastEnd = -1;

  for (const ent of entities) {
    if (ent.start >= lastEnd) {
      deduped.push(ent);
      lastEnd = ent.end;
    } else if (deduped.length > 0 && (ent.end - ent.start) > (deduped[deduped.length - 1].end - deduped[deduped.length - 1].start)) {
      deduped[deduped.length - 1] = ent;
      lastEnd = ent.end;
    }
  }

  return deduped;
}

export function generateAnonymizedAndHighlighted(
  text: string,
  entities: EntitySpan[],
  options: {
    maskPer?: boolean;
    maskChair?: boolean;
    maskInsult?: boolean;
    perPlaceholder?: string;
    chairPlaceholder?: string;
    insultPlaceholder?: string;
  } = {}
): { anonymizedText: string; highlightedHtml: string } {
  const {
    maskPer = true,
    maskChair = true,
    maskInsult = true,
    perPlaceholder = '[DOCENTE]',
    chairPlaceholder = '[CÁTEDRA]',
    insultPlaceholder = '[LENGUAJE INAPROPIADO]'
  } = options;

  if (!text) return { anonymizedText: '', highlightedHtml: '' };
  if (!entities || entities.length === 0) return { anonymizedText: text, highlightedHtml: text };

  const sorted = [...entities].sort((a, b) => a.start - b.start);
  const anonParts: string[] = [];
  const htmlParts: string[] = [];
  let lastPos = 0;
  let perCounter = 1;
  let chairCounter = 1;

  for (const ent of sorted) {
    const origChunk = text.slice(ent.start, ent.end);
    anonParts.push(text.slice(lastPos, ent.start));
    htmlParts.push(text.slice(lastPos, ent.start));

    if (ent.type === 'PER') {
      const rep = perPlaceholder.includes('_') ? `${perPlaceholder}_${perCounter}` : perPlaceholder;
      perCounter++;
      anonParts.push(maskPer ? rep : origChunk);
      htmlParts.push(
        `<mark class="entity-badge entity-per" data-type="PER" title="Persona identificada: ${origChunk}">${origChunk}<small>PER</small></mark>`
      );
    } else if (ent.type === 'CATEDRA') {
      const rep = chairPlaceholder.includes('_') ? `${chairPlaceholder}_${chairCounter}` : chairPlaceholder;
      chairCounter++;
      anonParts.push(maskChair ? rep : origChunk);
      htmlParts.push(
        `<mark class="entity-badge entity-chair" data-type="CATEDRA" title="Cátedra identificada: ${origChunk}">${origChunk}<small>CÁTEDRA</small></mark>`
      );
    } else if (ent.type === 'INSULTO') {
      anonParts.push(maskInsult ? insultPlaceholder : origChunk);
      htmlParts.push(
        `<mark class="entity-badge entity-insult" data-type="INSULTO" title="Lenguaje inapropiado: ${origChunk}">${origChunk}<small>INSULTO</small></mark>`
      );
    } else {
      anonParts.push(origChunk);
      htmlParts.push(origChunk);
    }

    lastPos = ent.end;
  }

  anonParts.push(text.slice(lastPos));
  htmlParts.push(text.slice(lastPos));

  return {
    anonymizedText: anonParts.join(''),
    highlightedHtml: htmlParts.join('')
  };
}
