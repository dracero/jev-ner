import type { APIRoute } from 'astro';
import { getSession } from '../../lib/sessionStore';
import { analyzeBatchComments } from '../../lib/jevService';
import { extractEntitiesFromText, generateAnonymizedAndHighlighted } from '../../lib/anonymizer';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      session_id,
      text_column,
      mask_per = true,
      mask_chair = true,
      mask_insult = true,
      per_placeholder = '[DOCENTE]',
      chair_placeholder = '[CÁTEDRA]',
      insult_placeholder = '[LENGUAJE INAPROPIADO]',
      concurrency = 5,
      max_rows
    } = body;

    const session = session_id ? getSession(session_id) : undefined;
    let rows: Record<string, any>[] = session?.rows || body.rows;
    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ detail: 'No se encontraron registros para analizar. Por favor vuelva a cargar el archivo.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (max_rows && max_rows > 0) {
      rows = rows.slice(0, max_rows);
    }

    const texts = rows.map(r => String(r[text_column] || ''));

    // Execute batch analysis with TypeSafe Jev
    const jevResults = await analyzeBatchComments(texts, concurrency);

    const processedRows = [];
    let kpiPersonCount = 0;
    let kpiChairCount = 0;
    let kpiInsultCount = 0;
    let kpiApprovedCount = 0;
    let totalTox = 0.0;
    const topicDistribution: Record<string, number> = {};
    const actionDistribution: Record<string, number> = {};

    for (let idx = 0; idx < rows.length; idx++) {
      const originalText = texts[idx];
      const jevRes = jevResults[idx];

      const entities = extractEntitiesFromText(
        originalText,
        jevRes.has_person_name,
        jevRes.has_chair_reference,
        jevRes.has_insult,
        jevRes.identified_person_name,
        jevRes.identified_chair_name,
        jevRes.identified_insult
      );

      const { anonymizedText, highlightedHtml } = generateAnonymizedAndHighlighted(
        originalText,
        entities,
        {
          maskPer: mask_per,
          maskChair: mask_chair,
          maskInsult: mask_insult,
          perPlaceholder: per_placeholder,
          chairPlaceholder: chair_placeholder,
          insultPlaceholder: insult_placeholder
        }
      );

      if (jevRes.has_person_name) kpiPersonCount++;
      if (jevRes.has_chair_reference) kpiChairCount++;
      if (jevRes.has_insult) kpiInsultCount++;

      const action = jevRes.recommended_action || 'publicar_directo';
      actionDistribution[action] = (actionDistribution[action] || 0) + 1;
      if (action === 'publicar_directo') kpiApprovedCount++;

      const topic = jevRes.primary_topic || 'otro';
      topicDistribution[topic] = (topicDistribution[topic] || 0) + 1;

      const tox = jevRes.toxicity_score || 1.0;
      totalTox += tox;

      processedRows.push({
        row_index: idx,
        raw_data: rows[idx],
        original_text: originalText,
        anonymized_text: anonymizedText,
        highlighted_html: highlightedHtml,
        entities,
        entity_count: entities.length,
        jev: jevRes,
        status: action === 'publicar_directo' ? 'approved' : 'flagged',
        include_in_export: action !== 'descartar'
      });
    }

    const avgToxicity = texts.length > 0 ? Math.round((totalTox / texts.length) * 100) / 100 : 1.0;

    session.processedRows = processedRows;
    session.textColumn = text_column;

    return new Response(
      JSON.stringify({
        session_id,
        total_analyzed: processedRows.length,
        kpi: {
          total: processedRows.length,
          with_person_name: kpiPersonCount,
          with_chair_reference: kpiChairCount,
          with_insults: kpiInsultCount,
          approved_direct: kpiApprovedCount,
          avg_toxicity: avgToxicity,
          topic_distribution: topicDistribution,
          action_distribution: actionDistribution
        },
        rows: processedRows
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ detail: err?.message || 'Error al ejecutar lote de análisis' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
