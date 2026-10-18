'use client';

import { useState } from 'react';
import axios from 'axios';
import { api, apiErrorMessage } from '@/lib/api';
import type { CertificateVerificationResponse } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  Award,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Calendar,
  User,
} from 'lucide-react';

type LookupStatus = 'idle' | 'loading' | 'encontrado' | 'no-encontrado' | 'error' | 'no-disponible';

export function CertificateLookup() {
  const [ci, setCi] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<LookupStatus>('idle');
  const [result, setResult] = useState<CertificateVerificationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!ci.trim() || !code.trim()) return;

    setStatus('loading');
    setResult(null);
    setErrorMessage('');

    try {
      const res = await api.post('/public/certificates/verify', {
        ci: ci.trim(),
        code: code.trim(),
      });
      const data = res.data as CertificateVerificationResponse;
      setResult(data);
      if (data.valid) {
        setStatus('encontrado');
      } else {
        setStatus('no-encontrado');
      }
    } catch (err) {
      if (axios.isAxiosError(err) && (err.response?.status === 404 || err.code === 'ERR_NETWORK')) {
        setStatus('no-disponible');
        setErrorMessage(
          'El servicio de verificación de certificados no está disponible en este momento.'
        );
      } else {
        setStatus('error');
        setErrorMessage(apiErrorMessage(err));
      }
    }
  }

  function handleReset() {
    setCi('');
    setCode('');
    setStatus('idle');
    setResult(null);
    setErrorMessage('');
  }

  return (
    <Card className="max-w-4xl mx-auto p-6 sm:p-8 bg-surface border-2 border-line shadow-card rounded-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-line">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-gold/15 text-navy">
              <Award className="h-5 w-5 text-gold-dark" aria-hidden="true" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
              Verificación Pública de Certificados
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted">
            Ingrese su número de C.I. y el código de verificación único impreso en su certificado.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-canvas text-muted border border-line shrink-0 self-start md:self-auto">
          <ShieldCheck className="h-4 w-4 text-gold" aria-hidden="true" />
          Anti-falsificación USFX
        </div>
      </div>

      <form onSubmit={(e) => void handleVerify(e)} className="mt-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="lookup-ci"
            etiqueta="Cédula de Identidad (C.I.)"
            placeholder="Ej: 10452345"
            value={ci}
            onChange={(e) => setCi(e.target.value)}
            required
            autoComplete="off"
            className="min-h-[44px]"
          />
          <Input
            id="lookup-code"
            etiqueta="Código de Verificación del Certificado"
            placeholder="Ej: cert-abc123xyz"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoComplete="off"
            className="min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {status !== 'idle' && (
            <Button type="button" variant="fantasma" onClick={handleReset} className="min-h-[44px]">
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Nueva consulta
            </Button>
          )}
          <Button
            type="submit"
            variant="primario"
            cargando={status === 'loading'}
            disabled={status === 'loading' || !ci.trim() || !code.trim()}
            className="min-h-[44px] px-6 !text-white font-semibold"
          >
            <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
            Verificar Validez
          </Button>
        </div>
      </form>

      {/* Dynamic Status Section with aria-live */}
      <div aria-live="polite" className="mt-6">
        {status === 'loading' && (
          <div className="p-4 rounded-xl bg-canvas border border-line flex items-center justify-center gap-3 text-sm text-muted">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            Consultando registros académicos y firma criptográfica…
          </div>
        )}

        {status === 'encontrado' && result?.certificate && (
          <div className="p-5 sm:p-6 rounded-xl border-2 border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm sm:text-base">
              <CheckCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Certificado Auténtico y Válido</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-500/20 text-xs sm:text-sm text-ink">
              <div>
                <span className="block text-muted text-xs font-medium">Evento Académico</span>
                <span className="font-semibold text-navy dark:text-gold">
                  {result.certificate.eventTitle}
                </span>
              </div>

              <div>
                <span className="block text-muted text-xs font-medium">
                  Titular (abreviado por privacidad)
                </span>
                <span className="font-semibold flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  {result.certificate.recipientName}
                </span>
              </div>

              <div>
                <span className="block text-muted text-xs font-medium">Rol Acreditado</span>
                <span className="inline-block px-2.5 py-0.5 mt-0.5 rounded-full font-bold text-xs bg-navy text-white">
                  {result.certificate.role}
                </span>
              </div>

              {result.certificate.eventDate && (
                <div>
                  <span className="block text-muted text-xs font-medium">
                    Fecha de Emisión / Evento
                  </span>
                  <span className="flex items-center gap-1.5 text-ink">
                    <Calendar className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                    {new Date(result.certificate.eventDate).toLocaleDateString('es-BO', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted pt-2 border-t border-emerald-500/20">
              Este documento fue emitido por la Universidad Mayor, Real y Pontificia de San
              Francisco Xavier de Chuquisaca y cuenta con validez académica oficial.
            </p>
          </div>
        )}

        {status === 'no-encontrado' && (
          <div className="p-4 rounded-xl border border-line bg-canvas flex items-start gap-3 text-sm text-ink">
            <XCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-danger">No se encontró un certificado válido</p>
              <p className="mt-0.5 text-xs text-muted">
                {result?.message ||
                  'No existe un certificado emitido que coincida con el número de C.I. y el código proporcionados. Verifique los datos o consulte con la comisión organizadora del evento.'}
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="p-4 rounded-xl border border-line bg-warn-bg flex items-start gap-3 text-sm text-ink">
            <AlertTriangle className="h-5 w-5 text-warn shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-warn">Error al realizar la verificación</p>
              <p className="mt-0.5 text-xs text-muted">
                {errorMessage ||
                  'Ocurrió un error al consultar el certificado. Por favor intente nuevamente.'}
              </p>
            </div>
          </div>
        )}

        {status === 'no-disponible' && (
          <div className="p-4 rounded-xl border border-line bg-canvas flex items-start gap-3 text-sm text-ink">
            <AlertTriangle className="h-5 w-5 text-muted shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-ink">Verificación no disponible</p>
              <p className="mt-0.5 text-xs text-muted">
                {errorMessage ||
                  'El servicio de consulta pública no se encuentra accesible en este momento.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
