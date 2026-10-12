'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import axios from 'axios';
import { toast } from 'sonner';
import { apiUrl, configErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
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

export function RegistrationForm({ slug, required }: { slug: string; required: RequiredFields }) {
  const [success, setSuccess] = useState<Success | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: 'onTouched', defaultValues: { type: 'ESTUDIANTE' } });

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
    const values = parsed.data;
    setServerError(null);
    try {
      const res = await axios.post(apiUrl(`/public/events/${slug}/registrations`), {
        ...values,
        website: '',
      });
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
      <div>
        <h2 className="font-serif text-2xl text-[#0A2A5E]">Inscripción confirmada</h2>
        <p className="mt-2">
          {success.firstName} {success.lastName}: presente este QR al ingresar.
        </p>
        <img src={success.qrPngUrl} alt="QR personal de ingreso" className="mt-4 w-full max-w-xs" />
        <div className="mt-4">
          <a
            href={success.qrPngUrl}
            download={`qr-${success.qrToken}.png`}
            className="inline-block min-h-[44px] rounded bg-[#0A2A5E] px-4 py-2 text-white"
          >
            Descargar QR
          </a>
        </div>
        {success.notice ? <p className="mt-4">{success.notice}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="mt-6 space-y-4">
      <Input
        id="firstName"
        etiqueta="Nombres"
        {...register('firstName')}
        error={errors.firstName?.message}
      />
      <Input
        id="lastName"
        etiqueta="Apellidos"
        {...register('lastName')}
        error={errors.lastName?.message}
      />
      <Input id="ci" etiqueta="CI" {...register('ci')} error={errors.ci?.message} />
      <Input
        id="email"
        etiqueta="Correo"
        opcional=" (opcional)"
        type="email"
        {...register('email')}
        error={errors.email?.message}
      />
      <Input
        id="phone"
        etiqueta="Celular"
        opcional={required.phone ? undefined : ' (opcional)'}
        {...register('phone')}
        error={errors.phone?.message}
      />
      <Input id="type" etiqueta="Tipo" desplegable {...register('type')}>
        <option value="ESTUDIANTE">Estudiante</option>
        <option value="DOCENTE">Docente</option>
        <option value="PROFESIONAL">Profesional</option>
        <option value="PUBLICO">Público</option>
      </Input>
      <Input
        id="institution"
        etiqueta="Carrera o institución"
        opcional={required.institution ? undefined : ' (opcional)'}
        {...register('institution')}
        error={errors.institution?.message}
      />
      <Input
        id="career"
        etiqueta="Carrera"
        opcional={required.career ? undefined : ' (opcional)'}
        {...register('career')}
        error={errors.career?.message}
      />
      <Input
        id="semester"
        etiqueta="Semestre"
        opcional={required.semester ? undefined : ' (opcional)'}
        {...register('semester')}
        error={errors.semester?.message}
      />
      <div>
        <input id="dataConsent" type="checkbox" {...register('dataConsent')} />
        <label htmlFor="dataConsent"> Acepto el tratamiento de mis datos para este evento</label>
        {errors.dataConsent ? <p>{errors.dataConsent.message}</p> : null}
      </div>
      {serverError ? (
        <p role="alert" className="text-sm text-red-700">
          {serverError}
        </p>
      ) : null}
      <Button type="submit" cargando={isSubmitting} className="w-full">
        Confirmar inscripción
      </Button>
    </form>
  );
}
