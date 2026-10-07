import type { APIRoute } from 'astro';
import { analyzeSurveyComment } from '../../lib/jevService';
import { extractEntitiesFromText, generateAnonymizedAndHighlighted } from '../../lib/anonymizer';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const text = body.text || '';

    const jevResult = await analyzeSurveyComment(text);

    const entities = extractEntitiesFromText(
      text,
      jevResult.has_person_name,
      jevResult.has_chair_reference,
      jevResult.has_insult,
      jevResult.identified_person_name,
      jevResult.identified_chair_name,
      jevResult.identified_insult
    );

    const { anonymizedText, highlightedHtml } = generateAnonymizedAndHighlighted(
      text,
      entities,
      {
        maskPer: body.mask_per !== false,
        maskChair: body.mask_chair !== false,
        maskInsult: body.mask_insult !== false,
        perPlaceholder: body.per_placeholder || '[DOCENTE]',
        chairPlaceholder: body.chair_placeholder || '[CÁTEDRA]',
        insultPlaceholder: body.insult_placeholder || '[LENGUAJE INAPROPIADO]'
      }
    );

    return new Response(
      JSON.stringify({
        original_text: text,
        anonymized_text: anonymizedText,
        highlighted_html: highlightedHtml,
        entities,
        jev: jevResult
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ detail: err?.message || 'Error al analizar el comentario' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
