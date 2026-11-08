import { requireAdmin } from '@/lib/auth';
import { generateCertificate, certificateFilename } from '@/lib/certificate';
import { getSiteContent } from '@/lib/content';
import { getAdminStar } from '@/lib/stars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    const star = await getAdminStar(id);
    if (!star) return Response.json({ error: 'This certificate could not be found.' }, { status: 404 });
    const content = await getSiteContent();
    const bytes = await generateCertificate(star, {
      ...content,
      ...(star.status !== 'published' ? { watermark: star.status } : {}),
    });
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${certificateFilename(star)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Unable to generate admin certificate:', error instanceof Error ? error.message : 'Unknown error');
    return Response.json({ error: 'This certificate could not be generated. Please try again.' }, { status: 500 });
  }
}
