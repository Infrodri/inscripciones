'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';

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
      <h1 className="font-serif text-2xl text-[#0A2A5E]">Usuarios</h1>
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
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="block w-full rounded border p-2"
          required
          aria-label="Nombre"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Correo"
          className="block w-full rounded border p-2"
          required
          aria-label="Correo"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Contraseña (mín. 8)"
          className="block w-full rounded border p-2"
          required
          aria-label="Contraseña"
        />
        <button type="submit" className="min-h-[44px] rounded bg-[#0A2A5E] px-4 py-2 text-white">
          Crear STAFF
        </button>
      </form>
    </div>
  );
}
