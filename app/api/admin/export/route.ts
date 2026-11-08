import { requireAdmin } from '@/lib/auth';
import { listStars } from '@/lib/stars';
export const dynamic='force-dynamic';
function cell(value:unknown){let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export async function GET(request:Request){
  try{
    await requireAdmin(request);
    const columns=['code','starName','recipientName','senderName','email','occasion','dedicationDate','status','createdAt','dedication'] as const;
    const lines=[columns.map(cell).join(',')];
    let page=1,pages=1;
    do{const result=await listStars({page,limit:100});pages=result.pages;for(const star of result.stars)lines.push(columns.map(key=>cell(star[key])).join(','));page++;}while(page<=pages);
    return new Response('\uFEFF'+lines.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="asteria-dedications.csv"','Cache-Control':'private, no-store'}});
  }catch(error){if(error instanceof Response)return error;return Response.json({error:'Unable to export dedications.'},{status:500});}
}
