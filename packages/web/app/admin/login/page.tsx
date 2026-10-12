'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      setToken(res.data.token as string);
      router.push('/admin/eventos');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        toast.error('Credenciales inválidas');
      else toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="font-serif text-2xl text-[#0A2A5E]">Ingreso administrador</h1>
      <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full rounded border p-2"
            required
          />
        </div>
        <div>
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full rounded border p-2"
            required
          />
        </div>
        <button type="submit" disabled={busy} className="rounded bg-[#0A2A5E] px-6 py-2 text-white">
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
