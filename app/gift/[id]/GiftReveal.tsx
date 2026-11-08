'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Copy, Download, Gift, Heart, LoaderCircle, Sparkles, Star } from 'lucide-react';
import '../gift.css';

type Dedication = {
  id: string;
  code: string;
  starName: string;
  recipientName: string;
  senderName: string;
  dedication: string;
  occasion?: string;
  dedicationDate?: string;
  createdAt: string;
  constellation: string;
  coordinates: { ra: string | number; dec: string | number };
  distance?: number | string;
};

const sparkles = Array.from({ length: 48 }, (_, i) => ({
  left: `${(i * 37 + 9) % 100}%`,
  top: `${(i * 61 + 3) % 100}%`,
  animationDelay: `${(i % 7) * -0.8}s`,
  width: i % 6 === 0 ? 3 : 1.5,
  height: i % 6 === 0 ? 3 : 1.5,
}));

export default function GiftReveal({ id }: { id: string }) {
  const [star, setStar] = useState<Dedication | null>(null);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<'wrapped' | 'opening' | 'revealed'>('wrapped');
  const [copied, setCopied] = useState(false);
  const revealTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/stars/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'We couldn’t find this star dedication.');
        setStar(data.star);
      })
      .catch((err: Error) => { if (err.name !== 'AbortError') setError(err.message); });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (stage !== 'opening') return;
    const timeout = setTimeout(() => setStage('revealed'), 1600);
    return () => clearTimeout(timeout);
  }, [stage]);

  useEffect(() => {
    if (stage === 'revealed') revealTitle.current?.focus({ preventScroll: true });
  }, [stage]);

  async function copyGift() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Your browser couldn’t copy the link. You can copy it from the address bar.');
    }
  }

  const date = star ? new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(star.dedicationDate || star.createdAt)) : '';

  return (
    <div className={`gift-page gift-stage-${stage}`}>
      <header className="gift-header">
        <Link className="gift-wordmark" href="/" aria-label="Asteria home"><Sparkles strokeWidth={1.25} size={25} /> asteria<span>®</span></Link>
        <span className="gift-header-note"><span /> A LITTLE PIECE OF FOREVER</span>
        <Link className="gift-home" href="/"><ArrowLeft size={15} /> Back to earth</Link>
      </header>

      {!star && !error && <main className="gift-status" aria-live="polite"><LoaderCircle className="gift-spinner" size={30} strokeWidth={1} /><p>Finding your place in the universe…</p></main>}
      {!star && error && <main className="gift-status"><Star size={38} strokeWidth={1} /><h1>This star is a little out of reach.</h1><p>{error}</p><Link href="/" className="gift-primary">Discover Asteria <ArrowUpRight size={16} /></Link></main>}

      {star && stage !== 'revealed' && (
        <main className="gift-unwrapping" aria-live="polite">
          <div className="gift-intro"><span className="gift-eyebrow">A GIFT FROM {star.senderName.toUpperCase()}</span><h1>Some things are<br />written in the <em>stars.</em></h1><p>{star.recipientName}, there’s a little magic waiting for you.</p></div>
          <div className="gift-envelope-scene">
            <div className="gift-ambient-stars" aria-hidden="true">{sparkles.map((style, i) => <span style={style} key={i} />)}</div>
            <div className="gift-orbit gift-orbit-one" aria-hidden="true" /><div className="gift-orbit gift-orbit-two" aria-hidden="true" />
            <div className="gift-envelope">
              <div className="gift-envelope-flap" />
              <div className="gift-envelope-card"><Sparkles size={38} strokeWidth={1} /><span>the universe has a little secret</span></div>
              <div className="gift-envelope-front"><span className="gift-envelope-constellation">✧ · · ✦ · · ✧</span><span>FOR {star.recipientName.toUpperCase()}</span></div>
              <button className="gift-wax-seal" onClick={() => setStage('opening')} disabled={stage === 'opening'} aria-label="Break the seal and unwrap your gift"><Sparkles size={30} strokeWidth={1} /></button>
            </div>
            <span className="gift-envelope-hint">{stage === 'opening' ? 'A small moment. An infinite feeling.' : 'BREAK THE SEAL. BEGIN THE MAGIC.'}</span>
          </div>
          <button className="gift-primary" onClick={() => setStage('opening')} disabled={stage === 'opening'}>{stage === 'opening' ? <><LoaderCircle className="gift-spinner" size={17} /> Opening your universe…</> : <><Gift size={16} strokeWidth={1.5} /> Unwrap your gift <ArrowUpRight size={16} /></>}</button>
          <div className="gift-bottom-note"><Heart size={12} /> Made for you. Meant for forever.</div>
        </main>
      )}

      {star && stage === 'revealed' && (
        <main className="gift-reveal" aria-live="polite">
          <div className="gift-reveal-intro"><span className="gift-eyebrow">THE UNIVERSE JUST GOT A LITTLE MORE PERSONAL</span><h1 ref={revealTitle} tabIndex={-1}>A star. A story.<br /><em>Yours, forever.</em></h1><p>{star.recipientName}, this little corner of the cosmos is dedicated to you.</p></div>
          <article className="gift-certificate" aria-label={`Star dedication certificate for ${star.starName}`}>
            <div className="gift-certificate-sky">
              <div className="gift-ambient-stars" aria-hidden="true">{sparkles.map((style, i) => <span style={style} key={i} />)}</div>
              <div className="gift-chart-orbit gift-chart-orbit-one" /><div className="gift-chart-orbit gift-chart-orbit-two" />
              <span className="gift-sky-label">YOUR PLACE IN THE UNIVERSE</span>
              <div className="gift-star-glow" aria-hidden="true"><i /><span>✦</span></div>
              <span className="gift-sky-coordinates">{star.coordinates.ra} &nbsp; / &nbsp; {star.coordinates.dec}</span>
              <span className="gift-sky-caption">{star.constellation} constellation</span>
            </div>
            <div className="gift-certificate-content">
              <span className="gift-certificate-kicker"><Sparkles size={14} /> A CELESTIAL DEDICATION</span>
              <h2>{star.starName}</h2>
              <p className="gift-dedicated-to">Dedicated with love to <strong>{star.recipientName}</strong></p>
              <div className="gift-certificate-divider"><span />✦<span /></div>
              <blockquote>“{star.dedication}”</blockquote>
              <p className="gift-signature">With all my love,<span>{star.senderName}</span></p>
              <div className="gift-certificate-details"><div><span>WRITTEN IN THE STARS</span><strong>{date}</strong></div><div><span>DEDICATION NUMBER</span><strong>{star.code}</strong></div></div>
              <div className="gift-certificate-footer"><span className="gift-small-wordmark">✧ asteria</span><span>A symbolic dedication, written in the stars.</span></div>
            </div>
          </article>
          <div className="gift-reveal-actions"><button className="gift-primary" onClick={() => window.print()} title="Print your certificate or save it as a PDF"><Download size={15} /> Download certificate <ArrowUpRight size={16} /></button><button className="gift-secondary" onClick={copyGift}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Gift link copied' : 'Copy gift link'}</button></div>
          {error && <p className="gift-copy-error" role="status">{error}</p>}
          <p className="gift-reveal-footnote">Some gifts are opened once. This one is there every time you look up.</p>
          <Link className="gift-pass-it-on" href="/">Make someone else feel infinite <ArrowUpRight size={14} /></Link>
        </main>
      )}

      <footer className="gift-page-footer"><span>A little wonder goes a long way.</span><span>© {new Date().getFullYear()} Asteria</span></footer>
    </div>
  );
}
