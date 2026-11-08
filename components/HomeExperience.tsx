'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight, ChevronDown, Gift, Heart, Infinity as InfinityIcon, Check, X, ArrowLeft, LoaderCircle, Copy, Link as LinkIcon, Sparkles, ShieldCheck, Menu } from 'lucide-react';
import StarMap, { Sparkle } from '@/components/StarMap';
import type { SiteContent } from '@/lib/content-schema';

type Modal = 'name' | 'unwrap' | 'closed' | null;
type CreatedStar = { id: string; code: string; starName: string; recipientName: string };
export default function HomeExperience({content}: {content: SiteContent}) {
  const occasions=content.occasions.map((item,i)=>({...item,icon:[Heart,Sparkles,InfinityIcon][i],className:['love','beginning','memory'][i]}));
  const faq=content.faqs.map(item=>[item.question,item.answer]);
  const [modal, setModal] = useState<Modal>(null);
  const [step, setStep] = useState(0);
  const [occasion, setOccasion] = useState('Just because');
  const [created, setCreated] = useState<CreatedStar | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState(false);
  const [giftInput, setGiftInput] = useState('');
  const [form, setForm] = useState({ starName: '', recipientName: '', senderName: '', dedication: '', dedicationDate: new Date().toISOString().slice(0, 10) });
  const dialog = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (modal) { dialog.current?.showModal(); document.body.style.overflow = 'hidden'; }
    else { dialog.current?.close(); document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [modal]);
  function openNaming(selected = 'Just because') { if(!content.acceptingDedications){setModal('closed');return;} setOccasion(selected); setStep(0); setCreated(null); setError(''); setModal('name'); setMenu(false); }
  function closeModal() { if (!busy) setModal(null); }
  function update(key: keyof typeof form, value: string) { setForm(f => ({ ...f, [key]: value })); setError(''); }
  function nextStep(event: React.FormEvent) { event.preventDefault(); setError(''); setStep(s => s + 1); }
  async function createGift() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/stars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, occasion }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setCreated(data.star); setStep(3);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to reach the stars. Please try again.'); }
    finally { setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/gift/${created?.id}`); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setError('Please select and copy the gift link below.'); }
  }
  function unwrap(event: React.FormEvent) {
    event.preventDefault(); setError('');
    let id = giftInput.trim();
    if (id.includes('/gift/')) id = id.split('/gift/')[1].split(/[?#/]/)[0];
    if (!/^(?:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|AST-[a-f0-9]{8}(?:[a-f0-9]{8})?|demo)$/i.test(id)) { setError('Enter the gift link or the AST code you received.'); return; }
    window.location.assign(`/gift/${encodeURIComponent(id)}`);
  }

  return <>
    <div className="announcement"><Sparkle size={11}/><span>{content.announcement}</span><Sparkle size={11}/></div>
    <header className="site-header container">
      <Link href="/" className="wordmark" aria-label={`${content.brandName} home`}><Sparkle size={31}/>{content.brandName.toLowerCase()}<span className="wordmark-dot">®</span></Link>
      <nav className={menu ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
        <a href="#how-it-works" onClick={()=>setMenu(false)}>How it works</a><a href="#our-story" onClick={()=>setMenu(false)}>Our little universe</a>
        <button onClick={()=>{setModal('unwrap');setError('');setMenu(false);}}><Gift size={15}/> Unwrap a gift</button>
      </nav>
      <button className="nav-cta" onClick={()=>openNaming()}>Name a star <ArrowUpRight size={15}/></button>
      <button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button>
    </header>

    <main>
      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow"><span/> {content.heroEyebrow}</div>
          <h1><span className="cms-lines">{content.heroTitle}</span><br/><em>{content.heroHighlight}</em><Sparkle className="heading-star" size={43}/></h1>
          <p className="hero-description"><span className="cms-lines">{content.heroDescription}</span></p>
          <div className="hero-actions"><button className="button button-dark" onClick={()=>openNaming()}>{content.heroButton} <ArrowUpRight size={18}/></button><Link className="text-button" href="/gift/demo"><span className="play-icon">▶</span> A peek at the magic</Link></div>
          <div className="hero-reassurance"><span className="tiny-star-group">✦ ✦ ✦</span><span>A personal dedication. An unforgettable feeling.</span></div>
        </div>
        <div className="hero-art">
          <div className="orbit-word">A LITTLE WONDER. A FOREVER MEMORY.</div>
          <div className="celestial-window">
            <div className="chart-topline"><span>THE UNIVERSE HAS A PLACE FOR YOU</span><Sparkle size={13}/></div>
            <StarMap/>
            <div className="star-caption"><span className="caption-line"/><span>Amelia’s star<small>ONE IN A BILLION. JUST LIKE YOU.</small></span></div>
            <div className="map-bottom"><span>38° 47′ N &nbsp; 09° 08′ W</span><span>ALWAYS LOOK UP <ArrowUpRight size={11}/></span></div>
          </div>
          <div className="keepsake-card"><div className="keepsake-icon"><Sparkle size={31}/></div><div><span>A STAR NAMED AFTER YOU</span><strong>Amelia</strong><p>“In every universe, I’d find you.”</p></div><div className="card-stamp">A<br/><span>✦</span></div></div>
          <div className="handwritten-note">a little closer to infinity <svg viewBox="0 0 60 35" fill="none"><path d="M2 2c32 0 14 30 49 23m-9-7 10 7-9 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg></div>
          <div className="art-sparkle"><Sparkle size={39}/></div>
        </div>
      </section>

      <section className="promise-strip container" aria-label="Your gift includes"><div><Sparkle size={17}/><span>A star with their name</span></div><span className="strip-dot">·</span><div><Heart size={16}/><span>Your words, kept forever</span></div><span className="strip-dot">·</span><div><Gift size={16}/><span>A little magic to unwrap</span></div><span className="strip-dot">·</span><div><InfinityIcon size={19}/><span>A keepsake to hold onto</span></div></section>

      <section className="occasions-section container" id="occasions"><div className="section-heading"><div><div className="eyebrow">EVERY KIND OF LOVE HAS A PLACE UP THERE</div><h2>{content.occasionsHeading}<br className="mobile-break"/> <em>{content.occasionsHighlight}</em></h2></div><span className="section-aside">No occasion too small.<br/>No love too big.</span></div>
        <div className="occasion-grid">{occasions.map(({title,subtitle,icon:Icon,occasion:choice,className})=><button className={`occasion-card ${className}`} key={title} onClick={()=>openNaming(choice)}><div className="occasion-art"><div className="occasion-orbit"/><Icon size={30} strokeWidth={1}/><Sparkle className="occasion-sparkle" size={12}/></div><div className="occasion-text"><h3>{title}</h3><p>{subtitle}</p></div><span className="occasion-arrow"><ArrowUpRight size={18}/></span></button>)}</div>
      </section>

      <section className="how-section" id="how-it-works"><div className="container"><div className="center-heading"><div className="eyebrow">FROM YOUR HEART TO THEIR UNIVERSE</div><h2>{content.howHeading}<br/> <em>{content.howHighlight}</em></h2><p>Something extraordinary, made simply.</p></div><div className="steps-grid">{content.steps.map((item,i)=>({...item,n:String(i+1).padStart(2,'0'),icon:[Sparkles,Heart,Gift][i]})).map(({n,icon:Icon,title,text})=><div className="how-step" key={n}><span className="step-number">{n}</span><div className="step-icon"><Icon size={25} strokeWidth={1.2}/></div><h3>{title}</h3><p>{text}</p></div>)}</div><button className="button button-dark" onClick={()=>openNaming()}>Let’s make some magic <ArrowUpRight size={18}/></button></div></section>

      <section className="story-section container" id="our-story"><div className="story-visual"><div className="story-moon"/><Sparkle className="story-star-one" size={37}/><Sparkle className="story-star-two" size={16}/><div className="story-quote">“You are my sun,<br/>my moon,<br/><em>and all my stars.</em>”<span>— E. E. CUMMINGS</span></div></div><div className="story-copy"><div className="eyebrow">{content.storyEyebrow}</div><h2><span className="cms-lines">{content.storyTitle}</span> <em>{content.storyHighlight}</em></h2><p>{content.storyParagraph1}</p><p>{content.storyParagraph2}</p><a href="#occasions" className="story-link">Find your reason to look up <ArrowRight size={17}/></a></div></section>

      <section className="faq-section container"><div><div className="eyebrow">A LITTLE CURIOUS?</div><h2>{content.faqHeading}<br/><em>{content.faqHighlight}</em></h2><Sparkle className="faq-star" size={45}/></div><div className="faq-list">{faq.map(([question,answer])=><details key={question}><summary>{question}<ChevronDown size={18}/></summary><p>{answer}</p></details>)}</div></section>
      <section className="final-cta container"><Sparkle size={31}/><h2>{content.finalHeading}<br/><em>{content.finalHighlight}</em></h2><button className="button button-dark" onClick={()=>openNaming()}>Name their star <ArrowUpRight size={18}/></button><p>Made with love. Meant to mean something.</p></section>
    </main>
    <footer className="footer container"><div className="footer-top"><Link href="/" className="wordmark"><Sparkle size={26}/>{content.brandName.toLowerCase()}</Link><p>{content.footerTagline}</p><Link href="/admin" className="footer-admin">Studio login</Link>{content.contactEmail&&<a href={`mailto:${content.contactEmail}`}>Get in touch</a>}<a href="#how-it-works">How the magic works <ArrowUpRight size={13}/></a></div><div className="footer-bottom"><p>© {new Date().getFullYear()} {content.brandName}. For the love of looking up.</p><span>Symbolic dedications. Real feelings. <Sparkle size={10}/></span></div><p className="registry-note">Asteria offers symbolic star dedications, not official astronomical names or ownership. Star maps and celestial details are artistic keepsakes.</p></footer>

    <dialog ref={dialog} className="magic-dialog" onCancel={event=>{event.preventDefault();closeModal();}} onClick={event=>{if(event.target===event.currentTarget)closeModal();}} aria-labelledby="dialog-title">
      <div className="dialog-content"><button className="dialog-close" aria-label="Close dialog" onClick={closeModal} disabled={busy}><X size={21}/></button>
      {modal==='closed'?<div className="unwrap-dialog"><div className="modal-emblem"><Sparkle size={30}/></div><h2 id="dialog-title">A little pause<br/><em>between the stars.</em></h2><p>New dedications are temporarily paused. Your existing gift links still work. Come back soon for a little more magic.</p><button className="button button-dark" onClick={closeModal}>Back to the universe</button></div>:modal==='unwrap'?<div className="unwrap-dialog"><div className="modal-emblem"><Gift size={29} strokeWidth={1.2}/></div><div className="eyebrow">SOMETHING WONDERFUL IS WAITING</div><h2 id="dialog-title">A little gift.<br/><em>An entire universe.</em></h2><p>Someone thinks you’re a star. Enter the gift link or code they shared with you.</p><form onSubmit={unwrap}><label htmlFor="gift-code">Your gift link or code</label><input id="gift-code" value={giftInput} onChange={e=>setGiftInput(e.target.value)} required placeholder="Your AST-… code or gift link" autoComplete="off"/>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button button-dark" type="submit">Find my gift <ArrowRight size={18}/></button></form><Link href="/gift/demo" className="demo-link">Just curious? Experience a sample gift <ArrowUpRight size={13}/></Link></div>:<>
        <div className="dialog-brand"><Sparkle size={18}/> A LITTLE PIECE OF FOREVER</div>
        {step<3&&<div className="wizard-progress">{['Their star','Your words','The little details'].map((label,i)=><div className={i<=step?'active':''} key={label}><span>{i<step?<Check size={12}/>:i+1}</span><small>{label}</small></div>)}</div>}
        {step===0&&<form ref={formRef} onSubmit={nextStep}><div className="eyebrow">FIRST, THE PERSON BEHIND THE STAR</div><h2 id="dialog-title">Who lights up<br/><em>your world?</em></h2><p className="dialog-intro">Every star has a story. This one begins with them.</p><div className="field"><label htmlFor="recipient">Their name</label><input id="recipient" autoComplete="off" required maxLength={80} placeholder="e.g. Amelia" value={form.recipientName} onChange={e=>update('recipientName',e.target.value)}/></div><div className="field"><label htmlFor="star-name">What shall we call their star?</label><input id="star-name" required maxLength={60} placeholder="Their name, a nickname, your little secret…" value={form.starName} onChange={e=>update('starName',e.target.value)}/><small>Something that feels like them. Up to 60 characters.</small></div><div className="field"><label htmlFor="occasion">A reason to celebrate</label><select id="occasion" value={occasion} onChange={e=>setOccasion(e.target.value)}>{['Just because','Love & anniversary','Birthday','A new beginning','In loving memory','Thank you','Friendship'].map(o=><option key={o}>{o}</option>)}</select></div><button type="submit" className="button button-dark wizard-next">Write their dedication <ArrowRight size={17}/></button></form>}
        {step===1&&<form onSubmit={nextStep}><div className="eyebrow">THE PART ONLY YOU CAN WRITE</div><h2 id="dialog-title">A few words.<br/><em>A forever feeling.</em></h2><p className="dialog-intro">What would you say to {form.recipientName}, if the sky was listening?</p><div className="field"><label htmlFor="dedication">Your dedication</label><textarea id="dedication" required maxLength={1200} rows={5} placeholder="In every universe, I would still choose you…" value={form.dedication} onChange={e=>update('dedication',e.target.value)}/><div className="field-bottom"><button className="inspiration-button" type="button" onClick={()=>update('dedication',`In a sky full of stars, you will always be my favorite. ${form.recipientName}, this little piece of forever is yours.`)}><Sparkles size={12}/> A little inspiration</button><small>{form.dedication.length}/1200</small></div></div><div className="field"><label htmlFor="sender">With love, from</label><input id="sender" required maxLength={80} autoComplete="name" placeholder="Your name" value={form.senderName} onChange={e=>update('senderName',e.target.value)}/></div><div className="wizard-actions"><button type="button" className="back-button" onClick={()=>setStep(0)}><ArrowLeft size={16}/> Back</button><button type="submit" className="button button-dark">One last little thing <ArrowRight size={17}/></button></div></form>}
        {step===2&&<div><div className="eyebrow">ALMOST READY TO MEET THE STARS</div><h2 id="dialog-title">Made by you.<br/><em>Only for them.</em></h2><div className="dedication-preview"><Sparkle size={25}/><span>A STAR DEDICATED TO</span><h3>{form.starName}</h3><p>“{form.dedication}”</p><small>For {form.recipientName} · With love, {form.senderName}</small></div><div className="field"><label htmlFor="dedication-date">A date to remember</label><input id="dedication-date" type="date" required value={form.dedicationDate} onChange={e=>update('dedicationDate',e.target.value)}/></div><p className="creation-note"><ShieldCheck size={16}/> Your gift is free to create. Share it when the moment feels right.</p><p className="symbolic-note">A symbolic dedication with an illustrated star map, made for the heart.</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="wizard-actions"><button type="button" className="back-button" disabled={busy} onClick={()=>setStep(1)}><ArrowLeft size={16}/> Back</button><button className="button button-dark" disabled={busy||!form.dedicationDate} onClick={createGift}>{busy?<><LoaderCircle className="spin" size={18}/> Creating your little universe…</>:<>Create their star <Sparkle size={17}/></>}</button></div></div>}
        {step===3&&created&&<div className="success-dialog"><div className="success-orbit"><Sparkle size={47}/><i/><i/></div><div className="eyebrow">A NEW LIGHT IN YOUR UNIVERSE</div><h2 id="dialog-title">{created.starName}<br/><em>is written in the stars.</em></h2><p>Your gift for {created.recipientName} is ready. Send this secret link and let the magic unfold.</p><label htmlFor="share-url">Their personal gift link</label><div className="share-field"><LinkIcon size={16}/><input id="share-url" readOnly value={typeof window!=='undefined'?`${window.location.origin}/gift/${created.id}`:''} onClick={e=>e.currentTarget.select()}/><button aria-label="Copy gift link" onClick={copyLink}>{copied?<Check size={17}/>:<Copy size={17}/>}</button></div><p className="copy-feedback" aria-live="polite">{copied?'A little magic, copied to your clipboard.':`Gift code: ${created.code}`}</p>{error&&<p className="form-error" role="alert">{error}</p>}<Link className="button button-dark" href={`/gift/${created.id}`}>Unwrap their gift <Gift size={18}/></Link><button className="text-button create-another" onClick={()=>openNaming()}>Make someone else’s universe brighter <ArrowUpRight size={14}/></button></div>}
      </>}
      </div>
    </dialog>
  </>;
}
