import { getSiteContent } from '@/lib/content';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({content:await getSiteContent()},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Unable to load website content.'},{status:503});}}
