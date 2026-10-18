'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import axios from 'axios';
import { toast } from 'sonner';
import { apiUrl, configErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  firstName: z.string().trim().min(1, 'El nombre es obligatorio'),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio'),
  ci: z
    .string()
    .trim()
    .min(1, 'El CI es obligatorio')
    .regex(/^[A-Za-z0-9]{5,15}$/, 'El CI debe tener de 5 a 15 caracteres alfanuméricos'),
  email: z.preprocess(
    (value) => (typeof value !== 'string' || value.trim() === '' ? undefined : value),
    z.string().trim().toLowerCase().pipe(z.string().email('El correo no es válido')).optional()
  ),
  phone: z.string().optional(),
  type: z.enum(['ESTUDIANTE', 'DOCENTE', 'PROFESIONAL', 'PUBLICO']),
  institution: z.string().optional(),
  career: z.string().optional(),
  semester: z.string().optional(),
  dataConsent: z.literal(true, { message: 'Debe aceptar el tratamiento de sus datos' }),
});

type FormValues = z.infer<typeof schema>;

interface Success {
  firstName: string;
  lastName: string;
  qrToken: string;
  qrPngUrl: string;
  mailSent: boolean;
  notice: string | null;
}

export interface RequiredFields {
  career: boolean;
  semester: boolean;
  institution: boolean;
  phone: boolean;
}

export interface EventPaymentInfo {
  isFree?: boolean;
  cost?: number | null;
  institutionQr?: string | null;
}

