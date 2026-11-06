// Motor de Anotación y Anonimización de Entidades
// 100% basado en las decisiones semánticas de TypeSafe Jev System One (cero regex de detección o hardcoding).

export interface EntitySpan {
  type: 'PER' | 'CATEDRA' | 'INSULTO' | 'EMAIL' | 'TELEFONO';
  label: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface JevEntityDetectionParams {
  hasPerson?: boolean;
  identifiedPersonName?: string;
  hasChair?: boolean;
  identifiedChairName?: string;
  hasInsult?: boolean;
  identifiedInsult?: string;
  hasEmail?: boolean;
  identifiedEmail?: string;
  hasPhone?: boolean;
  identifiedPhone?: string;
}

/**
 * Localiza las entidades clasificadas por TypeSafe JEV dentro del texto para su resaltado y reemplazo.
 * No utiliza regex de detección: busca exclusivamente los términos que el modelo JEV identificó.
 */
export function extractEntitiesFromText(
  text: string,
  paramsOrHasPerson: boolean | JevEntityDetectionParams = false,
  hasChairFlag = false,
  hasInsultFlag = false,
  identifiedPersonName?: string,
  identifiedChairName?: string,
  identifiedInsult?: string,
  hasEmailFlag = false,
  hasPhoneFlag = false,
  identifiedEmail?: string,
  identifiedPhone?: string
): EntitySpan[] {
  if (!text) return [];

  let params: JevEntityDetectionParams;

  if (typeof paramsOrHasPerson === 'object' && paramsOrHasPerson !== null) {
    params = paramsOrHasPerson;
  } else {
    params = {
      hasPerson: Boolean(paramsOrHasPerson),
      identifiedPersonName,
      hasChair: hasChairFlag,
      identifiedChairName,
      hasInsult: hasInsultFlag,
      identifiedInsult,
      hasEmail: hasEmailFlag,
      identifiedEmail,
      hasPhone: hasPhoneFlag,
      identifiedPhone
    };
  }

  const entities: EntitySpan[] = [];
  const textLower = text.toLowerCase();

  function findAndAddSpan(
    term: string | undefined,
    type: 'PER' | 'CATEDRA' | 'INSULTO' | 'EMAIL' | 'TELEFONO',
    label: string,
    conf = 0.98
  ) {
    if (!term || term === 'ninguno' || term === 'ninguna' || term.trim().length < 2) return;
    const cleanTerm = term.trim();
    const cleanLower = cleanTerm.toLowerCase();

    let searchStart = 0;
    while (searchStart < textLower.length) {
      const idx = textLower.indexOf(cleanLower, searchStart);
      if (idx === -1) break;

      const end = idx + cleanTerm.length;
      const overlaps = entities.some(e => !(end <= e.start || idx >= e.end));
      if (!overlaps) {
        entities.push({
          type,
          label,
          text: text.slice(idx, end),
          start: idx,
          end,
          confidence: conf
        });
      }
      searchStart = idx + cleanTerm.length;
    }
  }

  // 1. Persona identificada por JEV
  if (params.hasPerson && params.identifiedPersonName && params.identifiedPersonName !== 'ninguno') {
    findAndAddSpan(params.identifiedPersonName, 'PER', 'Persona / Docente', 0.98);
  }

  // 2. Cátedra / Materia identificada por JEV
  if (params.hasChair && params.identifiedChairName && params.identifiedChairName !== 'ninguna') {
    findAndAddSpan(params.identifiedChairName, 'CATEDRA', 'Cátedra / Materia', 0.95);
  }

  // 3. Insulto identificado por JEV
  if (params.hasInsult && params.identifiedInsult && params.identifiedInsult !== 'ninguno') {
    findAndAddSpan(params.identifiedInsult, 'INSULTO', 'Lenguaje Inapropiado', 0.95);
  }

  // 4. Correo Electrónico identificado por JEV
  if (params.hasEmail && params.identifiedEmail && params.identifiedEmail !== 'ninguno') {
    findAndAddSpan(params.identifiedEmail, 'EMAIL', 'Correo Electrónico', 0.99);
  }

  // 5. Teléfono / WhatsApp identificado por JEV
  if (params.hasPhone && params.identifiedPhone && params.identifiedPhone !== 'ninguno') {
    findAndAddSpan(params.identifiedPhone, 'TELEFONO', 'Teléfono / WhatsApp', 0.98);
  }

  // Deduplicar spans superpuestos
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
    maskEmail?: boolean;
    maskPhone?: boolean;
    perPlaceholder?: string;
    chairPlaceholder?: string;
    insultPlaceholder?: string;
    emailPlaceholder?: string;
    phonePlaceholder?: string;
  } = {}
): { anonymizedText: string; highlightedHtml: string } {
  const {
    maskPer = true,
    maskChair = true,
    maskInsult = true,
    maskEmail = true,
    maskPhone = true,
    perPlaceholder = '[DOCENTE]',
    chairPlaceholder = '[CÁTEDRA]',
    insultPlaceholder = '[LENGUAJE INAPROPIADO]',
    emailPlaceholder = '[EMAIL]',
    phonePlaceholder = '[TELÉFONO]'
  } = options;

  if (!text) return { anonymizedText: '', highlightedHtml: '' };
  if (!entities || entities.length === 0) return { anonymizedText: text, highlightedHtml: text };

  const sorted = [...entities].sort((a, b) => a.start - b.start);
  const anonParts: string[] = [];
  const htmlParts: string[] = [];
  let lastPos = 0;
  let perCounter = 1;
  let chairCounter = 1;
  let emailCounter = 1;
  let phoneCounter = 1;

  for (const ent of sorted) {
    const origChunk = text.slice(ent.start, ent.end);
    anonParts.push(text.slice(lastPos, ent.start));
    htmlParts.push(text.slice(lastPos, ent.start));

    if (ent.type === 'PER') {
      const rep = perPlaceholder.includes('_') ? `${perPlaceholder}_${perCounter}` : perPlaceholder;
      perCounter++;
      anonParts.push(maskPer ? rep : origChunk);
      htmlParts.push(
        `<mark class="entity-badge entity-per" data-type="PER" title="Persona identificada por JEV: ${origChunk}">${origChunk}<small>PER</small></mark>`
      );
    } else if (ent.type === 'CATEDRA') {
      const rep = chairPlaceholder.includes('_') ? `${chairPlaceholder}_${chairCounter}` : chairPlaceholder;
      chairCounter++;
      anonParts.push(maskChair ? rep : origChunk);
      htmlParts.push(
        `<mark class="entity-badge entity-chair" data-type="CATEDRA" title="Cátedra identificada por JEV: ${origChunk}">${origChunk}<small>CÁTEDRA</small></mark>`
      );
    } else if (ent.type === 'INSULTO') {
      anonParts.push(maskInsult ? insultPlaceholder : origChunk);
      htmlParts.push(
        `<mark class="entity-badge entity-insult" data-type="INSULTO" title="Lenguaje inapropiado clasificado por JEV: ${origChunk}">${origChunk}<small>INSULTO</small></mark>`
      );
    } else if (ent.type === 'EMAIL') {
      const rep = emailPlaceholder.includes('_') ? `${emailPlaceholder}_${emailCounter}` : emailPlaceholder;
      emailCounter++;
      anonParts.push(maskEmail ? rep : origChunk);
      htmlParts.push(
        `<mark class="entity-badge entity-email" data-type="EMAIL" title="Correo electrónico identificado por JEV: ${origChunk}">${origChunk}<small>EMAIL</small></mark>`
      );
    } else if (ent.type === 'TELEFONO') {
      const rep = phonePlaceholder.includes('_') ? `${phonePlaceholder}_${phoneCounter}` : phonePlaceholder;
      phoneCounter++;
      anonParts.push(maskPhone ? rep : origChunk);
      htmlParts.push(
        `<mark class="entity-badge entity-phone" data-type="TELEFONO" title="Teléfono / WhatsApp identificado por JEV: ${origChunk}">${origChunk}<small>TELÉFONO</small></mark>`
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
