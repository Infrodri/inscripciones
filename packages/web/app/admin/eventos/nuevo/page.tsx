'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';

export default function NuevoEventoPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [eventKind, setEventKind] = useState('Conversatorio');
  const [institution, setInstitution] = useState('');
  const [commemoration, setCommemoration] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [location, setLocation] = useState('');
  const [modality, setModality] = useState('PRESENCIAL');
  const [capacity, setCapacity] = useState('');
  const [deadline, setDeadline] = useState('');
  const [issuesCertificate, setIssuesCertificate] = useState(true);
  const [whatsapp, setWhatsapp] = useState('');
  const [sessionAt, setSessionAt] = useState('');
  const [sessionEndsAt, setSessionEndsAt] = useState('');
  const [requireCareer, setRequireCareer] = useState(false);
  const [requireSemester, setRequireSemester] = useState(false);
  const [requireInstitution, setRequireInstitution] = useState(false);
  const [requirePhone, setRequirePhone] = useState(false);
  const [banner, setBanner] = useState<File | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: async (): Promise<{ data: Array<{ id: string; title: string }> }> =>
      (await api.get('/events')).data,
  });

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!duplicateFrom && sessionAt === '') {
      toast.error('Agregue al menos una sesión con fecha y hora');
      return;
    }
    setBusy(true);
    try {
      let id: string;
      if (duplicateFrom) {
        const res = await api.post(`/events/${duplicateFrom}/duplicate`, {
          title,
          slug,
          daysShift: 1,
        });
        id = (res.data as { id: string }).id;
      } else {
        const res = await api.post('/events', {
          slug,
          title,
          eventKind,
          institution,
          commemoration: commemoration !== '' ? commemoration : null,
          organizer,
          location,
          modality,
          capacity: capacity !== '' ? Number(capacity) : null,
          registrationDeadline: deadline !== '' ? new Date(deadline).toISOString() : null,
          issuesCertificate,
          contactWhatsapp: whatsapp !== '' ? whatsapp : null,
          requireCareer,
          requireSemester,
          requireInstitution,
          requirePhone,
        });
        id = (res.data as { id: string }).id;
        await api.post('/sessions', {
          eventId: id,
          startsAt: new Date(sessionAt).toISOString(),
          endsAt: sessionEndsAt !== '' ? new Date(sessionEndsAt).toISOString() : null,
        });
      }
      if (banner) {
        const form = new FormData();
        form.append('banner', banner);
        await api.post(`/events/${id}/banner`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      toast.success('Evento creado');
      router.push(`/admin/eventos/${id}`);
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-[#0A2A5E]">Nuevo evento</h1>
      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
        <div>
          <label htmlFor="duplicateFrom">Duplicar de… (opcional)</label>
          <select
            id="duplicateFrom"
            value={duplicateFrom}
            onChange={(e) => setDuplicateFrom(e.target.value)}
            className="block w-full rounded border p-2"
          >
            <option value="">Evento nuevo</option>
            {(events?.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="title">Título</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full rounded border p-2"
              required
            />
          </div>
          <div>
            <label htmlFor="slug">Slug</label>
            <input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="block w-full rounded border p-2"
              required
            />
          </div>
          <div>
            <label htmlFor="eventKind">Tipo</label>
            <input
              id="eventKind"
              value={eventKind}
              onChange={(e) => setEventKind(e.target.value)}
              className="block w-full rounded border p-2"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="institution">Institución</label>
            <input
              id="institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="block w-full rounded border p-2"
              required={!duplicateFrom}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="commemoration">Conmemoración (opcional)</label>
            <input
              id="commemoration"
              value={commemoration}
              onChange={(e) => setCommemoration(e.target.value)}
              className="block w-full rounded border p-2"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="organizer">Organiza</label>
            <input
              id="organizer"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              className="block w-full rounded border p-2"
              required={!duplicateFrom}
            />
          </div>
          <div>
            <label htmlFor="location">Lugar</label>
            <input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="block w-full rounded border p-2"
              required={!duplicateFrom}
            />
          </div>
          <div>
            <label htmlFor="modality">Modalidad</label>
            <select
              id="modality"
              value={modality}
              onChange={(e) => setModality(e.target.value)}
              className="block w-full rounded border p-2"
            >
              <option value="PRESENCIAL">Presencial</option>
              <option value="VIRTUAL">Virtual</option>
              <option value="HIBRIDO">Híbrido</option>
            </select>
          </div>
          <div>
            <label htmlFor="capacity">Cupo (vacío = sin límite)</label>
            <input
              id="capacity"
              type="number"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="block w-full rounded border p-2"
            />
          </div>
          <div>
            <label htmlFor="deadline">Fecha límite (opcional)</label>
            <input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="block w-full rounded border p-2"
            />
          </div>
          <div>
            <label htmlFor="whatsapp">WhatsApp de contacto (opcional)</label>
            <input
              id="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="block w-full rounded border p-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="issuesCertificate"
              type="checkbox"
              checked={issuesCertificate}
              onChange={(e) => setIssuesCertificate(e.target.checked)}
              className="h-5 w-5"
            />
            <label htmlFor="issuesCertificate">Emite certificados</label>
          </div>
        </div>
        {!duplicateFrom ? (
          <fieldset className="rounded border p-3">
            <legend className="px-1 text-sm font-medium">Primera sesión (obligatoria)</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="sessionAt">Fecha y hora</label>
                <input
                  id="sessionAt"
                  type="datetime-local"
                  value={sessionAt}
                  onChange={(e) => setSessionAt(e.target.value)}
                  className="block w-full rounded border p-2"
                  required
                />
              </div>
              <div>
                <label htmlFor="sessionEndsAt">Fin (opcional)</label>
                <input
                  id="sessionEndsAt"
                  type="datetime-local"
                  value={sessionEndsAt}
                  onChange={(e) => setSessionEndsAt(e.target.value)}
                  className="block w-full rounded border p-2"
                />
              </div>
            </div>
          </fieldset>
        ) : null}
        {!duplicateFrom ? (
          <fieldset className="rounded border p-3">
            <legend className="px-1 text-sm font-medium">Campos obligatorios del formulario</legend>
            {(
              [
                ['requireCareer', requireCareer, setRequireCareer, 'Carrera'],
                ['requireSemester', requireSemester, setRequireSemester, 'Semestre'],
                ['requireInstitution', requireInstitution, setRequireInstitution, 'Institución'],
                ['requirePhone', requirePhone, setRequirePhone, 'Celular'],
              ] as const
            ).map(([id, checked, set, label]) => (
              <div key={id} className="flex min-h-[44px] items-center gap-2">
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => set(e.target.checked)}
                  className="h-5 w-5"
                />
                <label htmlFor={id}>{label}</label>
              </div>
            ))}
          </fieldset>
        ) : null}
        <div>
          <label htmlFor="banner">Afiche (PNG/JPG/WebP, máx. 10 MB)</label>
          <input
            id="banner"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setBanner(e.target.files?.[0] ?? null)}
            className="block w-full"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] rounded bg-[#0A2A5E] px-6 py-2 text-white"
        >
          {busy ? 'Creando…' : 'Crear evento'}
        </button>
      </form>
    </div>
  );
}
