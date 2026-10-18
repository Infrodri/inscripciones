'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiUrl, apiErrorMessage } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/Table';
import { Award, Printer, Palette, CheckCircle2, ExternalLink } from 'lucide-react';

interface EventItem {
  id: string;
  slug: string;
  title: string;
  eventKind: string;
  minAttendancePercent?: number;
  issuesCertificate?: boolean;
}

interface CertificatePerson {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  ci?: string;
  recipientCi?: string;
  type?: string;
  certificateCode?: string | null;
}

export default function CertificadosGlobalPage() {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [roleKind, setRoleKind] = useState<'ASISTENTE' | 'EXPOSITOR' | 'ORGANIZADOR'>('ASISTENTE');
  const [scope, setScope] = useState<'eligible' | 'all'>('eligible');
  const [exportingFull, setExportingFull] = useState(false);
  const [exportingBlank, setExportingBlank] = useState(false);

  // 1. Fetch accessible events
  const eventsQuery = useQuery({
    queryKey: ['admin-events-list-certs'],
    queryFn: async () => {
      const res = await api.get('/events', { params: { pageSize: 50 } });
      const items = (res.data?.data ?? []) as EventItem[];
      if (items.length > 0 && !selectedEventId) {
        setSelectedEventId(items[0].id);
      }
      return items;
    },
  });

  const events = eventsQuery.data ?? [];
  const currentEvent = events.find((e) => e.id === selectedEventId) ?? events[0];

  // 2. Fetch recipients / participants
  const participantsQuery = useQuery({
    queryKey: ['admin-cert-recipients', selectedEventId, roleKind],
    queryFn: async () => {
      if (!selectedEventId) return [];
      if (roleKind === 'ASISTENTE') {
        const res = await api.get(`/participants/event/${selectedEventId}`, {
          params: { pageSize: 150 },
        });
        return (res.data?.data ?? []) as CertificatePerson[];
      }
      const res = await api.get(`/certificate-recipients/event/${selectedEventId}`, {
        params: { roleKind },
      });
      return (res.data?.data ?? []) as CertificatePerson[];
    },
    enabled: Boolean(selectedEventId),
  });

  const recipients = participantsQuery.data ?? [];

  // Export handler
  async function downloadCertificates(printBackground: boolean) {
    if (!currentEvent) return;
    if (printBackground) {
      setExportingFull(true);
    } else {
      setExportingBlank(true);
    }

    try {
      const params = new URLSearchParams({
        roleKind,
        scope,
        printBackground: String(printBackground),
      });

      const res = await fetch(
        apiUrl(`/events/${currentEvent.id}/exports/certificates.pdf?${params.toString()}`),
        {
          headers: { Authorization: `Bearer ${getToken() ?? ''}` },
        }
      );

      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(errJson?.error?.message ?? 'Error al generar diplomas');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificados-${roleKind.toLowerCase()}-${printBackground ? 'completo' : 'preimpreso'}-${currentEvent.slug}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        printBackground
          ? 'Diplomas completos descargados con éxito'
          : 'Certificados para hojas preimpresas descargados'
      );
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setExportingFull(false);
      setExportingBlank(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        migas={[{ etiqueta: 'Administración' }, { etiqueta: 'Emisión de Certificados' }]}
        volverA="/admin/eventos"
        titulo="Emisión de Certificados y Diplomas"
        descripcion="Generación en un solo clic de certificados oficiales. Elija entre diplomas completos a color o impresión para hojas preimpresas."
      />

      {/* Main Control Card */}
      <Card className="p-6 border border-line bg-surface rounded-xl shadow-soft space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            id="event-select-certs"
            etiqueta="Evento Académico"
            desplegable
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({ev.eventKind})
              </option>
            ))}
          </Input>

          <Input
            id="role-kind-select"
            etiqueta="Tipo de Certificado / Rol"
            desplegable
            value={roleKind}
            onChange={(e) =>
              setRoleKind(e.target.value as 'ASISTENTE' | 'EXPOSITOR' | 'ORGANIZADOR')
            }
          >
            <option value="ASISTENTE">Certificados de Asistencia (Participantes)</option>
            <option value="EXPOSITOR">Certificados de Expositor / Ponente</option>
            <option value="ORGANIZADOR">Certificados de Organizador / Comité</option>
          </Input>

          <Input
            id="scope-select"
            etiqueta="Alcance de Emisión"
            desplegable
            value={scope}
            onChange={(e) => setScope(e.target.value as 'eligible' | 'all')}
          >
            <option value="eligible">Solo aptos por asistencia</option>
            <option value="all">Todos los inscritos</option>
          </Input>
        </div>

        {/* 1-CLICK ACTIONS BANNER */}
        <div className="rounded-xl bg-canvas border border-line p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <h3 className="font-serif text-lg font-bold text-navy flex items-center gap-2">
                <Award className="h-5 w-5 text-gold" />
                Modalidades de Impresión y Descarga
              </h3>
              <p className="text-xs text-muted">
                Generación masiva automática con posicionamiento exacto de nombres y firmas.
              </p>
            </div>
            {currentEvent ? (
              <span className="text-xs font-semibold px-2.5 py-1 bg-surface border border-line rounded-md text-navy self-start">
                Asistencia Mínima: {currentEvent.minAttendancePercent ?? 80}%
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Option 1: Full Diploma */}
            <div className="p-4 rounded-lg border border-line bg-surface flex flex-col justify-between space-y-3 shadow-soft">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-navy font-semibold text-sm">
                  <Palette className="h-4 w-4 text-gold" />
                  Diplomas Completos (Todo a Color)
                </div>
                <p className="text-xs text-muted">
                  Incluye el diseño de fondo completo, membretes, marcos ornamentales, textos y
                  nombres. Ideal para envío digital o impresión desde cero en papel blanco.
                </p>
              </div>
              <Button
                variant="primario"
                size="md"
                cargando={exportingFull}
                onClick={() => void downloadCertificates(true)}
                disabled={recipients.length === 0}
                className="w-full !text-white shadow-soft justify-center"
              >
                Descargar Diplomas Completos (PDF)
              </Button>
            </div>

            {/* Option 2: Pre-printed Sheets */}
            <div className="p-4 rounded-lg border border-line bg-surface flex flex-col justify-between space-y-3 shadow-soft">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-navy font-semibold text-sm">
                  <Printer className="h-4 w-4 text-gold" />
                  Para Hojas Preimpresas (Solo Nombres)
                </div>
                <p className="text-xs text-muted">
                  Fondo transparente. Imprime únicamente los nombres en las coordenadas exactas de
                  la plantilla, listo para introducir el papel físico preimpreso en la impresora.
                </p>
              </div>
              <Button
                variant="secundario"
                size="md"
                cargando={exportingBlank}
                onClick={() => void downloadCertificates(false)}
                disabled={recipients.length === 0}
                className="w-full justify-center"
              >
                Descargar para Hoja Preimpresa (PDF)
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Recipients Summary Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-bold text-navy text-base">
            Lista de Destinatarios ({recipients.length})
          </h3>
          {currentEvent ? (
            <a
              href={`/admin/eventos/${currentEvent.id}/certificados`}
              className="text-xs font-semibold text-navy hover:underline flex items-center gap-1"
            >
              Configurar diseño y coordenadas de plantilla
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>

        {participantsQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted bg-surface rounded-xl border border-line">
            Cargando beneficiarios…
          </div>
        ) : recipients.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted bg-surface rounded-xl border border-line">
            No hay destinatarios registrados para el rol seleccionado ({roleKind}).
          </div>
        ) : (
          <div className="border border-line rounded-xl overflow-hidden bg-surface shadow-soft">
            <div className="divide-y divide-line">
              {recipients.map((r, idx) => (
                <div
                  key={r.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-canvas/50 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="font-serif font-bold text-navy text-sm">
                      {idx + 1}.{' '}
                      {r.firstName
                        ? `${r.firstName} ${r.lastName}`
                        : (r.fullName ?? 'Participante')}
                    </p>
                    <p className="text-xs text-muted font-mono">
                      CI: {r.ci || r.recipientCi || 'S/N'} • Rol: {roleKind}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-xs text-ok font-medium bg-ok-bg px-2.5 py-1 rounded-full border border-ok/20">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Habilitado para Emisión
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
