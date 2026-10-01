export interface FileSession {
  sessionId: string;
  filename: string;
  rows: Record<string, any>[];
  columns: string[];
  suggestedColumn: string;
  processedRows?: any[];
  textColumn?: string;
}

// In-memory global session store
const SESSIONS = new Map<string, FileSession>();

export function getSession(sessionId: string): FileSession | undefined {
  return SESSIONS.get(sessionId);
}

export function saveSession(session: FileSession): void {
  SESSIONS.set(session.sessionId, session);
}

export function deleteSession(sessionId: string): void {
  SESSIONS.delete(sessionId);
}

export function detectSuggestedColumn(columns: string[], rows: Record<string, any>[]): string {
  const candidateKeywords = [
    'comentario', 'opinion', 'opinión', 'observacion', 'observaciones',
    'feedback', 'sugerencia', 'sugerencias', 'texto', 'respuesta'
  ];

  for (const kw of candidateKeywords) {
    for (const col of columns) {
      if (col.toLowerCase().includes(kw)) {
        return col;
      }
    }
  }

  // Fallback: check average length of strings
  let bestCol = columns[0] || '';
  let maxLen = 0;
  for (const col of columns) {
    const samples = rows.slice(0, 20).map(r => String(r[col] || ''));
    if (samples.length > 0) {
      const avgLen = samples.reduce((acc, s) => acc + s.length, 0) / samples.length;
      if (avgLen > maxLen) {
        maxLen = avgLen;
        bestCol = col;
      }
    }
  }

  return bestCol;
}
