'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function WalkinForm({
  sessionId,
  onDone,
}: {
  sessionId: string;
  onDone: (name: string) => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [ci, setCi] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      const session = (await api.get(`/sessions/${sessionId}`)).data as { eventId: string };
      const res = await api.post(`/events/${session.eventId}/participants`, {
        firstName,
        lastName,
        ci,
        email: email.trim() !== '' ? email : undefined,
        type: 'PUBLICO',
        sessionId,
      });
      onDone(`${res.data.firstName as string} ${res.data.lastName as string}`);
      setFirstName('');
      setLastName('');
      setCi('');
      setEmail('');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-2 space-y-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Input
          id="walkin-firstName"
          etiqueta="Nombres"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          id="walkin-lastName"
          etiqueta="Apellidos"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
        <Input
          id="walkin-ci"
          etiqueta="CI"
          value={ci}
          onChange={(e) => setCi(e.target.value)}
          required
        />
        <Input
          id="walkin-email"
          etiqueta="Correo"
          opcional=" (opcional)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" cargando={busy}>
        Inscribir en puerta
      </Button>
    </form>
  );
}
