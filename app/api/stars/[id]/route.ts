import { getStar } from '@/lib/stars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const star = await getStar(id);
    if (!star) return Response.json({ error: 'This star dedication could not be found.' }, { status: 404 });
    return Response.json({ star }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to read star dedication:', error instanceof Error ? error.message : 'Unknown error');
    return Response.json({ error: 'The star registry is temporarily unavailable. Please try again.' }, { status: 500 });
  }
}
