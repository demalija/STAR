import type {Metadata} from 'next';
import GiftReveal from './GiftReveal';
import {getSiteContent} from '@/lib/content';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata>{const c=await getSiteContent();return{title:`${c.tagline} · ${c.brandName}`,description:'Someone has written your name in the stars. Unwrap your personal star dedication.',robots:{index:false,follow:false}};}
export default async function GiftPage({params}:{params:Promise<{id:string}>}){
 const [{id},c]=await Promise.all([params,getSiteContent()]);
 return <GiftReveal id={id} brandName={c.brandName} tagline={c.tagline} certificateTitle={c.certificateTitle} certificateSubtitle={c.certificateSubtitle}/>;
}
