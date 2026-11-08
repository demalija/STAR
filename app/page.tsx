import type { Metadata } from 'next';
import Link from 'next/link';
import HomeExperience from '@/components/HomeExperience';
import { getSiteContent } from '@/lib/content';
import { getAdminSession } from '@/lib/auth';
import { Sparkle } from '@/components/StarMap';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata>{const content=await getSiteContent();return{title:content.seoTitle,description:content.seoDescription};}
export default async function Home(){
 const content=await getSiteContent();
 if(content.maintenanceMode&&!await getAdminSession())return <main className="maintenance-page"><div className="wordmark"><Sparkle size={34}/>{content.brandName.toLowerCase()}</div><Sparkle size={52}/><h1>A little more magic<br/><em>is on its way.</em></h1><p>{content.maintenanceMessage}</p>{content.contactEmail&&<a href={`mailto:${content.contactEmail}`}>Get in touch</a>}<Link href="/admin/login">Studio sign in</Link></main>;
 return <HomeExperience content={content}/>;
}
