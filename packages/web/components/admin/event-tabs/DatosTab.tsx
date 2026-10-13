'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUnsavedChanges } from '@/components/ui/Dialog';
import { EventBanner } from '@/components/admin/EventBanner';
import { EventCollections } from '@/components/admin/EventCollections';

interface EventFull {
  id: string;
  slug: string;
  title: string;
  updatedAt: string;
  eventKind: string;
  institution: string;
  commemoration: string | null;
  organizer: string;
  audienceNote: string | null;
  description: string | null;
  location: string;
  mapUrl: string | null;
  modality: 'PRESENCIAL' | 'VIRTUAL' | 'HIBRIDO';
  capacity: number | null;
  registrationDeadline: string | null;
  isFree: boolean;
  contactWhatsapp: string | null;
  issuesCertificate: boolean;
  minAttendancePercent: number;
  checkinWindowMinutes: number;
  requireCareer: boolean;
  requireSemester: boolean;
  requireInstitution: boolean;
  requirePhone: boolean;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditForm({ event }: { event: EventFull }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: event.title,
    eventKind: event.eventKind,
    institution: event.institution,
    commemoration: event.commemoration ?? '',
    organizer: event.organizer,
    audienceNote: event.audienceNote ?? '',
    description: event.description ?? '',
    location: event.location,
    mapUrl: event.mapUrl ?? '',
    modality: event.modality,
    capacity: event.capacity?.toString() ?? '',
    deadline: toLocalInput(event.registrationDeadline),
    isFree: event.isFree,
    contactWhatsapp: event.contactWhatsapp ?? '',
    issuesCertificate: event.issuesCertificate,
    minAttendancePercent: String(event.minAttendancePercent),
    checkinWindowMinutes: String(event.checkinWindowMinutes),
    requireCareer: event.requireCareer,
    requireSemester: event.requireSemester,
    requireInstitution: event.requireInstitution,
    requirePhone: event.requirePhone,
  });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]): void {
    setForm((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/events/${event.id}`, {
        ...form,
        commemoration: form.commemoration !== '' ? form.commemoration : null,
        audienceNote: form.audienceNote !== '' ? form.audienceNote : null,
        description: form.description !== '' ? form.description : null,
        mapUrl: form.mapUrl !== '' ? form.mapUrl : null,
        capacity: form.capacity !== '' ? Number(form.capacity) : null,
        registrationDeadline: form.deadline !== '' ? new Date(form.deadline).toISOString() : null,
        contactWhatsapp: form.contactWhatsapp !== '' ? form.contactWhatsapp : null,
        minAttendancePercent: Number(form.minAttendancePercent),
        checkinWindowMinutes: Number(form.checkinWindowMinutes),
        deadline: undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['event', event.id] });
      setDirty(false);
      toast.success('Evento actualizado');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <Input
          id="d-title"
          etiqueta="Título"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          required
        />
      </div>
      <Input
        id="d-kind"
        etiqueta="Tipo"
        value={form.eventKind}
        onChange={(e) => set('eventKind', e.target.value)}
        required
      />
      <div className="md:col-span-2">
        <Input
          id="d-institution"
          etiqueta="Institución"
          value={form.institution}
          onChange={(e) => set('institution', e.target.value)}
          required
        />
      </div>
      <div className="md:col-span-2">
        <Input
          id="d-commemoration"
          etiqueta="Conmemoración"
          opcional=" (opcional)"
          value={form.commemoration}
          onChange={(e) => set('commemoration', e.target.value)}
        />
      </div>
      <div className="md:col-span-2">
        <Input
          id="d-organizer"
          etiqueta="Organiza"
          value={form.organizer}
          onChange={(e) => set('organizer', e.target.value)}
          required
        />
      </div>
      <Input
        id="d-location"
        etiqueta="Lugar"
        value={form.location}
        onChange={(e) => set('location', e.target.value)}
        required
      />
      <Input
        id="d-modality"
        etiqueta="Modalidad"
        desplegable
        value={form.modality}
        onChange={(e) => set('modality', e.target.value as typeof form.modality)}
      >
        <option value="PRESENCIAL">Presencial</option>
        <option value="VIRTUAL">Virtual</option>
        <option value="HIBRIDO">Híbrido</option>
      </Input>
      <Input
        id="d-capacity"
        etiqueta="Cupo"
        opcional=" (vacío = sin límite)"
        type="number"
        min={0}
        value={form.capacity}
        onChange={(e) => set('capacity', e.target.value)}
      />
      <Input
        id="d-deadline"
        etiqueta="Fecha límite"
        opcional=" (opcional)"
        type="datetime-local"
        value={form.deadline}
        onChange={(e) => set('deadline', e.target.value)}
      />
      <Input
        id="d-whatsapp"
        etiqueta="WhatsApp"
        opcional=" (opcional)"
        value={form.contactWhatsapp}
        onChange={(e) => set('contactWhatsapp', e.target.value)}
      />
      <Input
        id="d-map"
        etiqueta="Mapa (URL)"
        opcional=" (opcional)"
        value={form.mapUrl}
        onChange={(e) => set('mapUrl', e.target.value)}
      />
      <Input
        id="d-min"
        etiqueta="% asistencia mínima"
        type="number"
        min={0}
        max={100}
        value={form.minAttendancePercent}
        onChange={(e) => set('minAttendancePercent', e.target.value)}
      />
      <Input
        id="d-window"
        etiqueta="Ventana de registro (min)"
        type="number"
        min={0}
        value={form.checkinWindowMinutes}
        onChange={(e) => set('checkinWindowMinutes', e.target.value)}
      />
      <div className="md:col-span-2">
        <Input
          id="d-description"
          etiqueta="Descripción"
          opcional=" (opcional)"
          multiline
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
      <div className="md:col-span-2">
        <Input
          id="d-audience"
          etiqueta="Nota de público"
          opcional=" (opcional)"
          value={form.audienceNote}
          onChange={(e) => set('audienceNote', e.target.value)}
        />
      </div>
      {(
        [
          ['isFree', 'Inscripción gratuita', form.isFree, (v: boolean) => set('isFree', v)],
          [
            'issuesCertificate',
            'Emite certificados',
            form.issuesCertificate,
            (v: boolean) => set('issuesCertificate', v),
          ],
          [
            'requireCareer',
            'Carrera obligatoria',
            form.requireCareer,
            (v: boolean) => set('requireCareer', v),
          ],
          [
            'requireSemester',
            'Semestre obligatorio',
            form.requireSemester,
            (v: boolean) => set('requireSemester', v),
          ],
          [
            'requireInstitution',
            'Institución obligatoria',
            form.requireInstitution,
            (v: boolean) => set('requireInstitution', v),
          ],
          [
            'requirePhone',
            'Celular obligatorio',
            form.requirePhone,
            (v: boolean) => set('requirePhone', v),
          ],
        ] as const
      ).map(([id, label, checked, onToggle]) => (
        <div key={id} className="flex min-h-[44px] items-center gap-2">
          <input
            id={`d-${id}`}
            type="checkbox"
            checked={checked}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-5 w-5"
          />
          <label htmlFor={`d-${id}`}>{label}</label>
        </div>
      ))}
      <div className="md:col-span-2">
        <Button type="submit" cargando={busy}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

export function DatosTab({ eventId }: { eventId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async (): Promise<EventFull> => (await api.get(`/events/${eventId}`)).data,
  });

  if (isLoading) return <p>Cargando…</p>;
  if (isError || !data) return <p>No se pudo cargar el evento.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-lg text-[#0A2A5E]">Datos del evento</h2>
        <div className="mt-2">
          <EditForm key={data.updatedAt as unknown as string} event={data} />
        </div>
      </div>
      <EventBanner eventId={eventId} slug={data.slug} />
      <div>
        <h2 className="font-serif text-lg text-[#0A2A5E]">Expositores y auspiciantes</h2>
        <EventCollections eventId={eventId} />
      </div>
    </div>
  );
}
