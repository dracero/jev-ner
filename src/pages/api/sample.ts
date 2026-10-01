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
      total_rows: rows.length,
      columns,
      suggested_column: suggestedColumn,
      preview: rows,
      rows: rows
    }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