export function RegistrationForm({
  slug,
  required,
  event,
}: {
  slug: string;
  required: RequiredFields;
  event?: EventPaymentInfo;
}) {
  const [success, setSuccess] = useState<Success | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: 'onTouched', defaultValues: { type: 'ESTUDIANTE' } });

  const attendeeType = watch('type');
  const isStudent = attendeeType === 'ESTUDIANTE';

  async function onSubmit(raw: FormValues): Promise<void> {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues | undefined;
        if (field) setError(field, { message: issue.message });
      }
      return;
    }
    const extra: Partial<Record<'career' | 'semester' | 'institution' | 'phone', string>> = {};
    if (required.career && !parsed.data.career?.trim())
      extra.career = 'En este evento la carrera es obligatoria';
    if (required.semester && !parsed.data.semester?.trim())
      extra.semester = 'En este evento el semestre es obligatorio';
    if (required.institution && !parsed.data.institution?.trim())
      extra.institution = 'En este evento la institución es obligatoria';
    if (required.phone && !parsed.data.phone?.trim())
      extra.phone = 'En este evento el celular es obligatorio';
    for (const [field, message] of Object.entries(extra)) {
      setError(field as keyof FormValues, { message });
    }
    if (Object.keys(extra).length > 0) return;

    let paymentProofUrl: string | undefined;
    if (event && event.isFree === false) {
      if (!proofFile) {
        setProofError('El comprobante de pago es obligatorio para eventos de pago');
        return;
      }
      try {
        const formData = new FormData();
        formData.append('proof', proofFile);
        const uploadRes = await axios.post(apiUrl('/public/proof'), formData);
        paymentProofUrl = (uploadRes.data as { url: string }).url;
      } catch (uploadErr) {
        const message =
          (axios.isAxiosError(uploadErr) &&
            (uploadErr.response?.data?.error?.message as string | undefined)) ||
          'Error al subir comprobante';
        setProofError(message);
        return;
      }
    }

    const values = parsed.data;
    setServerError(null);
    try {
      const payload: Record<string, unknown> = {
        ...values,
        website: '',
      };
      if (paymentProofUrl) {
        payload.paymentProofUrl = paymentProofUrl;
      }
      const res = await axios.post(apiUrl(`/public/events/${slug}/registrations`), payload);
      setSuccess(res.data as Success);
      toast.success('Inscripción registrada');
    } catch (error) {
      const configMessage = configErrorMessage(error);
      const message =
        configMessage ??
        ((axios.isAxiosError(error) &&
          (error.response?.data?.error?.message as string | undefined)) ||
          'No se pudo registrar');
      setServerError(message);
      toast.error(message);
    }
  }

  if (success) {
    return (
      <Card className="rounded-xl border border-line bg-surface p-6 sm:p-8 shadow-soft text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok-bg text-ok">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-bold text-navy">¡Inscripción confirmada!</h2>
          <p className="text-ink text-sm sm:text-base">
            <strong>
              {success.firstName} {success.lastName}
            </strong>
            : presente este código QR al ingresar al evento.
          </p>
          <p className="text-xs text-muted">
            Guarde o descargue el código QR en su dispositivo móvil para el control de asistencia.
          </p>
        </div>
        <div className="flex justify-center p-4 bg-canvas rounded-xl border border-line max-w-xs mx-auto">
          <img
            src={success.qrPngUrl}
            alt="QR personal de ingreso"
            className="w-full max-w-[220px] aspect-square object-contain"
          />
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={success.qrPngUrl}
            download={`qr-${success.qrToken}.png`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-navy px-6 py-2.5 font-medium !text-white shadow-soft hover:bg-navy-hover transition-colors"
          >
            Descargar QR
          </a>
          <a
            href={apiUrl(`/public/registrations/${success.qrToken}/badge.pdf`)}
            download={`credencial-${success.qrToken}.pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface px-6 py-2.5 font-medium text-ink shadow-soft hover:bg-canvas transition-colors"
          >
            Descargar Credencial (PDF)
          </a>
        </div>
        {success.notice ? (
          <p className="text-xs text-muted max-w-md mx-auto pt-2 border-t border-line">
            {success.notice}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="border border-line bg-surface p-6 sm:p-8 rounded-xl shadow-soft">
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-6">
        <div className="border-b border-line pb-4">
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-navy">
            Formulario de inscripción
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Complete sus datos para registrarse al evento académico.
          </p>
        </div>

        {/* Personal Details */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Datos Personales
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="firstName"
              etiqueta="Nombres"
              obligatorio
              {...register('firstName')}
              error={errors.firstName?.message}
            />
            <Input
              id="lastName"
              etiqueta="Apellidos"
              obligatorio
              {...register('lastName')}
              error={errors.lastName?.message}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="ci"
              etiqueta="CI"
              obligatorio
              {...register('ci')}
              error={errors.ci?.message}
            />
            <Input
              id="phone"
              etiqueta="Celular"
              obligatorio={required.phone}
              opcional={required.phone ? undefined : '(opcional)'}
              {...register('phone')}
              error={errors.phone?.message}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="email"
              etiqueta="Correo"
              opcional="(opcional)"
              type="email"
              {...register('email')}
              error={errors.email?.message}
            />
            <Input id="type" etiqueta="Tipo" obligatorio desplegable {...register('type')}>
              <option value="ESTUDIANTE">Estudiante</option>
              <option value="DOCENTE">Docente</option>
              <option value="PROFESIONAL">Profesional</option>
              <option value="PUBLICO">Público</option>
            </Input>
          </div>
        </div>

        {/* Academic / Institutional Data */}
        <div className="space-y-4 border-t border-line pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Información Institucional
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              id="institution"
              etiqueta="Institución"
              obligatorio={required.institution}
              opcional={required.institution ? undefined : '(opcional)'}
              {...register('institution')}
              error={errors.institution?.message}
            />
            <Input
              id="career"
              etiqueta={isStudent ? 'Carrera' : 'Carrera / Especialidad'}
              obligatorio={required.career}
              opcional={required.career ? undefined : '(opcional)'}
              {...register('career')}
              error={errors.career?.message}
            />
            {isStudent || required.semester ? (
              <Input
                id="semester"
                etiqueta="Semestre"
                obligatorio={required.semester}
                opcional={required.semester ? undefined : '(opcional)'}
                {...register('semester')}
                error={errors.semester?.message}
              />
            ) : null}
          </div>
        </div>

        {/* Paid Event Information & Proof Upload */}
        {event && event.isFree === false ? (
          <div className="rounded-xl border border-line bg-canvas p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-navy">Información de pago</h3>
                <p className="text-xs text-muted">
                  Este evento requiere confirmación de pago para la inscripción.
                </p>
              </div>
              <div className="sm:text-right">
                <span className="text-xs text-muted block">Monto a transferir</span>
                <span className="text-xl font-bold text-navy">
                  {event.cost != null ? `${event.cost} Bs` : 'Monto definido'}
                </span>
              </div>
            </div>

            {event.institutionQr ? (
              <div className="rounded-lg border border-line bg-surface p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="shrink-0 bg-canvas p-2 rounded-lg border border-line">
                  <img
                    src={event.institutionQr}
                    alt="QR institucional para pago"
                    className="max-h-48 max-w-[200px] object-contain rounded"
                  />
                </div>
                <div className="text-sm space-y-2 text-ink">
                  <p className="font-semibold text-navy">Instrucciones para transferencia:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-muted">
                    <li>Abra su aplicación bancaria o billetera móvil.</li>
                    <li>
                      Escanee el código QR institucional por el monto de{' '}
                      {event.cost != null ? `${event.cost} Bs` : 'la matrícula'}.
                    </li>
                    <li>Guarde el comprobante o captura de pantalla de la transferencia.</li>
                    <li>Adjunte el archivo del comprobante en el campo inferior.</li>
                  </ol>
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Input
                id="paymentProof"
                etiqueta="Comprobante de pago"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setProofFile(file);
                  setProofError(null);
                }}
                error={proofError ?? undefined}
              />
              {proofFile ? (
                <p className="text-xs text-ok font-medium">
                  ✓ Comprobante seleccionado: {proofFile.name} ({(proofFile.size / 1024).toFixed(1)}{' '}
                  KB)
                </p>
              ) : (
                <p className="text-xs text-muted">Archivos permitidos: PNG, JPG, WEBP o PDF.</p>
              )}
            </div>
          </div>
        ) : null}

        {/* Data Consent */}
        <div className="pt-2">
          <label
            htmlFor="dataConsent"
            className="flex items-start gap-3 cursor-pointer text-sm text-ink select-none min-h-[44px]"
          >
            <input
              id="dataConsent"
              type="checkbox"
              {...register('dataConsent')}
              className="mt-0.5 h-4 w-4 rounded border-line text-navy focus:ring-navy"
            />
            <span>Acepto el tratamiento de mis datos para este evento</span>
          </label>
          {errors.dataConsent ? (
            <p role="alert" className="mt-1 text-sm text-danger">
              {errors.dataConsent.message}
            </p>
          ) : null}
        </div>

        {serverError ? (
          <div
            className="rounded-lg bg-danger-bg p-3 text-sm text-danger border border-line"
            role="alert"
          >
            {serverError}
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primario"
          size="lg"
          cargando={isSubmitting}
          textoCargando="Enviando…"
          className="w-full !text-white text-base font-semibold min-h-[48px] shadow-soft"
        >
          Confirmar inscripción
        </Button>
      </form>
    </Card>
  );
}
