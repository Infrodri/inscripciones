'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import axios from 'axios';
import { toast } from 'sonner';

const schema = z.object({
  firstName: z.string().min(1, 'El nombre es obligatorio'),
  lastName: z.string().min(1, 'El apellido es obligatorio'),
  ci: z.string().min(1, 'El CI es obligatorio'),
  email: z.string().email('El correo no es válido'),
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
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { type: 'PUBLICO' } });

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
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/public/events/${slug}/registrations`,
        { ...values, website: '' }
      );
      setSuccess(res.data as Success);
      toast.success('Inscripción registrada');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error((error.response?.data?.error?.message as string) ?? 'No se pudo registrar');
      }
    }
  }

  if (success) {
    return (
      <div>
        <h2 className="font-serif text-2xl text-[#0A2A5E]">Inscripción confirmada</h2>
        <p className="mt-2">
          {success.firstName} {success.lastName}: presente este QR al ingresar.
        </p>
        <img src={success.qrPngUrl} alt="QR personal de ingreso" className="mt-4 w-64" />
        <div className="mt-4">
          <a
            href={success.qrPngUrl}
            download={`qr-${success.qrToken}.png`}
            className="rounded bg-[#0A2A5E] px-4 py-2 text-white"
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
      <div>
        <label htmlFor="firstName">Nombres</label>
        <input
          id="firstName"
          {...register('firstName')}
          className="block w-full rounded border p-2"
        />
        {errors.firstName ? <p>{errors.firstName.message}</p> : null}
      </div>
      <div>
        <label htmlFor="lastName">Apellidos</label>
        <input
          id="lastName"
          {...register('lastName')}
          className="block w-full rounded border p-2"
        />
        {errors.lastName ? <p>{errors.lastName.message}</p> : null}
      </div>
      <div>
        <label htmlFor="ci">CI</label>
        <input id="ci" {...register('ci')} className="block w-full rounded border p-2" />
        {errors.ci ? <p>{errors.ci.message}</p> : null}
      </div>
      <div>
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className="block w-full rounded border p-2"
        />
        {errors.email ? <p>{errors.email.message}</p> : null}
      </div>
      <div>
        <label htmlFor="phone">Celular{required.phone ? '' : ' (opcional)'}</label>
        <input id="phone" {...register('phone')} className="block w-full rounded border p-2" />
        {errors.phone ? <p>{errors.phone.message}</p> : null}
      </div>
      <div>
        <label htmlFor="type">Tipo</label>
        <select id="type" {...register('type')} className="block w-full rounded border p-2">
          <option value="ESTUDIANTE">Estudiante</option>
          <option value="DOCENTE">Docente</option>
          <option value="PROFESIONAL">Profesional</option>
          <option value="PUBLICO">Público</option>
        </select>
      </div>
      <div>
        <label htmlFor="institution">Institución{required.institution ? '' : ' (opcional)'}</label>
        <input
          id="institution"
          {...register('institution')}
          className="block w-full rounded border p-2"
        />
        {errors.institution ? <p>{errors.institution.message}</p> : null}
      </div>
      <div>
        <label htmlFor="career">Carrera{required.career ? '' : ' (opcional)'}</label>
        <input id="career" {...register('career')} className="block w-full rounded border p-2" />
        {errors.career ? <p>{errors.career.message}</p> : null}
      </div>
      <div>
        <label htmlFor="semester">Semestre{required.semester ? '' : ' (opcional)'}</label>
        <input
          id="semester"
          {...register('semester')}
          className="block w-full rounded border p-2"
        />
        {errors.semester ? <p>{errors.semester.message}</p> : null}
      </div>
      <div>
        <input id="dataConsent" type="checkbox" {...register('dataConsent')} />
        <label htmlFor="dataConsent"> Acepto el tratamiento de mis datos para este evento</label>
        {errors.dataConsent ? <p>{errors.dataConsent.message}</p> : null}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-[#0A2A5E] px-6 py-3 text-white"
      >
        {isSubmitting ? 'Registrando…' : 'Confirmar inscripción'}
      </button>
    </form>
  );
}
