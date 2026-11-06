import type { APIRoute } from 'astro';
import { analyzeSurveyComment } from '../../lib/jevService';
import { extractEntitiesFromText, generateAnonymizedAndHighlighted } from '../../lib/anonymizer';
import { traceable, getCurrentRunTree, flushLangSmithTraces, buildLangSmithRunUrl } from '../../lib/langsmith';

const processSingleCommentPipeline = traceable(
  async function processSingleCommentPipeline(text: string, options: any) {
    const runTree = getCurrentRunTree();
    const jevResult = await analyzeSurveyComment(text);

    const entities = extractEntitiesFromText(text, {
      hasPerson: jevResult.has_person_name,
      identifiedPersonName: jevResult.identified_person_name,
      hasChair: jevResult.has_chair_reference,
      identifiedChairName: jevResult.identified_chair_name,
      hasInsult: jevResult.has_insult,
      identifiedInsult: jevResult.identified_insult,
      hasEmail: jevResult.has_email,
      identifiedEmail: jevResult.identified_email,
      hasPhone: jevResult.has_phone,
      identifiedPhone: jevResult.identified_phone
    });

    const { anonymizedText, highlightedHtml } = generateAnonymizedAndHighlighted(
      text,
      entities,
      {
        maskPer: options.mask_per !== false,
        maskChair: options.mask_chair !== false,
        maskInsult: options.mask_insult !== false,
        maskEmail: options.mask_email !== false,
        maskPhone: options.mask_phone !== false,
        perPlaceholder: options.per_placeholder || '[DOCENTE]',
        chairPlaceholder: options.chair_placeholder || '[CÁTEDRA]',
        insultPlaceholder: options.insult_placeholder || '[LENGUAJE INAPROPIADO]',
        emailPlaceholder: options.email_placeholder || '[EMAIL]',
        phonePlaceholder: options.phone_placeholder || '[TELÉFONO]'
      }
    );

    const traceInfo = runTree ? {
      run_id: runTree.id,
      trace_id: runTree.trace_id,
      url: buildLangSmithRunUrl(runTree.id)
    } : null;

    return {
      original_text: text,
      anonymized_text: anonymizedText,
      highlighted_html: highlightedHtml,
      entities,
      jev: jevResult,
      langsmith_trace: traceInfo
    };
  },
  {
    name: 'jev_single_comment_pipeline',
    run_type: 'chain',
    tags: ['typesafe-jev', 'playground', 'single-comment']
  }
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const text = body.text || '';

    const result = await processSingleCommentPipeline(text, body);

    // Asegurar envío de trazas a LangSmith antes de responder
    await flushLangSmithTraces();

    return new Response(
      JSON.stringify(result),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    await flushLangSmithTraces();
    return new Response(
      JSON.stringify({ detail: err?.message || 'Error al analizar el comentario' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

