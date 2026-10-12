# EVENTO.md — checklist del día del evento (una página)

## 1. Despertar la API (10 minutos antes)

El plan gratis de Render suspende el API sin tráfico.

1. Abrir `https://<servicio>.onrender.com/health` hasta ver `{"ok":true}`.
2. Dejar una pestaña recargándola cada 10 minutos durante el registro.

## 2. Probar antes de abrir puertas

- [ ] Login en `/admin/login` (ADMIN y un STAFF).
- [ ] Escanear un QR de prueba en `/scan/<sessionId>` → pantalla verde.
- [ ] Revisar el conteo en `/admin/eventos/<id>` → pestaña de inscritos.

## 3. Durante el evento

- Cada escáner usa `/scan/<sessionId>` con su sesión.
- Verde = registrado · ámbar = ya registrado (muestra la hora previa) · rojo
  = inválido (usar búsqueda manual).
- Inscripción en puerta: misma pantalla, sección inferior.
- Sin internet: usar la Lista PDF impresa (botón Lista PDF en inscritos).

## 4. Dónde ver estadísticas

`/admin/eventos/<id>` → inscritos, y `/api/v1/events/<id>/stats`
(participantes, por sesión, aptos según `min_attendance_percent`).

## 5. Crear el segundo evento (duplicar)

1. `/admin/eventos/nuevo` → "Duplicar de…" → elegir el evento anterior.
2. Cambiar título, slug y fecha (las sesiones se desplazan los mismos días).
3. Subir el afiche nuevo y publicar. Se copian datos, expositores,
   auspiciantes, sesiones y plantillas; no se copian inscritos.
