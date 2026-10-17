'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export type PaymentValue = {
  isPaid: boolean;
  cost: string;
  institutionQr: File | null;
  currentQrUrl?: string | null;
};

export function PaymentFields({
  value,
  onChange,
}: {
  value: PaymentValue;
  onChange: (v: PaymentValue) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (value.institutionQr) {
      const objectUrl = URL.createObjectURL(value.institutionQr);
      setPreviewUrl(objectUrl);
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [value.institutionQr]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0] ?? null;
    onChange({ ...value, institutionQr: file });
  }

  const displayedQr = previewUrl ?? value.currentQrUrl;

  return (
    <Card className="rounded-[12px] border border-line bg-surface p-6 shadow-soft space-y-4">
      <div className="flex min-h-[44px] items-center gap-2">
        <input
          id="isPaid"
          type="checkbox"
          checked={value.isPaid}
          onChange={(e) => onChange({ ...value, isPaid: e.target.checked })}
          className="h-5 w-5 accent-navy cursor-pointer"
        />
        <label htmlFor="isPaid" className="cursor-pointer text-sm font-semibold text-ink">
          Evento de pago
        </label>
      </div>

      {value.isPaid ? (
        <div className="space-y-4 pt-2 border-t border-line">
          <Input
            id="cost"
            etiqueta="Costo en Bolivianos (Bs)"
            type="number"
            min={0}
            step="0.01"
            value={value.cost}
            onChange={(e) => onChange({ ...value, cost: e.target.value })}
            placeholder="0.00"
            required
          />

          <Input
            id="institutionQr"
            etiqueta="QR institucional para transferencias"
            opcional={displayedQr ? ' (deje vacío para mantener el actual)' : undefined}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg"
            onChange={handleFileChange}
          />

          {displayedQr ? (
            <div className="flex flex-col items-start gap-1">
              <span className="text-xs text-muted">
                {previewUrl ? 'Vista previa del nuevo QR:' : 'QR institucional configurado:'}
              </span>
              <img
                src={displayedQr}
                alt="QR institucional de pago"
                className="h-36 w-36 rounded-[var(--radius-md)] border border-line bg-surface object-contain p-2 shadow-soft"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
