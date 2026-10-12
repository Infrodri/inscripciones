import { RegistrationForm } from '@/components/RegistrationForm';

export const dynamic = 'force-dynamic';

export default async function InscripcionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="font-serif text-2xl text-[#0A2A5E]">Formulario de inscripción</h1>
      <RegistrationForm slug={slug} />
    </main>
  );
}
