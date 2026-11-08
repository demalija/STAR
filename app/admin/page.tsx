import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import AdminDashboard from './AdminDashboard';
import './admin.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Studio · Asteria', robots: { index: false, follow: false } };
export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  return <AdminDashboard email={session.email} />;
}
