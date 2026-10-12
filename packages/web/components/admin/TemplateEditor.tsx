'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getToken } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface NameBox {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  fontKey: 'sans' | 'serif' | 'script';
  sizePt: number;
  color: string;
  align: 'left' | 'center' | 'right';
  nameCase: 'UPPER' | 'TITLE' | 'AS_TYPED';
  autoShrink: true;
}

interface TemplateDetail {
  id: string;
  name: string;
  nameBox: NameBox;
}

async function fetchBlobUrl(path: string): Promise<string> {
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) throw new Error('No se pudo cargar la imagen');
  return URL.createObjectURL(await res.blob());
}

export function TemplateEditor({ templateId, eventId }: { templateId: string; eventId: string }) {
  const queryClient = useQueryClient();
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ x0: number; y0: number; w0: number; h0: number } | null>(null);
  const [box, setBox] = useState<NameBox | null>(null);
  const [sample, setSample] = useState('María Eugenia Santiváñez Rocha');
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    fetchBlobUrl(`/certificate-templates/${templateId}/file`)
      .then((u) => {
        url = u;
        setImgUrl(u);
      })
      .catch(() => toast.error('No se pudo cargar la plantilla'));
    void api
      .get(`/events/${eventId}/certificate-templates`)
      .then((res) => {
        const found = ((res.data as { data: TemplateDetail[] }).data ?? []).find(
          (t) => t.id === templateId
        );
        if (found) setBox(found.nameBox);
      })
      .catch(() => undefined);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [templateId, eventId]);

  function framePct(clientX: number, clientY: number): { x: number; y: number } {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }

  async function save(): Promise<void> {
    if (!box) return;
    try {
      await api.patch(`/certificate-templates/${templateId}`, { nameBox: box });
      await queryClient.invalidateQueries({ queryKey: ['templates', eventId] });
      toast.success('Caja guardada');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401)
        toast.error(apiErrorMessage(error));
    }
  }

  async function longestName(): Promise<void> {
    try {
      const res = await api.get(`/participants/event/${eventId}`, { params: { pageSize: 100 } });
      const items =
        (res.data as { data: Array<{ firstName: string; lastName: string }> }).data ?? [];
      let best = '';
      for (const p of items) {
        const full = `${p.firstName} ${p.lastName}`;
        if (full.length > best.length) best = full;
      }
      if (best) setSample(best);
      else toast.error('No hay inscritos para probar');
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function preview(): Promise<void> {
    try {
      const url = await fetchBlobUrl(
        `/certificate-templates/${templateId}/preview.pdf?sampleName=${encodeURIComponent(sample)}`
      );
      window.open(url, '_blank');
    } catch {
      toast.error('No se pudo generar la vista previa');
    }
  }

  if (!box) return <p className="mt-4">Cargando editor…</p>;
  return (
    <div className="mt-4 rounded border p-3">
      <h3 className="font-serif">Caja del nombre</h3>
      <div
        ref={frameRef}
        className="relative mt-2 w-full select-none overflow-hidden rounded border"
        style={{ aspectRatio: '2000 / 1414' }}
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt="Plantilla"
            className="absolute inset-0 h-full w-full"
            draggable={false}
          />
        ) : null}
        <div
          className="absolute cursor-move rounded border-2 border-[#C9A227]"
          style={{
            left: `${box.xPct}%`,
            top: `${box.yPct}%`,
            width: `${box.wPct}%`,
            height: `${box.hPct}%`,
          }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            const p = framePct(e.clientX, e.clientY);
            dragRef.current = { dx: p.x - box.xPct, dy: p.y - box.yPct };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const p = framePct(e.clientX, e.clientY);
            setBox({
              ...box,
              xPct: Math.max(0, p.x - dragRef.current.dx),
              yPct: Math.max(0, p.y - dragRef.current.dy),
            });
          }}
          onPointerUp={() => (dragRef.current = null)}
        >
          <span className="block truncate p-1" style={{ color: box.color, textAlign: box.align }}>
            {sample}
          </span>
          <span
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize bg-[#C9A227]"
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              resizeRef.current = { x0: e.clientX, y0: e.clientY, w0: box.wPct, h0: box.hPct };
            }}
            onPointerMove={(e) => {
              const r = resizeRef.current;
              const rect = frameRef.current?.getBoundingClientRect();
              if (!r || !rect) return;
              setBox({
                ...box,
                wPct: Math.max(2, r.w0 + ((e.clientX - r.x0) / rect.width) * 100),
                hPct: Math.max(2, r.h0 + ((e.clientY - r.y0) / rect.height) * 100),
              });
            }}
            onPointerUp={() => (resizeRef.current = null)}
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <label className="text-sm">
          Fuente
          <select
            value={box.fontKey}
            onChange={(e) => setBox({ ...box, fontKey: e.target.value as NameBox['fontKey'] })}
            className="block w-full rounded border p-1"
          >
            <option value="sans">Sans</option>
            <option value="serif">Serif</option>
            <option value="script">Cursiva</option>
          </select>
        </label>
        <label className="text-sm">
          Tamaño (pt)
          <input
            type="number"
            min={6}
            max={200}
            value={box.sizePt}
            onChange={(e) => setBox({ ...box, sizePt: Number(e.target.value) })}
            className="block w-full rounded border p-1"
          />
        </label>
        <label className="text-sm">
          Color
          <input
            type="color"
            value={box.color}
            onChange={(e) => setBox({ ...box, color: e.target.value })}
            className="block h-9 w-full rounded border"
          />
        </label>
        <label className="text-sm">
          Alineación
          <select
            value={box.align}
            onChange={(e) => setBox({ ...box, align: e.target.value as NameBox['align'] })}
            className="block w-full rounded border p-1"
          >
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </label>
        <label className="text-sm">
          Mayúsculas
          <select
            value={box.nameCase}
            onChange={(e) => setBox({ ...box, nameCase: e.target.value as NameBox['nameCase'] })}
            className="block w-full rounded border p-1"
          >
            <option value="TITLE">Título</option>
            <option value="UPPER">Mayúsculas</option>
            <option value="AS_TYPED">Tal cual</option>
          </select>
        </label>
        <label className="text-sm">
          Nombre de muestra
          <input
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            className="block w-full rounded border p-1"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void save()}>Guardar caja</Button>
        <Button variant="secundario" onClick={() => void longestName()}>
          Probar con el nombre más largo
        </Button>
        <Button variant="secundario" onClick={() => void preview()}>
          Vista previa PDF
        </Button>
      </div>
    </div>
  );
}
