import { readJsonBody } from '@/lib/http';
import { getSiteContent } from '@/lib/content';
import { createStar, ValidationError } from '@/lib/stars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const settings=await getSiteContent();
    if(settings.maintenanceMode||!settings.acceptingDedications)return Response.json({error:'New dedications are temporarily paused. Please come back soon.'},{status:503,headers:{'Retry-After':'3600'}});
    const input = await readJsonBody(request);
    const star = await createStar(input);
    return Response.json({ star }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message, fields: error.fields }, { status: 400 });
    }
    console.error('Unable to save star dedication:', error instanceof Error ? error.message : 'Unknown error');
    return Response.json({ error: 'Your star could not be saved. Please try again.' }, { status: 500 });
  }
}
