import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const serif = localFont({ src: './fonts/CormorantGaramond.ttf', variable: '--font-serif', display: 'swap' });
const sans = localFont({ src: './fonts/DMSans.ttf', variable: '--font-sans', display: 'swap' });
export const metadata: Metadata = {
  title: 'Asteria — A little piece of forever',
  description: 'Name a star for someone who lights up your world. Create a personal dedication, a beautiful keepsake, and a little magic to unwrap.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${serif.variable} ${sans.variable}`}>{children}</body></html>;
}
