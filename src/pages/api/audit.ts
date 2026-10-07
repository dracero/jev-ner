import type { APIRoute } from 'astro';
import { runSurveyAudit } from '../../lib/surveyAuditor';
import { getSession } from '../../lib/sessionStore';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      session_id,
      text_column,
      id_column,
      sheet_name,
      rows: customRows,
      export_target, // 'disrespect_csv', 'proper_names_csv', 'slang_csv', 'political_txt', 'long_negative_txt', 'full_excel'
    } = body;

    const session = session_id ? getSession(session_id) : undefined;
    const rows: Record<string, any>[] = customRows || session?.rows || [];

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ detail: 'No hay filas para auditar. Suba un archivo primero.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const precomputedJev = session?.processedRows && session.processedRows.length === rows.length
      ? session.processedRows.map((r: any) => r.jev)
      : undefined;

    const auditResult = await runSurveyAudit(rows, {
      idColumn: id_column,
      textColumn: text_column,
      sheetName: sheet_name || 'Comentarios 2026 1C',
      precomputedJev
    });

    // If an export download is requested directly via POST
    if (export_target === 'disrespect_csv') {
      const csv = Papa.unparse(auditResult.reportDisrespect.map(r => ({
        ID: r.id,
        Comentario: r.comentario,
        Motivo: r.detalles
      })), { quotes: true });
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=reporte_tratos_inapropiados.csv'
        }
      });
    }

    if (export_target === 'proper_names_csv') {
      const csv = Papa.unparse(auditResult.reportProperNames.map(r => ({
        ID: r.id,
        Nombres_Propios_Detectados: r.detalles,
        Comentario: r.comentario
      })), { quotes: true });
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=reporte_nombres_propios.csv'
        }
      });
    }

    if (export_target === 'slang_csv') {
      const csv = Papa.unparse(auditResult.reportArgSlang.map(r => ({
        ID: r.id,
        Terminos_Jerga: r.detalles,
        Comentario: r.comentario
      })), { quotes: true });
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=reporte_jerga_argentina.csv'
        }
      });
    }

    if (export_target === 'political_txt') {
      const text = auditResult.idsPoliticalGenderDiscrimination.join('\n');
      return new Response(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'attachment; filename=ids_politica_discriminacion_genero.txt'
        }
      });
    }

    if (export_target === 'long_negative_txt') {
      const text = auditResult.idsOver120WordsNegative.join('\n');
      return new Response(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'attachment; filename=ids_mas_120_palabras_negativas.txt'
        }
      });
    }

    if (export_target === 'full_excel') {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Tratos Inapropiados
      const ws1 = XLSX.utils.json_to_sheet(auditResult.reportDisrespect.map(r => ({
        ID: r.id,
        Comentario: r.comentario,
        Motivo: r.detalles
      })));
      XLSX.utils.book_append_sheet(wb, ws1, '1. Tratos Inapropiados');

      // Hoja 2: Nombres Propios
      const ws2 = XLSX.utils.json_to_sheet(auditResult.reportProperNames.map(r => ({
        ID: r.id,
        Nombres_Propios_Detectados: r.detalles,
        Comentario: r.comentario
      })));
      XLSX.utils.book_append_sheet(wb, ws2, '2. Nombres Propios');

      // Hoja 3: Jerga Argentina
      const ws3 = XLSX.utils.json_to_sheet(auditResult.reportArgSlang.map(r => ({
        ID: r.id,
        Terminos_Jerga: r.detalles,
        Comentario: r.comentario
      })));
      XLSX.utils.book_append_sheet(wb, ws3, '3. Jerga Argentina');

      // Hoja 4: Política, Discriminación y Género
      const ws4 = XLSX.utils.json_to_sheet(auditResult.reportPoliticalGenderDiscrimination.map(r => ({
        ID: r.id,
        Categorias: r.detalles,
        Comentario: r.comentario
      })));
      XLSX.utils.book_append_sheet(wb, ws4, '4. Política y Género');

      // Hoja 5: Más de 120 palabras negativas
      const ws5 = XLSX.utils.json_to_sheet(auditResult.reportOver120WordsNegative.map(r => ({
        ID: r.id,
        Cantidad_Palabras: r.palabras,
        Comentario: r.comentario
      })));
      XLSX.utils.book_append_sheet(wb, ws5, '5. Mas 120 Palabras');

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return new Response(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename=auditoria_5_reportes_encuestas.xlsx'
        }
      });
    }

    // Default: return JSON result with all metrics and tables
    return new Response(
      JSON.stringify({
        success: true,
        audit: auditResult
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ detail: err?.message || 'Error en auditoría' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
