import dotenv from 'dotenv';
dotenv.config();

import { Client, isTracingEnabled } from 'langsmith';
import { traceable, getCurrentRunTree } from 'langsmith/traceable';

// Garantizar compatibilidad cruzada de variables de entorno para LangSmith / LangChain
if (process.env.LANGSMITH_PROJECT && !process.env.LANGCHAIN_PROJECT) {
  process.env.LANGCHAIN_PROJECT = process.env.LANGSMITH_PROJECT.replace(/['"]/g, '');
}
if (process.env.LANGSMITH_TRACING === 'true' && !process.env.LANGCHAIN_TRACING_V2) {
  process.env.LANGCHAIN_TRACING_V2 = 'true';
}

export const langsmithClient = new Client();

export function getLangSmithProjectName(): string {
  const raw = process.env.LANGSMITH_PROJECT || process.env.LANGCHAIN_PROJECT || 'jev_ner_test';
  return raw.replace(/['"]/g, '').trim();
}

export function getLangSmithConfig() {
  const enabled = isTracingEnabled();
  const project = getLangSmithProjectName();
  const endpoint = process.env.LANGSMITH_ENDPOINT || 'https://api.smith.langchain.com';
  const hasKey = Boolean(process.env.LANGSMITH_API_KEY || process.env.LANGCHAIN_API_KEY);

  return {
    enabled,
    project,
    endpoint,
    hasKey,
    appUrl: 'https://smith.langchain.com'
  };
}

/**
 * Espera y envía todos los lotes de trazas pendientes a LangSmith.
 * Es crucial en entornos serverless (Vercel) para asegurar que ninguna
 * traza se pierda al finalizar la petición HTTP.
 */
export async function flushLangSmithTraces(): Promise<void> {
  try {
    await langsmithClient.awaitPendingTraceBatches();
  } catch (err: any) {
    console.warn('[LangSmith] Advertencia al sincronizar trazas pendientes:', err?.message || err);
  }
}

/**
 * Genera la URL directa a la traza o al proyecto en LangSmith.
 */
export function buildLangSmithRunUrl(runId?: string): string {
  const project = getLangSmithProjectName();
  if (!runId) {
    return `https://smith.langchain.com/o/default/projects/p/${encodeURIComponent(project)}`;
  }
  return `https://smith.langchain.com/o/default/projects/p/${encodeURIComponent(project)}/r/${encodeURIComponent(runId)}`;
}

/**
 * Obtiene el ID de la traza activa si se encuentra dentro de un contexto traceable.
 */
export function getCurrentTraceInfo() {
  const rt = getCurrentRunTree();
  if (!rt) return null;
  return {
    run_id: rt.id,
    trace_id: rt.trace_id,
    project: rt.project_name || getLangSmithProjectName(),
    url: buildLangSmithRunUrl(rt.id)
  };
}

export { traceable, getCurrentRunTree };
