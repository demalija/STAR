import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import AdminLogin from './AdminLogin';
import '../admin.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Studio sign in · Asteria', robots: { index: false, follow: false } };
export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect('/admin');
  return <AdminLogin />;
}
