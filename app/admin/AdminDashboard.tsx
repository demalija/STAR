'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Clipboard, ExternalLink, FileText, Globe2, LayoutDashboard, LoaderCircle, LogOut, Menu, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, Star, Trash2, X } from 'lucide-react';
import { Sparkle } from '@/components/StarMap';
import WebsiteEditor from './WebsiteEditor';

type View = 'overview' | 'dedications' | 'website' | 'settings';
type Status = 'published' | 'draft' | 'archived';
interface Dedication { id: string; code: string; starName: string; recipientName: string; senderName: string; dedication: string; occasion: string; dedicationDate: string; createdAt: string; updatedAt?: string; status?: Status; email?: string }
interface Overview { total: number; published: number; draft: number; archived: number; recent: Dedication[]; daily: { date: string; count: number }[]; occasions: { name: string; count: number }[] }
interface Registry { stars: Dedication[]; total: number; page: number; pages: number }
const emptyForm = () => ({ starName: '', recipientName: '', senderName: '', dedication: '', occasion: 'Just because', dedicationDate: new Date().toISOString().slice(0, 10), email: '', status: 'published' as Status });
const views = [{ id: 'overview' as View, label: 'Overview', icon: LayoutDashboard }, { id: 'dedications' as View, label: 'Dedications', icon: Star }, { id: 'website' as View, label: 'Website content', icon: Globe2 }, { id: 'settings' as View, label: 'Settings & health', icon: Settings }];
const dateFormat = (date: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(date));
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const data = await response.json();
  if (response.status === 401) { window.location.assign('/admin/login'); throw new Error('Your session has ended. Please sign in again.'); }
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}

