'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, apiUrl, getToken } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useUnsavedChanges } from '@/components/ui/Dialog';
import { PdfPreviewDialog } from './PdfPreviewDialog';

export interface NameBox {
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

export interface TemplateDetail {
  id: string;
  name: string;
  nameBox: NameBox;
  widthPx: number;
  heightPx: number;
}

const FONT_FAMILY: Record<NameBox['fontKey'], string> = {
  sans: 'sans-serif',
  serif: 'serif',
  script: 'cursive',
};

export function previewFit(
  sample: string,
  box: NameBox,
  imgWidthPx: number,
  measure: (text: string, px: number, family: string) => number
): { sizePt: number; overflow: boolean } {
  const clean = sample.trim().replace(/\s+/g, ' ');
  const boxPx = (box.wPct / 100) * imgWidthPx;
  const family = FONT_FAMILY[box.fontKey];
  let size = box.sizePt;
  while (size > 8 && measure(clean, (size * 96) / 72, family) > boxPx) size -= 0.5;
  const fits = measure(clean, (size * 96) / 72, family) <= boxPx;
  return { sizePt: size, overflow: !fits };
}

function formatSampleName(name: string, mode: NameBox['nameCase']): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (mode === 'UPPER') return clean.toLocaleUpperCase('es-BO');
  if (mode === 'AS_TYPED') return clean;
  const particles = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);
  return clean
    .split(' ')
    .map((word, index) => {
      const lower = word.toLocaleLowerCase('es-BO');
      if (index > 0 && particles.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase('es-BO') + lower.slice(1);
    })
    .join(' ');
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
  const [box, setBox] = useState<NameBox | null>(null);
  const [sample, setSample] = useState('María Eugenia Santiváñez Rocha');
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgWidth, setImgWidth] = useState(0);
  const [frameWidth, setFrameWidth] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const initialBox = useRef<NameBox | null>(null);
  useUnsavedChanges(dirty);

  // Drag and resize active action state
  const [activeAction, setActiveAction] = useState<{
    type: 'drag' | 'resize';
    handle?: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 's';
    startX: number;
    startY: number;
    startBox: NameBox;
  } | null>(null);

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
        if (found) {
          setBox(found.nameBox);
          setImgWidth(found.widthPx);
          initialBox.current = found.nameBox;
          setDirty(false);
        }
      })
      .catch(() => undefined);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [templateId, eventId]);

  useEffect(() => {
    if (!box || !initialBox.current) return;
    setDirty(JSON.stringify(box) !== JSON.stringify(initialBox.current));
  }, [box]);

  // Observe container width to scale font preview accurately
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setFrameWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [imgUrl]);

  // Window pointer listeners for buttery smooth dragging and resizing
  useEffect(() => {
    if (!activeAction) return;

    const onPointerMove = (e: PointerEvent) => {
      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const deltaXPct = ((e.clientX - activeAction.startX) / rect.width) * 100;
      const deltaYPct = ((e.clientY - activeAction.startY) / rect.height) * 100;
      const b0 = activeAction.startBox;

      if (activeAction.type === 'drag') {
        const nextX = Math.max(0, Math.min(100 - b0.wPct, b0.xPct + deltaXPct));
        const nextY = Math.max(0, Math.min(100 - b0.hPct, b0.yPct + deltaYPct));
        setBox((prev) =>
          prev
            ? {
                ...prev,
                xPct: Math.round(nextX * 100) / 100,
                yPct: Math.round(nextY * 100) / 100,
              }
            : null
        );
      } else if (activeAction.type === 'resize') {
        const handle = activeAction.handle ?? 'se';
        let newX = b0.xPct;
        let newY = b0.yPct;
        let newW = b0.wPct;
        let newH = b0.hPct;

        if (handle.includes('e')) {
          newW = Math.max(5, Math.min(100 - b0.xPct, b0.wPct + deltaXPct));
        }
        if (handle.includes('s')) {
          newH = Math.max(2, Math.min(100 - b0.yPct, b0.hPct + deltaYPct));
        }
        if (handle.includes('w')) {
          const maxLeftShift = b0.xPct;
          const maxRightShift = b0.wPct - 5;
          const clampedDeltaX = Math.max(-maxLeftShift, Math.min(maxRightShift, deltaXPct));
          newX = b0.xPct + clampedDeltaX;
          newW = b0.wPct - clampedDeltaX;
        }
        if (handle.includes('n')) {
          const maxUpShift = b0.yPct;
          const maxDownShift = b0.hPct - 2;
          const clampedDeltaY = Math.max(-maxUpShift, Math.min(maxDownShift, deltaYPct));
          newY = b0.yPct + clampedDeltaY;
          newH = b0.hPct - clampedDeltaY;
        }

        setBox((prev) =>
          prev
            ? {
                ...prev,
                xPct: Math.round(newX * 100) / 100,
                yPct: Math.round(newY * 100) / 100,
                wPct: Math.round(newW * 100) / 100,
                hPct: Math.round(newH * 100) / 100,
              }
            : null
        );
      }
    };

    const onPointerUp = () => {
      setActiveAction(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [activeAction]);

  async function save(): Promise<void> {
    if (!box) return;
    try {
      await api.patch(`/certificate-templates/${templateId}`, { nameBox: box });
      await queryClient.invalidateQueries({ queryKey: ['templates', eventId] });
      initialBox.current = box;
      setDirty(false);
      toast.success('Caja guardada correctamente');
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
    if (!box) return;
    try {
      // Si hubo cambios no guardados, guardar primero para que el PDF refleje las coordenadas exactas
      if (dirty) {
        await api.patch(`/certificate-templates/${templateId}`, { nameBox: box });
        initialBox.current = box;
        setDirty(false);
      }
      setShowPdfPreview(true);
    } catch (error) {
      toast.error('No se pudo guardar la caja para la vista previa');
    }
  }

  if (!box) return <p className="mt-4 text-sm text-muted">Cargando editor de plantilla…</p>;

  // Escala visual de la tipografía acorde al ancho renderizado de la imagen
  const scale =
    frameWidth > 0 && imgWidth > 0
      ? frameWidth / imgWidth
      : frameWidth > 0
        ? frameWidth / 2000
        : 0.4;
  const visualFontSize = Math.max(9, Math.round(box.sizePt * (96 / 72) * scale));

  return (
    <div className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-navy">Editor visual del certificado</h3>
          <p className="text-xs text-muted">
            Arrastre o redimensione la caja del nombre. También puede calibrar las coordenadas y la tipografía en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-semibold text-warn">
              Cambios sin guardar
            </span>
          ) : (
            <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success">
              Guardado
            </span>
          )}
        </div>
      </div>

      {/* Canvas / Frame visual interactivo */}
      <div
        ref={frameRef}
        className="relative mt-4 w-full select-none overflow-hidden rounded-lg border border-line bg-canvas shadow-inner"
        style={{ aspectRatio: '2000 / 1414' }}
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt="Plantilla de certificado"
            className="absolute inset-0 h-full w-full object-contain pointer-events-none"
            draggable={false}
          />
        ) : null}

        {/* Caja del nombre interactiva */}
        <div
          className="absolute cursor-move rounded border-2 border-primary bg-primary/10 shadow-sm transition-shadow hover:shadow-md"
          style={{
            left: `${box.xPct}%`,
            top: `${box.yPct}%`,
            width: `${box.wPct}%`,
            height: `${box.hPct}%`,
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActiveAction({
              type: 'drag',
              startX: e.clientX,
              startY: e.clientY,
              startBox: { ...box },
            });
          }}
        >
          {/* Texto del nombre con fuente, tamaño, alineación y color reales */}
          <div
            className="relative flex h-full w-full items-center overflow-hidden px-2 pointer-events-none"
            style={{
              justifyContent:
                box.align === 'center'
                  ? 'center'
                  : box.align === 'right'
                    ? 'flex-end'
                    : 'flex-start',
            }}
          >
            <span
              className="block select-none truncate"
              style={{
                color: box.color,
                textAlign: box.align,
                fontSize: `${visualFontSize}px`,
                fontFamily: FONT_FAMILY[box.fontKey],
                lineHeight: 1.15,
              }}
            >
              {formatSampleName(sample, box.nameCase)}
            </span>
          </div>

          {/* Manijas de redimensionamiento */}
          {/* Esquina superior izquierda */}
          <span
            className="absolute -left-1.5 -top-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-full border border-white bg-primary shadow-sm hover:scale-125"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveAction({
                type: 'resize',
                handle: 'nw',
                startX: e.clientX,
                startY: e.clientY,
                startBox: { ...box },
              });
            }}
          />
          {/* Esquina superior derecha */}
          <span
            className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 cursor-nesw-resize rounded-full border border-white bg-primary shadow-sm hover:scale-125"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveAction({
                type: 'resize',
                handle: 'ne',
                startX: e.clientX,
                startY: e.clientY,
                startBox: { ...box },
              });
            }}
          />
          {/* Esquina inferior izquierda */}
          <span
            className="absolute -bottom-1.5 -left-1.5 h-3.5 w-3.5 cursor-nesw-resize rounded-full border border-white bg-primary shadow-sm hover:scale-125"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveAction({
                type: 'resize',
                handle: 'sw',
                startX: e.clientX,
                startY: e.clientY,
                startBox: { ...box },
              });
            }}
          />
          {/* Esquina inferior derecha (principal) */}
          <span
            className="absolute -bottom-2 -right-2 flex h-4 w-4 cursor-nwse-resize items-center justify-center rounded-full border-2 border-white bg-primary shadow hover:scale-125"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveAction({
                type: 'resize',
                handle: 'se',
                startX: e.clientX,
                startY: e.clientY,
                startBox: { ...box },
              });
            }}
          />
          {/* Manija borde derecho */}
          <span
            className="absolute -right-1 top-1/2 h-3.5 w-2 -translate-y-1/2 cursor-ew-resize rounded-sm border border-white bg-primary hover:scale-125"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveAction({
                type: 'resize',
                handle: 'e',
                startX: e.clientX,
                startY: e.clientY,
                startBox: { ...box },
              });
            }}
          />
          {/* Manija borde inferior */}
          <span
            className="absolute -bottom-1 left-1/2 h-2 w-3.5 -translate-x-1/2 cursor-ns-resize rounded-sm border border-white bg-primary hover:scale-125"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveAction({
                type: 'resize',
                handle: 's',
                startX: e.clientX,
                startY: e.clientY,
                startBox: { ...box },
              });
            }}
          />
        </div>
      </div>

      {/* Controles de tipografía y formato */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="block text-xs font-semibold text-muted">Fuente</label>
          <select
            value={box.fontKey}
            onChange={(e) => setBox({ ...box, fontKey: e.target.value as NameBox['fontKey'] })}
            className="mt-1 block min-h-[44px] w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          >
            <option value="serif">Serif (Formal / Tradicional)</option>
            <option value="sans">Sans (Moderna / Limpia)</option>
            <option value="script">Cursiva (Caligráfica)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted">Tamaño ({box.sizePt} pt)</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={6}
              max={200}
              value={box.sizePt}
              onChange={(e) => setBox({ ...box, sizePt: Number(e.target.value) || 12 })}
              className="block min-h-[44px] w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted">Color del texto</label>
          <div className="mt-1 flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-line bg-surface px-2">
            <input
              type="color"
              value={box.color}
              onChange={(e) => setBox({ ...box, color: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span className="text-xs font-mono text-muted">{box.color.toUpperCase()}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted">Alineación</label>
          <select
            value={box.align}
            onChange={(e) => setBox({ ...box, align: e.target.value as NameBox['align'] })}
            className="mt-1 block min-h-[44px] w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          >
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted">Mayúsculas / Formato</label>
          <select
            value={box.nameCase}
            onChange={(e) => setBox({ ...box, nameCase: e.target.value as NameBox['nameCase'] })}
            className="mt-1 block min-h-[44px] w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          >
            <option value="TITLE">Título (Primera letra mayúscula)</option>
            <option value="UPPER">MAYÚSCULAS COMPLETAS</option>
            <option value="AS_TYPED">Tal cual se registró</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted">Nombre de muestra</label>
          <input
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            className="mt-1 block min-h-[44px] w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Calibración numérica de coordenadas para precisión milimétrica */}
      <div className="mt-4 rounded-lg border border-line bg-canvas p-3">
        <p className="text-xs font-semibold text-navy">Coordenadas y dimensiones de la caja (%)</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <label className="block text-[11px] text-muted">Posición X (%)</label>
            <input
              type="number"
              step="0.5"
              min={0}
              max={95}
              value={box.xPct}
              onChange={(e) =>
                setBox({
                  ...box,
                  xPct: Math.max(0, Math.min(100 - box.wPct, Number(e.target.value) || 0)),
                })
              }
              className="mt-0.5 block min-h-[38px] w-full rounded border border-line bg-surface px-2 text-xs text-ink"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted">Posición Y (%)</label>
            <input
              type="number"
              step="0.5"
              min={0}
              max={95}
              value={box.yPct}
              onChange={(e) =>
                setBox({
                  ...box,
                  yPct: Math.max(0, Math.min(100 - box.hPct, Number(e.target.value) || 0)),
                })
              }
              className="mt-0.5 block min-h-[38px] w-full rounded border border-line bg-surface px-2 text-xs text-ink"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted">Ancho (%)</label>
            <input
              type="number"
              step="0.5"
              min={5}
              max={100}
              value={box.wPct}
              onChange={(e) =>
                setBox({
                  ...box,
                  wPct: Math.max(5, Math.min(100 - box.xPct, Number(e.target.value) || 5)),
                })
              }
              className="mt-0.5 block min-h-[38px] w-full rounded border border-line bg-surface px-2 text-xs text-ink"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted">Alto (%)</label>
            <input
              type="number"
              step="0.5"
              min={2}
              max={100}
              value={box.hPct}
              onChange={(e) =>
                setBox({
                  ...box,
                  hPct: Math.max(2, Math.min(100 - box.yPct, Number(e.target.value) || 2)),
                })
              }
              className="mt-0.5 block min-h-[38px] w-full rounded border border-line bg-surface px-2 text-xs text-ink"
            />
          </div>
        </div>
      </div>

      {/* Botones de acción principales */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()}>Guardar caja</Button>
        <Button variant="secundario" onClick={() => void preview()}>
          Vista previa PDF
        </Button>
        <Button variant="fantasma" onClick={() => void longestName()}>
          Probar con el nombre más largo
        </Button>
      </div>

      <FitNotice sample={sample} box={box} imgWidthPx={imgWidth} />

      {/* Modal de visualización interactiva del PDF */}
      {showPdfPreview ? (
        <PdfPreviewDialog
          titulo={`Certificado — ${sample}`}
          totalPaginas={1}
          nombreArchivo={`certificado-previa-${templateId}.pdf`}
          onCargar={async () => {
            const res = await api.get<Blob>(
              `/certificate-templates/${templateId}/preview.pdf?sampleName=${encodeURIComponent(
                sample
              )}`,
              { responseType: 'blob' }
            );
            return res.data;
          }}
          onCerrar={() => setShowPdfPreview(false)}
        />
      ) : null}
    </div>
  );
}

function FitNotice({
  sample,
  box,
  imgWidthPx,
}: {
  sample: string;
  box: NameBox;
  imgWidthPx: number;
}) {
  if (imgWidthPx === 0) return null;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext('2d');
  if (!ctx) return null;
  const fit = previewFit(sample, box, imgWidthPx, (text, px, family) => {
    ctx.font = `${px}px ${family}`;
    return ctx.measureText(text).width;
  });
  if (!fit.overflow && fit.sizePt >= box.sizePt) return null;
  return (
    <p
      role="status"
      className="mt-3 rounded-lg border border-warn/30 bg-warn-bg p-3 text-xs text-ink"
    >
      {fit.overflow
        ? 'Aviso: el nombre seleccionado no cabe en la caja ni al tamaño mínimo (8 pt); se imprimirá ajustado al límite.'
        : `Aviso: el nombre seleccionado se reducirá automáticamente a ${fit.sizePt.toFixed(1)} pt para caber dentro del ancho.`}
    </p>
  );
}
