import { readJsonBody } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { createAdminStar, listStars, ValidationError } from '@/lib/stars';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const query = new URL(request.url).searchParams;
    return Response.json(await listStars({ search: query.get('search') ?? '', status: query.get('status') ?? '', page: Number(query.get('page')), limit: Number(query.get('limit')) }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: 'Unable to load dedications.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = await readJsonBody(request);
    return Response.json({ star: await createAdminStar(input) }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ValidationError) return Response.json({ error: error.message, fields: error.fields }, { status: 400 });
    return Response.json({ error: 'Unable to create this dedication.' }, { status: 500 });
  }
}
