import Link from 'next/link';
import {Sparkle} from '@/components/StarMap';
export default function NotFound(){return <main className="maintenance-page"><Sparkle size={45}/><h1>A little lost<br/><em>among the stars?</em></h1><p>This page isn’t part of our universe. Let’s get you back to somewhere wonderful.</p><Link className="button button-dark" href="/">Back to Asteria</Link></main>;}
