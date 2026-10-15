'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export type PaymentValue = {
  isPaid: boolean;
  cost: string;
  institutionQr: File | null;
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

  return (
    <Card className="space-y-4">
      <div className="flex min-h-[44px] items-center gap-2">
        <input
          id="isPaid"
          type="checkbox"
          checked={value.isPaid}
          onChange={(e) => onChange({ ...value, isPaid: e.target.checked })}
          className="h-5 w-5 accent-[var(--color-navy)]"
        />
        <label htmlFor="isPaid" className="cursor-pointer text-sm font-medium text-[var(--color-ink)]">
          Evento de pago
        </label>
      </div>

      {value.isPaid ? (
        <div className="space-y-4">
          <Input
            id="cost"
            etiqueta="Costo"
            type="number"
            min={0}
            step="0.01"
            value={value.cost}
            onChange={(e) => onChange({ ...value, cost: e.target.value })}
            placeholder="0.00"
          />

          <Input
            id="institutionQr"
            etiqueta="QR institucional"
            type="file"
            accept="image/png,image/svg+xml"
            onChange={handleFileChange}
          />

          {previewUrl ? (
            <div className="flex flex-col items-start gap-1">
              <span className="text-xs text-[var(--color-muted)]">Vista previa del QR:</span>
              <img
                src={previewUrl}
                alt="Vista previa QR institucional"
                className="h-32 w-32 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] object-contain p-2"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
