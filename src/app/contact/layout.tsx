import type { ReactNode } from 'react';

export const metadata = {
  title: 'Contact Us',
  description: 'Get in touch for general inquiries or suggest a new candle scent.',
  alternates: { canonical: '/contact' },
  robots: { index: false, follow: true },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
