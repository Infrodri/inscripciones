import { z } from 'zod';

// Campos de persona compartidos (inscripción pública y puerta).
// CI: alfanumérico, sin espacios, mayúsculas, 5 a 15 caracteres.
// Correo y celular opcionales (vacío = null); el celular se valida en
// normalizePhone (+591XXXXXXXX).
export const personSchema = z.object({
  firstName: z.string().trim().min(1, 'El nombre es obligatorio'),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio'),
  ci: z
    .string()
    .trim()
    .min(1, 'El CI es obligatorio')
    .regex(/^[A-Za-z0-9]{5,15}$/, 'El CI debe tener de 5 a 15 caracteres alfanuméricos'),
  email: z.preprocess(
    (value) => (typeof value !== 'string' || value.trim() === '' ? undefined : value),
    z.string().trim().toLowerCase().pipe(z.string().email('El correo no es válido')).optional()
  ),
  phone: z.string().nullable().optional(),
});
