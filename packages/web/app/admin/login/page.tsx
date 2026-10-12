'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import axios from 'axios';
import { api, apiErrorMessage, setSession } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      const data = res.data as {
        token: string;
        user: { id: string; email: string; name: string; role: string };
      };
      setSession(data.token, data.user);
      router.push('/admin/eventos');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401)
        setError('Credenciales inválidas');
      else setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center p-4">
      <div className="rounded border-t-4 border-[#C9A227] p-6 shadow-sm">
        <p className="text-center text-sm text-[#0A2A5E]">
          Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca
        </p>
        <h1 className="mt-2 text-center font-serif text-2xl text-[#0A2A5E]">
          Ingreso administrador
        </h1>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded border p-2 focus-visible:outline-2 focus-visible:outline-[#0A2A5E]"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded border p-2 focus-visible:outline-2 focus-visible:outline-[#0A2A5E]"
              required
              autoComplete="current-password"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] w-full rounded bg-[#0A2A5E] px-6 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A227]"
          >
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  );
}
