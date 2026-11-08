import { readJsonBody } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { deleteStar, getAdminStar, updateStar, ValidationError } from '@/lib/stars';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const star = await getAdminStar((await context.params).id);
    return star ? Response.json({ star }, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'Dedication not found.' }, { status: 404 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: 'Unable to load this dedication.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const input = await readJsonBody(request);
    const star = await updateStar((await context.params).id, input);
    return star ? Response.json({ star }, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'Dedication not found.' }, { status: 404 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ValidationError) return Response.json({ error: error.message, fields: error.fields }, { status: 400 });
    return Response.json({ error: 'Unable to update this dedication.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    return await deleteStar((await context.params).id) ? Response.json({ deleted: true }) : Response.json({ error: 'Dedication not found.' }, { status: 404 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: 'Unable to delete this dedication.' }, { status: 500 });
  }
}