export default function AdminDashboard({ email }: { email: string }) {
  const [view, setView] = useState<View>('overview');
  const [navOpen, setNavOpen] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [registry, setRegistry] = useState<Registry>({ stars: [], total: 0, page: 1, pages: 1 });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState('');
  const [websiteDirty, setWebsiteDirty] = useState(false);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => { if (noticeTimer.current) clearTimeout(noticeTimer.current); setNotice(message); noticeTimer.current = setTimeout(() => setNotice(''), 4500); }, []);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (view === 'website') { setLoading(false); return; }
    setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        if (view === 'overview') setOverview(await api<Overview>('/api/admin/overview', { signal: controller.signal }));
        else if (view === 'dedications') setRegistry(await api<Registry>(`/api/admin/stars?search=${encodeURIComponent(query)}&status=${status === 'all' ? '' : status}&page=${page}&limit=10`, { signal: controller.signal }));
        else setSettings(await api<Record<string, unknown>>('/api/admin/settings', { signal: controller.signal }));
      } catch (err) { if (!(err instanceof Error && err.name === 'AbortError')) setError(err instanceof Error ? err.message : 'Unable to load the studio.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, view === 'dedications' ? 220 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [view, query, status, page, revision]);
  useEffect(() => {
    if (editorOpen) { dialog.current?.showModal(); document.body.style.overflow = 'hidden'; }
    else { dialog.current?.close(); document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [editorOpen]);
  function navigate(next: View) { if (view === 'website' && next !== 'website' && websiteDirty && !window.confirm('Leave without publishing your website changes?')) return; setWebsiteDirty(false); setView(next); setNavOpen(false); setError(''); }
  function newStar() { setEditingId(null); setForm(emptyForm()); setEditorError(''); setEditorOpen(true); }
  function editStar(star: Dedication) { setEditingId(star.id); setForm({ starName: star.starName, recipientName: star.recipientName, senderName: star.senderName, dedication: star.dedication, occasion: star.occasion, dedicationDate: star.dedicationDate, email: star.email || '', status: star.status || 'published' }); setEditorError(''); setEditorOpen(true); }
  async function saveStar(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setEditorError('');
    try {
      await api(editingId ? `/api/admin/stars/${editingId}` : '/api/admin/stars', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setEditorOpen(false); setRevision(r => r + 1); notify(editingId ? 'Dedication updated. Its certificate is ready.' : 'A new star is ready to shine.');
    } catch (err) { setEditorError(err instanceof Error ? err.message : 'Unable to save this dedication.'); }
    finally { setSaving(false); }
  }
  async function deleteStar(star: Dedication) {
    if (!window.confirm(`Permanently delete “${star.starName}”? Its gift link and certificate will stop working. This cannot be undone.`)) return;
    setError('');
    try { await api(`/api/admin/stars/${star.id}`, { method: 'DELETE' }); if (view === 'dedications' && registry.stars.length === 1 && page > 1) setPage(p => p - 1); setRevision(r => r + 1); notify('Dedication deleted.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete this dedication.'); }
  }
  async function copyGift(star: Dedication) {
    try { await navigator.clipboard.writeText(`${window.location.origin}/gift/${star.id}`); notify('Gift link copied.'); }
    catch { notify(`Gift link: ${window.location.origin}/gift/${star.id}`); }
  }
  async function logout() {
    if (websiteDirty && !window.confirm('Sign out without publishing your website changes?')) return;
    try { await api('/api/admin/auth/logout', { method: 'POST' }); window.location.assign('/admin/login'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign out.'); }
  }
  const maxDaily = Math.max(1, ...(overview?.daily || []).map(item => item.count));
  const activeTitle = views.find(item => item.id === view)?.label || 'Overview';
  const rows = view === 'overview' ? (overview?.recent || []) : registry.stars;
  return <div className="studio-shell">
    {navOpen && <button className="studio-nav-backdrop" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
    <aside className={`studio-sidebar ${navOpen ? 'is-open' : ''}`}>
      <Link href="/" className="studio-brand"><Sparkle size={30}/><span>asteria</span><small>STUDIO</small></Link>
      <div className="studio-workspace"><span className="studio-workspace-mark">A</span><div><strong>Your little universe</strong><span>OWNER WORKSPACE</span></div><ShieldCheck size={15}/></div>
      <span className="studio-nav-label">YOUR STUDIO</span>
      <nav aria-label="Studio navigation">{views.map(({id,label,icon: Icon}) => <button key={id} onClick={() => navigate(id)} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined}><Icon size={18} strokeWidth={1.6}/>{label}{id === 'dedications' && overview && <span className="studio-nav-count">{overview.total}</span>}</button>)}</nav>
      <div className="studio-sidebar-bottom"><div className="studio-sidebar-note"><Sparkle size={24}/><p>Every star has a story.<br/><em>You make them shine.</em></p></div><Link href="/" target="_blank" rel="noreferrer"><ExternalLink size={15}/> View your website <ArrowUpRight size={13}/></Link><button onClick={logout}><LogOut size={15}/> Sign out</button><div className="studio-owner"><span>{email[0]?.toUpperCase() || 'A'}</span><div><strong>Studio owner</strong><small>{email}</small></div></div></div>
    </aside>
    <div className="studio-main">
      <header className="studio-topbar"><div><button className="studio-mobile-menu" aria-label="Open studio navigation" onClick={() => setNavOpen(true)}><Menu size={21}/></button><span className="studio-breadcrumb">Studio <ChevronRight size={12}/> <strong>{activeTitle}</strong></span></div><span className="studio-private"><span/> PRIVATE WORKSPACE</span><Link href="/" target="_blank" rel="noreferrer" className="studio-topbar-site">View site <ArrowUpRight size={14}/></Link></header>
      <main className="studio-content">
        <div className="studio-page-heading"><div><div className="studio-kicker">A LITTLE CARE GOES A LONG WAY</div><h1>{view === 'overview' ? <>Your universe, <em>at a glance.</em></> : view === 'dedications' ? <>Every star. <em>Every story.</em></> : view === 'website' ? <>Make it feel <em>like you.</em></> : <>A little peace <em>of mind.</em></>}</h1><p>{view === 'overview' ? 'A thoughtful home for the gifts, words, and people that make Asteria.' : view === 'dedications' ? 'Create, care for, and share every personal dedication.' : view === 'website' ? 'Keep your words fresh. Changes appear across your public website.' : 'Your configuration, storage, and account — all in one place.'}</p></div>{view !== 'settings' && view !== 'website' && <button className="studio-button primary" onClick={newStar}><Plus size={17}/> New dedication</button>}</div>
        {notice && <div className="studio-toast" role="status"><CheckCircle2 size={17}/>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14}/></button></div>}
        {error && <div className="studio-error studio-global-error" role="alert">{error}<button onClick={() => setRevision(r => r + 1)}><RefreshCw size={14}/> Try again</button></div>}
        {loading && view !== 'dedications' && <div className="studio-loading" role="status"><LoaderCircle className="studio-spin" size={23}/><span>Gathering your little universe…</span></div>}
        {!loading && !error && view === 'overview' && overview && <>
          <div className="studio-stats">{[{label:'All dedications',value:overview.total,icon:Star,note:'Every story in your universe',className:'total'},{label:'Published gifts',value:overview.published,icon:CheckCircle2,note:'Ready to unwrap and share',className:'published'},{label:'Drafts',value:overview.draft,icon:FileText,note:'Little stories in the making',className:'draft'},{label:'Archived',value:overview.archived,icon:ShieldCheck,note:'Kept safely out of public view',className:'archived'}].map(({label,value,icon:Icon,note,className}) => <article className={`studio-stat ${className}`} key={label}><div><span>{label}</span><Icon size={18} strokeWidth={1.5}/></div><strong>{value.toLocaleString()}</strong><p>{note}</p></article>)}</div>
          <div className="studio-overview-grid"><section className="studio-panel studio-activity"><div className="studio-panel-heading"><div><h2>A little more light</h2><p>Dedications created over time</p></div><span className="studio-subtle-pill">{overview.daily.length} DAYS</span></div><div className="studio-chart" aria-label="Daily dedication counts">{overview.daily.length ? overview.daily.map(item => <div className="studio-chart-column" key={item.date} title={`${item.date}: ${item.count} dedications`}><span className="studio-chart-value">{item.count || ''}</span><div className="studio-chart-bar" style={{height: `${item.count / maxDaily * 116}px`}}/><span className="studio-chart-label">{new Date(`${item.date}T12:00:00Z`).getUTCDate()}</span></div>) : <p className="studio-empty-chart">Your first dedication begins the story.</p>}</div></section><section className="studio-panel studio-occasion-panel"><div className="studio-panel-heading"><div><h2>Reasons to look up</h2><p>The occasions behind the stars</p></div><Sparkle size={23}/></div><div className="studio-occasion-list">{overview.occasions.length ? overview.occasions.slice(0,5).map(item => <div key={item.name}><span><i/>{item.name}</span><strong>{item.count}</strong></div>) : <p>Your celebrations will appear here.</p>}</div></section></div>
        </>}
        {(!loading || view === 'dedications') && !error && (view === 'overview' || view === 'dedications') && <section className="studio-panel studio-registry" aria-busy={loading}><div className="studio-panel-heading"><div><h2>{view === 'overview' ? 'The latest little wonders' : 'Your dedication registry'}</h2><p>{view === 'overview' ? 'The newest stories written in your stars.' : `${registry.total.toLocaleString()} dedication${registry.total === 1 ? '' : 's'} in this view`}</p></div>{view === 'overview' ? <button className="studio-inline-button" onClick={() => navigate('dedications')}>View all <ArrowRight size={15}/></button> : <a href="/api/admin/export" className="studio-button subtle" download><ArrowDownToLine size={14}/> Export CSV</a>}</div>
          {view === 'dedications' && <div className="studio-registry-tools"><div className="studio-search"><Search size={16}/><input aria-label="Search dedications" placeholder="Search a name, a person, a gift code…" value={query} onChange={e => {setQuery(e.target.value);setPage(1);}}/>{query && <button aria-label="Clear search" onClick={() => {setQuery('');setPage(1);}}><X size={14}/></button>}</div><label className="studio-filter">Status <select aria-label="Filter by status" value={status} onChange={e => {setStatus(e.target.value);setPage(1);}}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label><button className="studio-icon-button" aria-label="Refresh dedications" onClick={() => setRevision(r => r + 1)}><RefreshCw size={16}/></button></div>}
          {loading && view === 'dedications' && <div className="studio-registry-refresh" role="status"><LoaderCircle className="studio-spin" size={12}/> Refreshing dedications…</div>}{rows.length ? <div className="studio-table-scroll"><table className="studio-table"><thead><tr><th>STAR & DEDICATION</th><th>THE PEOPLE</th><th>STATUS</th><th>CREATED</th><th><span className="studio-sr-only">Actions</span></th></tr></thead><tbody>{rows.map(star => <tr key={star.id}><td><div className="studio-star-cell"><span><Sparkle size={18}/></span><div><button className="studio-star-name" onClick={() => editStar(star)}>{star.starName}</button><small>{star.code}</small></div></div></td><td><span className="studio-recipient">{star.recipientName}</span><small className="studio-sender">From {star.senderName}</small></td><td><span className={`studio-status ${star.status || 'published'}`}><i/>{star.status || 'published'}</span></td><td><span className="studio-date">{dateFormat(star.createdAt)}</span></td><td><div className="studio-row-actions"><button aria-label={`Edit ${star.starName}`} title="Edit dedication" onClick={() => editStar(star)}><Pencil size={15}/></button><a href={`/api/admin/stars/${star.id}/certificate`} aria-label={`Download certificate for ${star.starName}`} title="Download PDF certificate" download><ArrowDownToLine size={15}/></a>{(star.status || 'published') === 'published' && <button aria-label={`Copy gift link for ${star.starName}`} title="Copy gift link" onClick={() => copyGift(star)}><Clipboard size={15}/></button>}<button className="danger" aria-label={`Delete ${star.starName}`} title="Delete dedication" onClick={() => deleteStar(star)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div> : <div className="studio-empty"><div><Sparkle size={34}/></div><h3>{query || status !== 'all' ? 'No stars in this part of the sky.' : 'Every universe begins with one star.'}</h3><p>{query || status !== 'all' ? 'Try another name or change your filters.' : 'Create your first dedication and give someone a little piece of forever.'}</p><button className="studio-button primary" onClick={newStar}><Plus size={15}/> Create a dedication</button></div>}
          {view === 'dedications' && registry.total > 0 && <div className="studio-pagination"><span>Page {registry.page} of {Math.max(1,registry.pages)}</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16}/></button><button aria-label="Next page" disabled={page >= registry.pages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16}/></button></div></div>}
        </section>}
        {view === 'website' && <WebsiteEditor onDirtyChange={setWebsiteDirty} onSaved={() => notify('Website updated. Your new words are live.')} />}
        {!loading && !error && view === 'settings' && settings && <SettingsView data={settings} email={email}/>}
        <footer className="studio-footer"><span>Made for the love of looking up.</span><span>ASTERIA STUDIO <Sparkle size={10}/></span></footer>
      </main>
    </div>
    <dialog ref={dialog} className="studio-dialog" aria-labelledby="studio-editor-title" onCancel={e => {e.preventDefault();if (!saving) setEditorOpen(false);}} onClick={e => {if(e.target === e.currentTarget && !saving)setEditorOpen(false);}}><form className="studio-editor" onSubmit={saveStar}><button type="button" className="studio-editor-close" aria-label="Close dedication editor" disabled={saving} onClick={() => setEditorOpen(false)}><X size={20}/></button><div className="studio-kicker">A STORY ONLY YOU CAN TELL</div><h2 id="studio-editor-title">{editingId ? 'A little more' : 'Create a little'} <em>{editingId ? 'care.' : 'wonder.'}</em></h2><p className="studio-editor-intro">{editingId ? 'Update this dedication. Its existing gift link stays the same.' : 'A named star, a personal message, and a gift to remember.'}</p><div className="studio-form-grid"><Field label="Star name" id="studio-star-name" value={form.starName} maxLength={60} onChange={value => setForm(f => ({...f,starName:value}))}/><Field label="Recipient name" id="studio-recipient" value={form.recipientName} maxLength={80} onChange={value => setForm(f => ({...f,recipientName:value}))}/><Field label="Sender name" id="studio-sender" value={form.senderName} maxLength={80} onChange={value => setForm(f => ({...f,senderName:value}))}/><Field label="Dedication date" id="studio-date" type="date" value={form.dedicationDate} onChange={value => setForm(f => ({...f,dedicationDate:value}))}/></div><div className="studio-field"><label htmlFor="studio-message">Personal dedication <small>{form.dedication.length}/1200</small></label><textarea id="studio-message" required rows={4} maxLength={1200} value={form.dedication} onChange={e => setForm(f => ({...f,dedication:e.target.value}))} placeholder="A little piece of your heart…"/></div><div className="studio-form-grid"><Field label="Occasion" id="studio-occasion" value={form.occasion} maxLength={60} onChange={value => setForm(f => ({...f,occasion:value}))}/><div className="studio-field"><label htmlFor="studio-status">Visibility</label><select id="studio-status" value={form.status} onChange={e => setForm(f => ({...f,status:e.target.value as Status}))}><option value="published">Published — gift is accessible</option><option value="draft">Draft — only visible in studio</option><option value="archived">Archived — gift is unavailable</option></select></div></div><Field label="Contact email (optional, private)" id="studio-email" type="email" value={form.email} required={false} maxLength={254} onChange={value => setForm(f => ({...f,email:value}))}/><p className="studio-editor-help"><ShieldCheck size={14}/> Contact email is never shown on the gift or certificate.</p>{editorError && <p role="alert" className="studio-error">{editorError}</p>}<div className="studio-editor-footer"><button type="button" className="studio-button subtle" disabled={saving} onClick={() => setEditorOpen(false)}>Cancel</button><button className="studio-button primary" disabled={saving} type="submit">{saving ? <LoaderCircle className="studio-spin" size={16}/> : <Check size={16}/>} {saving ? 'Saving your story…' : editingId ? 'Save dedication' : 'Create dedication'}</button></div></form></dialog>
  </div>;
}

function Field({label,id,value,onChange,type = 'text',required = true,maxLength}: {label:string;id:string;value:string;onChange:(value:string)=>void;type?:string;required?:boolean;maxLength?:number}) { return <div className="studio-field"><label htmlFor={id}>{label}</label><input id={id} type={type} value={value} required={required} maxLength={maxLength} onChange={e => onChange(e.target.value)}/></div>; }
function readableKey(key: string) { return key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, char => char.toUpperCase()); }
function SettingsView({data,email}: {data:Record<string,unknown>;email:string}) {
  return <div className="studio-settings-grid"><section className="studio-panel"><div className="studio-panel-heading"><div><h2>Your owner account</h2><p>Private, protected, and yours.</p></div><ShieldCheck size={22}/></div><div className="studio-setting-row"><span>Signed in as</span><strong>{email}</strong></div><div className="studio-setting-row"><span>Account role</span><strong>Owner</strong></div><p className="studio-setting-note">Update your account credentials in your hosting environment. Rotate AUTH_SECRET to end existing sessions. Secrets are never exposed in the studio.</p></section><section className="studio-panel"><div className="studio-panel-heading"><div><h2>Application health</h2><p>The configuration behind your universe.</p></div><Settings size={21}/></div><div className="studio-health-list">{Object.entries(data).map(([key,value]) => <div className="studio-setting-row" key={key}><span>{readableKey(key)}</span><strong>{typeof value === 'boolean' ? <span className={`studio-health ${value ? 'ready' : 'pending'}`}>{value ? <CheckCircle2 size={13}/> : <CircleHelp size={13}/>} {value ? 'Configured' : 'Not configured'}</span> : typeof value === 'object' && value !== null ? <span className="studio-health-details">{Object.entries(value as Record<string,unknown>).map(([k,v]) => <span key={k}>{readableKey(k)}: {typeof v === 'boolean' ? v ? 'Yes' : 'No' : String(v ?? 'Not set')}</span>)}</span> : String(value ?? 'Not set')}</strong></div>)}</div></section><section className="studio-panel studio-settings-guide"><div className="studio-panel-heading"><div><h2>A few things to keep safe</h2><p>Good habits for a growing universe.</p></div><FileText size={21}/></div><ul><li>Back up your dedication storage regularly.</li><li>Use HTTPS and a unique owner password in production.</li><li>Keep your database and authentication secrets in hosting settings.</li><li>Certificates are symbolic keepsakes, not official astronomical naming rights.</li></ul></section></div>;
}
