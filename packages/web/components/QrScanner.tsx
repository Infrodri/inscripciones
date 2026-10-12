'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export function QrScanner({ active, onScan }: { active: boolean; onScan: (text: string) => void }) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!active) return;
    const scanner = new Html5Qrcode('qr-reader');
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (text) => onScanRef.current(text),
        () => undefined
      )
      .catch(() => undefined);
    return () => {
      void scanner.stop().catch(() => undefined);
    };
  }, [active]);

  return <div id="qr-reader" className="w-full" />;
}
