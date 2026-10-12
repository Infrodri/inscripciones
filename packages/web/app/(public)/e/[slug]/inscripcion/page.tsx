import { RegistrationForm } from '@/components/RegistrationForm';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL;

export default async function InscripcionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await fetch(`${API_BASE}/public/events/${slug}`, { cache: 'no-store' });
  const event = res.ok
    ? ((await res.json()) as {
        requireCareer?: boolean;
        requireSemester?: boolean;
        requireInstitution?: boolean;
        requirePhone?: boolean;
      })
    : null;
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="font-serif text-2xl text-[#0A2A5E]">Formulario de inscripción</h1>
      <RegistrationForm
        slug={slug}
        required={{
          career: event?.requireCareer ?? false,
          semester: event?.requireSemester ?? false,
          institution: event?.requireInstitution ?? false,
          phone: event?.requirePhone ?? false,
        }}
      />
    </main>
  );
}
