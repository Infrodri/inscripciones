import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

function getMetadataBase(): URL {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) {
    try {
      return new URL(envUrl.startsWith('http') ? envUrl : `https://${envUrl}`);
    } catch {
      // ignore and fall through
    }
  }
  if (process.env.VERCEL_URL) {
    try {
      return new URL(`https://${process.env.VERCEL_URL}`);
    } catch {
      // ignore and fall through
    }
  }
  return new URL('http://localhost:3000');
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: 'Sistema de Eventos Académicos - USFX',
  description:
    'Facultad de Derecho, Ciencias Políticas y Sociales - Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
  icons: {
    icon: '/facultad-derecho-usfx.jpg',
    apple: '/facultad-derecho-usfx.jpg',
  },
  openGraph: {
    title: 'Eventos Académicos USFX',
    description: 'Portal de Congresos, Seminarios y Certificación Oficial - USFX',
    images: ['/facultad-derecho-usfx.jpg'],
  },
};

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-BO" className={`${sans.variable} ${serif.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
