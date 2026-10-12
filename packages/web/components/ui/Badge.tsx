const tones: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-[#5B6677]',
  ABIERTO: 'bg-[#E6F4EC] text-[#1E7B4F]',
  CERRADO: 'bg-[#FAF3E3] text-[#B7791F]',
  FINALIZADO: 'bg-blue-50 text-[#1F4E96]',
  ok: 'bg-[#E6F4EC] text-[#1E7B4F]',
  aviso: 'bg-[#FAF3E3] text-[#B7791F]',
  error: 'bg-[#FDECEA] text-[#B42318]',
  neutro: 'bg-gray-100 text-[#5B6677]',
};

export function Badge({ tono, children }: { tono: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-[8px] px-2 py-1 text-sm ${tones[tono] ?? tones.neutro}`}>
      {children}
    </span>
  );
}
