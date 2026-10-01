import type { APIRoute } from 'astro';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { saveSession, detectSuggestedColumn } from '../../lib/sessionStore';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ detail: 'No se envió ningún archivo válido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const filename = file.name;
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

    if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
      return new Response(
        JSON.stringify({ detail: 'Formato no soportado. Suba un archivo .csv o .xlsx' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let rows: Record<string, any>[] = [];

    if (ext === '.csv') {
      const text = await file.text();
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false
      });
      rows = (parsed.data as Record<string, any>[]).filter(r => Object.keys(r).length > 0);
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ detail: 'El archivo está vacío o no contiene registros.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const columns = Object.keys(rows[0]);
    const suggestedColumn = detectSuggestedColumn(columns, rows);
    const sessionId = crypto.randomUUID();

    saveSession({
      sessionId,
      filename,
      rows,
      columns,
      suggestedColumn
    });

    return new Response(
      JSON.stringify({
        session_id: sessionId,
        filename,
        total_rows: rows.length,
        columns,
        suggested_column: suggestedColumn,
        preview: rows.slice(0, 10),
        rows: rows
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ detail: `Error al procesar archivo: ${err?.message || err}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
