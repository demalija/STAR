import { generateCertificate, certificateFilename } from '@/lib/certificate';
import { getSiteContent } from '@/lib/content';
import { getStar } from '@/lib/stars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const star = await getStar(id);
    if (!star) return Response.json({ error: 'This certificate could not be found.' }, { status: 404 });
    const content = await getSiteContent();
    const bytes = await generateCertificate(star, content);
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${certificateFilename(star)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Unable to generate certificate:', error instanceof Error ? error.message : 'Unknown error');
    return Response.json({ error: 'Your certificate could not be generated. Please try again.' }, { status: 500 });
  }
}
