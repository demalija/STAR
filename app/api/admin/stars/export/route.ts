import { requireAdmin } from '@/lib/auth';
import { listStars } from '@/lib/stars';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Spreadsheet programs evaluate leading formula characters even inside quoted CSV cells.
function cell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/u.test(text) || /^[\t\r]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const query = new URL(request.url).searchParams;
    const columns = ['id','code','starName','recipientName','senderName','email','dedication','occasion','dedicationDate','status','createdAt','updatedAt'] as const;
    const first = await listStars({ search: query.get('search') ?? '', status: query.get('status') ?? '', page: 1, limit: 100 });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`\uFEFF${columns.map(cell).join(',')}\r\n`));
        try {
          for (let page = 1; page <= first.pages; page++) {
            const result = page === 1 ? first : await listStars({ search: query.get('search') ?? '', status: query.get('status') ?? '', page, limit: 100 });
            for (const star of result.stars) controller.enqueue(encoder.encode(`${columns.map(key=>cell(star[key])).join(',')}\r\n`));
          }
          controller.close();
        } catch (error) { controller.error(error); }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="asteria-dedications.csv"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: 'Unable to export the dedication registry.' }, { status: 500 });
  }
}
