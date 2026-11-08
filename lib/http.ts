/** Reads a JSON request without buffering an unbounded payload, including chunked requests. */
export async function readJsonBody<T = unknown>(request: Request, maxBytes = 16_384): Promise<T> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('A positive request limit is required.');
  const failure = (message: string, status: number) => Response.json({ error: message }, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > maxBytes) {
    await request.body?.cancel().catch(() => undefined);
    throw failure('This request is too large.', 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw failure('Please send valid JSON.', 400);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw failure('This request is too large.', 413);
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof Response) throw error;
    await reader.cancel().catch(() => undefined);
    throw failure('Please send valid JSON.', 400);
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text) as T; }
  catch { throw failure('Please send valid JSON.', 400); }
}
