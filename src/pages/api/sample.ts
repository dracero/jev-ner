import type { APIRoute } from 'astro';
import { SAMPLE_SURVEY } from '../../lib/sampleData';
import { saveSession, detectSuggestedColumn } from '../../lib/sessionStore';

export const GET: APIRoute = async () => {
  const sessionId = crypto.randomUUID();
  const rows = [...SAMPLE_SURVEY];
  const columns = Object.keys(rows[0]);
  const suggestedColumn = detectSuggestedColumn(columns, rows);

  saveSession({
    sessionId,
    filename: 'encuesta_estudiantes_ejemplo.xlsx',
    rows,
    columns,
    suggestedColumn
  });

  return new Response(
    JSON.stringify({
      session_id: sessionId,
      filename: 'encuesta_estudiantes_ejemplo.xlsx',
      sheet_names: ['Comentarios 2026 1C', 'Sheet1'],
      selected_sheet: 'Comentarios 2026 1C',
      total_rows: rows.length,
      columns,
      suggested_column: suggestedColumn,
      suggested_id_column: 'id_encuesta',
      preview: rows,
      rows: rows
    }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
