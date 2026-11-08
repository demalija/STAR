'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Sparkle } from '@/components/StarMap';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/admin/auth/session', { cache: 'no-store' }).then(r => r.json()).then(data => setConfigured(data.configured === true)).catch(() => setConfigured(null));
  }, []);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to sign in. Please try again.');
      window.location.assign('/admin');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to connect. Please try again.'); setBusy(false); }
  }
  return <main className="studio-login-page">
    <Link className="studio-back" href="/"><ArrowLeft size={15} /> Back to Asteria</Link>
    <div className="studio-login-art" aria-hidden="true"><div className="studio-login-orbit" /><div className="studio-login-orbit second" /><Sparkle size={90} /><span>A LITTLE WONDER. THOUGHTFULLY MANAGED.</span></div>
    <section className="studio-login-card">
      <div className="studio-brand"><Sparkle size={31} /><span>asteria</span><small>STUDIO</small></div>
      <div className="studio-kicker">YOUR LITTLE UNIVERSE, IN YOUR HANDS</div>
      <h1>Welcome <em>back.</em></h1>
      <p className="studio-login-intro">A quiet space to care for every star, story, and little detail.</p>
      {configured === false && <div className="studio-setup-note"><ShieldCheck size={20}/><div><strong>Set up your owner account</strong><p>Configure <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD_HASH</code>, and <code>AUTH_SECRET</code> in your hosting environment. Generate a password hash with <code>npm run admin:password</code>. There is no default password.</p></div></div>}
      <form onSubmit={login}>
        <label htmlFor="admin-email">Email address</label><input id="admin-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        <label htmlFor="admin-password">Password</label><div className="studio-password"><input id="admin-password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
        {error && <p className="studio-error" role="alert">{error}</p>}
        <button type="submit" className="studio-button primary studio-login-submit" disabled={busy || configured === false}>{busy ? <><LoaderCircle className="studio-spin" size={17}/> Signing in…</> : <>Enter the studio <ArrowRight size={17}/></>}</button>
      </form>
      <p className="studio-login-security"><LockKeyhole size={12}/> Private access for the Asteria owner</p>
    </section>
  </main>;
}
