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
    let sheetNames: string[] = ['Sheet1'];
    let selectedSheet = 'Sheet1';
    let allSheetsData: Record<string, Record<string, any>[]> = {};

    if (ext === '.csv') {
      const text = await file.text();
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false
      });
      rows = (parsed.data as Record<string, any>[]).filter(r => Object.keys(r).length > 0);
      allSheetsData['CSV'] = rows;
      sheetNames = ['CSV'];
      selectedSheet = 'CSV';
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      sheetNames = workbook.SheetNames;
      
      // Auto-detectar hoja solicitada por el usuario (ej: 'Comentarios 2026 1C')
      const requestedSheet = (formData.get('sheet') as string) || '';
      let targetSheet = sheetNames[0];

      if (requestedSheet && sheetNames.includes(requestedSheet)) {
        targetSheet = requestedSheet;
      } else {
        // Buscar coincidencia con 2026 1C o comentarios
        const matched = sheetNames.find(s => s.toLowerCase().includes('2026') && s.toLowerCase().includes('1c'))
          || sheetNames.find(s => s.toLowerCase().includes('comentario'))
          || sheetNames[0];
        targetSheet = matched;
      }

      selectedSheet = targetSheet;

      // Cargar todas las hojas para cambio instantáneo en el cliente
      for (const sName of sheetNames) {
        const s = workbook.Sheets[sName];
        allSheetsData[sName] = XLSX.utils.sheet_to_json(s, { defval: '' });
      }
      rows = allSheetsData[selectedSheet] || [];
    }

    if (!rows || rows.length === 0) {
      // Si la hoja seleccionada está vacía, intentar con la primera que tenga filas
      for (const sName of sheetNames) {
        if (allSheetsData[sName] && allSheetsData[sName].length > 0) {
          selectedSheet = sName;
          rows = allSheetsData[sName];
          break;
        }
      }
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ detail: 'El archivo está vacío o la hoja seleccionada no contiene registros.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const columns = Object.keys(rows[0]);
    const suggestedColumn = detectSuggestedColumn(columns, rows);
    
    // Detectar columna de ID
    const candidateIdNames = ['id_encuesta', 'id', 'id_fila', 'identificador', 'numero', 'nro', '#', 'estudiante_id', 'codigo'];
    let suggestedIdColumn = columns.find(c => candidateIdNames.includes(c.toLowerCase().trim()))
      || columns.find(c => c.toLowerCase().includes('id'))
      || columns[0];

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
        sheet_names: sheetNames,
        selected_sheet: selectedSheet,
        sheets_data: allSheetsData,
        total_rows: rows.length,
        columns,
        suggested_column: suggestedColumn,
        suggested_id_column: suggestedIdColumn,
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
