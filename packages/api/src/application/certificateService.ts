// Casos de uso de certificados (la composición vive en las rutas).
// Los helpers puros (layout, página, dpi) están en infrastructure.
export {
  detectPageSize,
  layoutName,
  mmToPt,
  dpiAtSize,
  type DetectedPage,
  type NameLayout,
} from '@inscripciones/infrastructure/certificates.js';
