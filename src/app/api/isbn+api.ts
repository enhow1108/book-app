import { lookupNcl } from '@/data/ncl';

// The web app is served from another origin (GitHub Pages), so allow cross-origin calls.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

/** GET /api/isbn?isbn=978... → a Taiwanese book from the National Central Library, or null. */
export async function GET(request: Request) {
  const isbn = new URL(request.url).searchParams.get('isbn') ?? '';
  try {
    return Response.json(await lookupNcl(isbn), { headers: { ...CORS, 'Cache-Control': 'public, max-age=86400' } });
  } catch {
    return Response.json(null, { status: 502, headers: CORS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
