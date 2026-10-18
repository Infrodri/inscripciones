'use client';

import Image from 'next/image';
import { BookOpen, ShieldCheck, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface HeroSectionProps {
  onScrollToEvents?: () => void;
  onScrollToVerify?: () => void;
}

export function HeroSection({ onScrollToEvents, onScrollToVerify }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden text-white py-14 sm:py-20 px-4 border-b-4 border-gold shadow-card rounded-2xl mx-auto max-w-6xl mt-4">
      {/* Background photo of Facultad de Derecho USFX with next/image */}
      <Image
        src="/facultad-derecho-usfx.jpg"
        alt="Facultad de Derecho y Ciencias Políticas - USFX"
        fill
        priority
        className="object-cover object-center scale-105"
        sizes="(max-width: 1200px) 100vw, 1200px"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-navy/95 via-navy/90 to-navy/80" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy via-transparent to-navy/40" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="max-w-2xl text-center lg:text-left space-y-4">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gold text-navy shadow-soft">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Portal de Eventos Académicos
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white backdrop-blur-sm border border-white/20">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              Certificación Oficial USFX
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Universidad Mayor, Real y Pontificia de{' '}
            <span className="text-gold">San Francisco Xavier</span> de Chuquisaca
          </h1>

          <p className="text-white/85 text-base sm:text-lg max-w-xl font-normal leading-relaxed">
            Plataforma centralizada para la inscripción a seminarios, conferencias, congresos y
            verificación pública de certificados y diplomas académicos.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <Button
              variant="primario"
              size="lg"
              onClick={onScrollToEvents}
              className="bg-gold hover:bg-gold-dark !text-navy font-bold shadow-card border-none"
            >
              <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
              Explorar eventos disponibles
            </Button>
            <Button
              variant="secundario"
              size="lg"
              onClick={onScrollToVerify}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm"
            >
              <ShieldCheck className="mr-2 h-4 w-4 text-gold" aria-hidden="true" />
              Verificar certificado
            </Button>
          </div>
        </div>

        {/* Quick Highlights Card */}
        <div className="w-full lg:w-auto shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 text-white space-y-4 max-w-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Garantía Institucional
          </h2>
          <ul className="text-xs text-white/90 space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="text-gold font-bold">✓</span>
              <span>Inscripciones directas y transparentes con credencial QR personal.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold font-bold">✓</span>
              <span>Acreditación y control de asistencia con lectura óptica en auditorios.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold font-bold">✓</span>
              <span>
                Certificados verificables públicamente mediante C.I. y código criptográfico.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
