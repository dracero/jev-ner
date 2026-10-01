import type { APIRoute } from 'astro';
import { getJevApiKey } from '../../lib/jevService';

export const GET: APIRoute = async () => {
  const apiKey = getJevApiKey();
  const hasKey = Boolean(apiKey && apiKey.length > 5);
  const masked = hasKey ? `${apiKey.slice(0, 10)}...${apiKey.slice(-6)}` : '***';

  return new Response(
    JSON.stringify({
      status: 'online',
      has_api_key: hasKey,
      api_key_masked: masked,
      engine: 'TypeSafe Jev System One (Astro Backend)',
      supported_formats: ['.csv', '.xlsx', '.xls']
    }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
