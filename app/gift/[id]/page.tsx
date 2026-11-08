import GiftReveal from './GiftReveal';

export const metadata = {
  title: 'A little piece of forever · Asteria',
  description: 'Someone has written your name in the stars. Unwrap your personal star dedication.',
  robots: { index: false, follow: false },
};

export default async function GiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GiftReveal id={id} />;
}
