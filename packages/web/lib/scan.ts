export type ScanResult =
  | { kind: 'idle' }
  | { kind: 'ok'; name: string }
  | { kind: 'dup'; name: string }
  | { kind: 'error'; message: string };

// Mapeo código de API → estado de pantalla (verde/ámbar/rojo).
export function toScanResult(
  response: { firstName?: string; lastName?: string } | null,
  error: { code?: string; message?: string } | null
): ScanResult {
  if (response)
    return { kind: 'ok', name: `${response.firstName ?? ''} ${response.lastName ?? ''}`.trim() };
  if (error?.code === 'ALREADY_CHECKED_IN') return { kind: 'dup', name: error.message ?? '' };
  return { kind: 'error', message: error?.message ?? 'Ocurrió un error inesperado' };
}
