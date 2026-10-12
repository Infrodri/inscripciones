'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export function cameraErrorMessage(error: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'La cámara requiere una conexión segura (HTTPS). Abra esta página desde el enlace oficial.';
  }
  const name = (error as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError') {
    return 'Permiso de cámara denegado. Permita el acceso a la cámara en su navegador e intente de nuevo.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No se encontró una cámara trasera en este dispositivo. Use la búsqueda manual.';
  }
  return 'No se pudo iniciar la cámara. Use la búsqueda manual.';
}

export function QrScanner({
  active,
  onScan,
  onError,
}: {
  active: boolean;
  onScan: (text: string) => void;
  onError: (message: string) => void;
}) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) return;
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      onErrorRef.current(cameraErrorMessage(null));
      return;
    }
    const scanner = new Html5Qrcode('qr-reader');
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (text) => onScanRef.current(text),
        () => undefined
      )
      .catch((err: unknown) => onErrorRef.current(cameraErrorMessage(err)));
    return () => {
      void scanner.stop().catch(() => undefined);
    };
  }, [active]);

  return <div id="qr-reader" className="w-full" />;
}
