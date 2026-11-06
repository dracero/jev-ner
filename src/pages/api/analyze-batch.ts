import type { APIRoute } from 'astro';
import { getSession } from '../../lib/sessionStore';
import { analyzeBatchComments } from '../../lib/jevService';
import { extractEntitiesFromText, generateAnonymizedAndHighlighted } from '../../lib/anonymizer';
import { traceable, getCurrentRunTree, flushLangSmithTraces, buildLangSmithRunUrl } from '../../lib/langsmith';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      session_id,
      text_column,
      mask_per = true,
      mask_chair = true,
      mask_insult = true,
      mask_email = true,
      mask_phone = true,
      per_placeholder = '[DOCENTE]',
      chair_placeholder = '[CÁTEDRA]',
      insult_placeholder = '[LENGUAJE INAPROPIADO]',
      email_placeholder = '[EMAIL]',
      phone_placeholder = '[TELÉFONO]',
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
    let kpiEmailCount = 0;
    let kpiPhoneCount = 0;
    let kpiGoodCount = 0;
    let kpiBadCount = 0;
    let kpiNeutralCount = 0;
    let kpiApprovedCount = 0;
    let totalTox = 0.0;
    const topicDistribution: Record<string, number> = {};
    const actionDistribution: Record<string, number> = {};

    for (let idx = 0; idx < rows.length; idx++) {
      const originalText = texts[idx];
      const jevRes = jevResults[idx];

      const entities = extractEntitiesFromText(originalText, {
        hasPerson: jevRes.has_person_name,
        identifiedPersonName: jevRes.identified_person_name,
        hasChair: jevRes.has_chair_reference,
        identifiedChairName: jevRes.identified_chair_name,
        hasInsult: jevRes.has_insult,
        identifiedInsult: jevRes.identified_insult,
        hasEmail: jevRes.has_email,
        identifiedEmail: jevRes.identified_email,
        hasPhone: jevRes.has_phone,
        identifiedPhone: jevRes.identified_phone
      });

      if (jevRes.has_person_name) kpiPersonCount++;
      if (jevRes.has_chair_reference) kpiChairCount++;
      if (jevRes.has_insult) kpiInsultCount++;
      if (jevRes.has_email) kpiEmailCount++;
      if (jevRes.has_phone) kpiPhoneCount++;
      if (jevRes.opinion_sentiment === 'buena') kpiGoodCount++;
      else if (jevRes.opinion_sentiment === 'mala') kpiBadCount++;
      else kpiNeutralCount++;

      const { anonymizedText, highlightedHtml } = generateAnonymizedAndHighlighted(
        originalText,
        entities,
        {
          maskPer: mask_per,
          maskChair: mask_chair,
          maskInsult: mask_insult,
          maskEmail: mask_email,
          maskPhone: mask_phone,
          perPlaceholder: per_placeholder,
          chairPlaceholder: chair_placeholder,
          insultPlaceholder: insult_placeholder,
          emailPlaceholder: email_placeholder,
          phonePlaceholder: phone_placeholder
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

    if (session) {
      session.processedRows = processedRows;
      session.textColumn = text_column;
    }

    // Asegurar que todas las trazas del lote fueron recibidas por LangSmith
    await flushLangSmithTraces();

    return new Response(
      JSON.stringify({
        session_id,
        total_analyzed: processedRows.length,
        kpi: {
          total: processedRows.length,
          with_person_name: kpiPersonCount,
          with_chair_reference: kpiChairCount,
          with_insults: kpiInsultCount,
          with_emails: kpiEmailCount,
          with_phones: kpiPhoneCount,
          good_opinions: kpiGoodCount,
          bad_opinions: kpiBadCount,
          neutral_opinions: kpiNeutralCount,
          approved_direct: kpiApprovedCount,
          avg_toxicity: avgToxicity,
          topic_distribution: topicDistribution,
          action_distribution: actionDistribution
        },
        rows: processedRows,
        langsmith: {
          project: process.env.LANGSMITH_PROJECT || 'jev_ner_test',
          url: buildLangSmithRunUrl()
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    await flushLangSmithTraces();
    return new Response(
      JSON.stringify({ detail: err?.message || 'Error al ejecutar lote de análisis' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

