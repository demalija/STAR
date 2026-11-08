import { createStar, ValidationError } from '@/lib/stars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 16_384) {
      return Response.json({ error: 'This dedication is too large.' }, { status: 413 });
    }
    let input: unknown;
    try { input = JSON.parse(body); }
    catch { return Response.json({ error: 'Please send a valid JSON dedication.' }, { status: 400 }); }
    const star = await createStar(input);
    return Response.json({ star }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message, fields: error.fields }, { status: 400 });
    }
    console.error('Unable to save star dedication:', error instanceof Error ? error.message : 'Unknown error');
    return Response.json({ error: 'Your star could not be saved. Please try again.' }, { status: 500 });
  }
}
