import { requireAdmin,isAdminConfigured } from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{const admin=await requireAdmin(request);return Response.json({adminEmail:admin.email,storage:{driver:process.env.DATABASE_URL?'postgres':'local',configured:!!process.env.DATABASE_URL||!process.env.VERCEL},authentication:{configured:isAdminConfigured()},environment:process.env.NODE_ENV==='production'?'production':'development',appUrl:process.env.APP_URL||new URL(request.url).origin,version:'2.0.0'},{headers:{'Cache-Control':'no-store'}});}
  catch(error){if(error instanceof Response)return error;return Response.json({error:'Unable to read settings.'},{status:500});}
}
