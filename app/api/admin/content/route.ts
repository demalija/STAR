import { readJsonBody } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { getSiteContent, saveSiteContent } from '@/lib/content';
import { ContentValidationError } from '@/lib/content-schema';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){
  try{await requireAdmin(request);return Response.json({content:await getSiteContent()},{headers});}
  catch(error){if(error instanceof Response)return error;return Response.json({error:'Unable to load website content.'},{status:500,headers});}
}
export async function PUT(request:Request){
  try{
    await requireAdmin(request);
    const input=await readJsonBody(request,60000);
    const value=input&&typeof input==='object'&&'content' in input?input.content:input;
    return Response.json({content:await saveSiteContent(value)},{headers});
  }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof ContentValidationError?error.message:'Unable to save website content.'},{status:error instanceof ContentValidationError?400:500,headers});}
}
