const tones: Record<string, string> = {
  BORRADOR: 'bg-canvas text-muted',
  ABIERTO: 'bg-ok-bg text-ok',
  CERRADO: 'bg-warn-bg text-warn',
  FINALIZADO: 'bg-blue-bg text-blue',
  ok: 'bg-ok-bg text-ok',
  aviso: 'bg-warn-bg text-warn',
  error: 'bg-danger-bg text-danger',
  neutro: 'bg-canvas text-muted',
};

export function Badge({ tono, children }: { tono: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-[8px] px-2 py-1 text-sm ${tones[tono] ?? tones.neutro}`}>
      {children}
    </span>
  );
}
