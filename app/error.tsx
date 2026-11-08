'use client';
import Link from 'next/link';
import {Sparkle} from '@/components/StarMap';
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <main className="maintenance-page"><Sparkle size={45}/><h1>A little cloud<br/><em>across the stars.</em></h1><p>Something went wrong while loading this page. Your gift hasn’t disappeared. Please try again in a moment.</p><button className="button button-dark" onClick={reset}>Try again</button><Link href="/">Back to Asteria</Link></main>;
}
