'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/Table';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

export default function UsuariosPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<{ data: UserRow[] }> => (await api.get('/users')).data,
  });

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    try {
      await api.post('/users', { email, password, name, role: 'STAFF' });
      setEmail('');
      setPassword('');
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario STAFF creado');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  return (
    <div className="max-w-xl">
      <PageHeader titulo="Usuarios" />
      {isLoading ? <p>Cargando…</p> : null}
      {isError ? <p>No se pudieron cargar los usuarios.</p> : null}
      <ul className="mt-4 space-y-1">
        {(data?.data ?? []).map((u) => (
          <li key={u.id} className="text-sm">
            {u.name} — {u.email} ({u.role})
          </li>
        ))}
      </ul>
      <h2 className="mt-6 font-serif text-lg">Nuevo STAFF</h2>
      <form onSubmit={(e) => void submit(e)} className="mt-2 space-y-3">
        <Input
          id="u-nombre"
          etiqueta="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          id="u-correo"
          etiqueta="Correo"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          id="u-clave"
          etiqueta="Contraseña (mín. 8)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit">Crear STAFF</Button>
      </form>
    </div>
  );
}
