import type { APIRoute } from 'astro';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { getSession } from '../../lib/sessionStore';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      session_id,
      export_format = 'xlsx',
      mode = 'anonymized_column',
      exclude_discarded = true,
      custom_rows
    } = body;

    const session = session_id ? getSession(session_id) : undefined;
    const processedRows = custom_rows || session?.processedRows || [];
    const textColumn = body.text_column || session?.textColumn || 'comentario';

    if (!processedRows || processedRows.length === 0) {
      return new Response(
        JSON.stringify({ detail: 'No hay datos procesados para exportar.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const exportRecords: Record<string, any>[] = [];

    for (const r of processedRows) {
      if (exclude_discarded && !r.include_in_export) {
        continue;
      }

      const rowData = { ...(r.raw_data || {}) };
      const anonText = r.anonymized_text || '';

      if (mode === 'replace_original') {
        rowData[textColumn] = anonText;
      } else if (mode === 'add_anonymized_col') {
        rowData[`${textColumn}_anonimizado`] = anonText;
      } else if (mode === 'all_metadata') {
        rowData[`${textColumn}_anonimizado`] = anonText;
        const jev = r.jev || {};
        rowData['jev_tiene_persona'] = jev.has_person_name ?? false;
        rowData['jev_tiene_catedra'] = jev.has_chair_reference ?? false;
        rowData['jev_tiene_insulto'] = jev.has_insult ?? false;
        rowData['jev_toxicidad'] = jev.toxicity_score ?? 1.0;
        rowData['jev_tema'] = jev.primary_topic ?? '';
        rowData['jev_accion'] = jev.recommended_action ?? '';
      }

      exportRecords.push(rowData);
    }

    if (export_format.toLowerCase() === 'csv') {
      const csvStr = Papa.unparse(exportRecords, { quotes: true });
      return new Response(csvStr, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=encuesta_limpia_publicable.csv'
        }
      });
    } else {
      const worksheet = XLSX.utils.json_to_sheet(exportRecords);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Encuesta Limpia');

      const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return new Response(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename=encuesta_limpia_publicable.xlsx'
        }
      });
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ detail: err?.message || 'Error al exportar archivo' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
