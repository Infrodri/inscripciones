import type { ReactNode } from 'react';
import { Inter, Source_Serif_4 } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

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
