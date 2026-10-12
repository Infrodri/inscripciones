'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import axios from 'axios';
import { api, apiErrorMessage, setSession } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

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
      <Card>
        <p className="text-center text-sm text-[#0A2A5E]">
          Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca
        </p>
        <h1 className="mt-2 text-center font-serif text-2xl text-[#0A2A5E]">
          Ingreso administrador
        </h1>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          <Input
            id="email"
            etiqueta="Correo"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            id="password"
            etiqueta="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error ? (
            <p role="alert" className="text-sm text-[#B42318]">
              {error}
            </p>
          ) : null}
          <Button type="submit" cargando={busy} className="w-full">
            Ingresar
          </Button>
        </form>
      </Card>
    </main>
  );
}
