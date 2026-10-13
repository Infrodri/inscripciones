'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/Table';

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
      <PageHeader
        titulo="Nuevo evento"
        migas={[{ etiqueta: 'Eventos', href: '/admin/eventos' }, { etiqueta: 'Nuevo' }]}
        volverA="/admin/eventos"
      />
      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
        <Card>
          <Input
            id="duplicateFrom"
            etiqueta="Duplicar de… (opcional)"
            desplegable
            value={duplicateFrom}
            onChange={(e) => setDuplicateFrom(e.target.value)}
          >
            <option value="">Evento nuevo</option>
            {(events?.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </Input>
        </Card>
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Input
                id="title"
                etiqueta="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <Input
              id="slug"
              etiqueta="Slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
            <Input
              id="eventKind"
              etiqueta="Tipo"
              value={eventKind}
              onChange={(e) => setEventKind(e.target.value)}
              required
            />
            <div className="md:col-span-2">
              <Input
                id="institution"
                etiqueta="Institución"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                required={!duplicateFrom}
              />
            </div>
            <div className="md:col-span-2">
              <Input
                id="commemoration"
                etiqueta="Conmemoración"
                opcional=" (opcional)"
                value={commemoration}
                onChange={(e) => setCommemoration(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Input
                id="organizer"
                etiqueta="Organiza"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                required={!duplicateFrom}
              />
            </div>
            <Input
              id="location"
              etiqueta="Lugar"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required={!duplicateFrom}
            />
            <Input
              id="modality"
              etiqueta="Modalidad"
              desplegable
              value={modality}
              onChange={(e) => setModality(e.target.value)}
            >
              <option value="PRESENCIAL">Presencial</option>
              <option value="VIRTUAL">Virtual</option>
              <option value="HIBRIDO">Híbrido</option>
            </Input>
            <Input
              id="capacity"
              etiqueta="Cupo"
              opcional=" (vacío = sin límite)"
              type="number"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            <Input
              id="deadline"
              etiqueta="Fecha límite"
              opcional=" (opcional)"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <Input
              id="whatsapp"
              etiqueta="WhatsApp de contacto"
              opcional=" (opcional)"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
            <div className="flex min-h-[44px] items-center gap-2">
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
        </Card>
        {!duplicateFrom ? (
          <Card>
            <h2 className="font-serif text-lg text-[#0A2A5E]">Primera sesión (obligatoria)</h2>
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              <Input
                id="sessionAt"
                etiqueta="Fecha y hora"
                type="datetime-local"
                value={sessionAt}
                onChange={(e) => setSessionAt(e.target.value)}
                required
              />
              <Input
                id="sessionEndsAt"
                etiqueta="Fin"
                opcional=" (opcional)"
                type="datetime-local"
                value={sessionEndsAt}
                onChange={(e) => setSessionEndsAt(e.target.value)}
              />
            </div>
          </Card>
        ) : null}
        {!duplicateFrom ? (
          <Card>
            <h2 className="font-serif text-lg text-[#0A2A5E]">
              Campos obligatorios del formulario
            </h2>
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
          </Card>
        ) : null}
        <Card>
          <Input
            id="banner"
            etiqueta="Afiche (PNG/JPG/WebP, máx. 10 MB)"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setBanner(e.target.files?.[0] ?? null)}
          />
        </Card>
        <Button type="submit" cargando={busy}>
          Crear evento
        </Button>
      </form>
    </div>
  );
}
