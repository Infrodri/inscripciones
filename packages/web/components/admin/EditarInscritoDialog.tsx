'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  ci: string;
  email: string | null;
  phone: string | null;
  type: string;
}

export function EditarInscritoDialog({
  eventId,
  participant,
  onCerrar,
}: {
  eventId: string;
  participant: Participant;
  onCerrar: () => void;
}) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(participant.firstName);
  const [lastName, setLastName] = useState(participant.lastName);
  const [ci, setCi] = useState(participant.ci);
  const [email, setEmail] = useState(participant.email ?? '');
  const [phone, setPhone] = useState(participant.phone ?? '');
  const [type, setType] = useState(participant.type);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/participants/${participant.id}`, {
        firstName,
        lastName,
        ci,
        email: email.trim() !== '' ? email : null,
        phone: phone.trim() !== '' ? phone : null,
        type,
      });
      await queryClient.invalidateQueries({ queryKey: ['participants', eventId] });
      toast.success('Inscrito actualizado');
      onCerrar();
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog titulo="Editar inscrito" onCerrar={onCerrar}>
      <form onSubmit={(e) => void submit(e)} className="grid gap-3 md:grid-cols-2">
        <Input
          id="ed-first"
          etiqueta="Nombres"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          id="ed-last"
          etiqueta="Apellidos"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
        <Input
          id="ed-ci"
          etiqueta="CI"
          value={ci}
          onChange={(e) => setCi(e.target.value)}
          required
        />
        <Input
          id="ed-email"
          etiqueta="Correo"
          opcional=" (opcional)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="ed-phone"
          etiqueta="Celular"
          opcional=" (opcional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          id="ed-type"
          etiqueta="Tipo"
          desplegable
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="ESTUDIANTE">Estudiante</option>
          <option value="DOCENTE">Docente</option>
          <option value="PROFESIONAL">Profesional</option>
          <option value="PUBLICO">Público</option>
        </Input>
        <div className="md:col-span-2">
          <Button type="submit" cargando={busy}>
            Guardar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
