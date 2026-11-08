import { requireAdmin } from '@/lib/auth';
import { getOverview } from '@/lib/stars';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return Response.json(await getOverview(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: 'Unable to load the registry overview.' }, { status: 500 });
  }
}
