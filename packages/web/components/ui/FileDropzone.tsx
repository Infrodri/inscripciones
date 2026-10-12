'use client';

import { useRef, useState } from 'react';

export function FileDropzone({
  etiqueta,
  acepta,
  archivo,
  onArchivo,
  progreso,
}: {
  etiqueta: string;
  acepta: string;
  archivo: File | null;
  onArchivo: (file: File | null) => void;
  progreso: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  function tomar(lista: FileList | null): void {
    onArchivo(lista?.[0] ?? null);
  }

  return (
    <div>
      <span id="dropzone-etiqueta" className="text-[#1B2433]">
        {etiqueta}
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-labelledby="dropzone-etiqueta"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          tomar(e.dataTransfer.files);
        }}
        className={`mt-1 flex min-h-[88px] cursor-pointer flex-col items-center justify-center rounded-[8px] border-2 border-dashed p-4 text-center ${
          arrastrando ? 'border-[#C9A227] bg-[#FAF3E3]' : 'border-[#D9DEE7] bg-white'
        }`}
      >
        <span className="text-sm text-[#5B6677]">
          Arrastre el archivo aquí o toque para elegirlo
        </span>
        {archivo ? <span className="mt-1 text-sm font-medium">{archivo.name}</span> : null}
        {progreso !== null ? (
          <span role="status" className="mt-1 text-sm text-[#0A2A5E]">
            Subiendo… {progreso}%
          </span>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={acepta}
        onChange={(e) => tomar(e.target.files)}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
