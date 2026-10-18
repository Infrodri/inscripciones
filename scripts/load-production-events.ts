import fs from 'node:fs';
import path from 'node:path';

interface LoadLogEntry {
  type: 'EVENT' | 'SESSION' | 'SPEAKER' | 'TEMPLATE' | 'RECIPIENT';
  id: string;
  name: string;
  slug?: string;
  createdAt: string;
}

interface LoadLog {
  targetApi: string;
  executedAt: string;
  entries: LoadLogEntry[];
}

const LOG_FILE = path.resolve(process.cwd(), 'load-log.json');

async function main() {
  const args = process.argv.slice(2);
  const isConfirm = args.includes('--confirm-production');
  const isRollback = args.includes('--rollback');

  const apiUrl = (process.env.PROD_API_URL || '').replace(/\/$/, '');
  const email = process.env.PROD_ADMIN_EMAIL || '';
  const password = process.env.PROD_ADMIN_PASSWORD || '';

  console.log('====================================================');
  console.log('SCRIPT DE CARGA DE EVENTOS A PRODUCCIÓN');
  console.log('====================================================');
  console.log(`Destino API: ${apiUrl || 'NO CONFIGURADO (PROD_API_URL falta)'}`);
  console.log(
    `Modo: ${isRollback ? 'ROLLBACK' : isConfirm ? 'EJECUCIÓN REAL (--confirm-production)' : 'SIMULACIÓN (DRY-RUN)'}`
  );
  console.log('====================================================\n');

  let token = process.env.PROD_ADMIN_TOKEN || '';

  if (!apiUrl) {
    console.error('ERROR: Falta variable de entorno requerida: PROD_API_URL');
    process.exit(1);
  }

  if (!token && (!email || !password)) {
    console.error('ERROR: Faltan credenciales de administración (PROD_ADMIN_TOKEN o PROD_ADMIN_EMAIL + PROD_ADMIN_PASSWORD).');
    process.exit(1);
  }

  // 1. Autenticación en API de producción
  if (!token) {
    console.log('1. Autenticando con usuario administrador en la API...');
    const loginRes = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!loginRes.ok) {
      console.error(`Error en login (${loginRes.status}): Credenciales no válidas o error en el servicio`);
      process.exit(1);
    }

    const loginData = (await loginRes.json()) as { token: string; user?: { role: string } };
    token = loginData.token;
    console.log('Autenticación exitosa. Token obtenido.\n');
  } else {
    console.log('1. Utilizando token de administración autenticado provisto.\n');
  }

  // Modo ROLLBACK
  if (isRollback) {
    if (!fs.existsSync(LOG_FILE)) {
      console.error(`No existe el archivo de registro ${LOG_FILE} para rollback.`);
      process.exit(1);
    }
    const logData = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) as LoadLog;
    console.log(
      `Iniciando Rollback de ${logData.entries.length} elementos creados en ${logData.executedAt}...`
    );

    // Filtramos solo los eventos principales para eliminar en cascada
    const eventEntries = logData.entries.filter((e) => e.type === 'EVENT');
    for (const entry of eventEntries) {
      console.log(`Eliminando evento ${entry.name} (${entry.id})...`);
      if (isConfirm) {
        const delRes = await fetch(`${apiUrl}/api/v1/events/${entry.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: entry.name }),
        });
        if (delRes.ok) {
          console.log(`-> Eliminado exitosamente.`);
        } else {
          console.error(`-> Error al eliminar (${delRes.status}): ${await delRes.text()}`);
        }
      } else {
        console.log(`-> [SIMULACIÓN] Se ejecutaría DELETE /api/v1/events/${entry.id}`);
      }
    }
    console.log('\nRollback completado.');
    return;
  }

  // 2. Comprobar eventos existentes (idempotencia y seguridad)
  console.log('2. Consultando eventos actuales en producción para verificar colisiones...');
  const existingEventsRes = await fetch(`${apiUrl}/api/v1/events?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!existingEventsRes.ok) {
    console.error(
      `Error al listar eventos (${existingEventsRes.status}): ${await existingEventsRes.text()}`
    );
    process.exit(1);
  }
  const existingEventsData = (await existingEventsRes.json()) as {
    data: Array<{ id: string; slug: string; title: string }>;
  };
  const existingSlugs = new Set(existingEventsData.data.map((e) => e.slug));
  console.log(`Se encontraron ${existingEventsData.data.length} eventos en producción.`);

  const slugsToCreate = [
    'reunion-nacional-sectorial-derecho-2026',
    'transformacion-multilateralismo-onu-2026',
    'analisis-proyecto-ley-denuncias-falsas-2026',
    'estado-derecho-justicia-penal-bolivia-2026',
  ];

  for (const s of slugsToCreate) {
    if (existingSlugs.has(s)) {
      console.error(
        `ALERTA DE SEGURIDAD: El slug '${s}' ya existe en producción. Se detiene el proceso.`
      );
      process.exit(1);
    }
  }
  console.log('Confirmado: ninguno de los 4 slugs a crear colisiona con la producción.\n');

  const logEntries: LoadLogEntry[] = [];

  // Helper para POST autenticado
  async function apiPost(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<{ id: string } & Record<string, unknown>> {
    if (!isConfirm) {
      return { id: `sim-${Date.now()}-${Math.random().toString(36).substring(7)}`, ...body };
    }
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${endpoint} falló (${res.status}): ${await res.text()}`);
    }
    return res.json();
  }

  // =========================================================================
  // A. SECTORIAL DE DERECHO
  // =========================================================================
  console.log(
    '3. Preparando Evento A: Reunión Nacional de Seguimiento a la Sectorial de Carreras de Derecho...'
  );
  const sectorialPayload = {
    title: 'Reunión Nacional de Seguimiento a la Sectorial de Carreras de Derecho',
    slug: 'reunion-nacional-sectorial-derecho-2026',
    eventKind: 'Reunión Nacional / Sectorial',
    institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
    organizer: 'Carrera de Derecho, Facultad de Derecho, Ciencias Políticas y Sociales',
    location: 'Facultad de Derecho, calle Colombia esq. Av. Germán Mendoza s/n, Sucre',
    modality: 'PRESENCIAL',
    status: 'ABIERTO',
    isFree: true,
    minAttendancePercent: 66,
    checkinWindowMinutes: 90,
    requireCareer: true,
    requireInstitution: true,
  };

  const createdSectorial = await apiPost('/api/v1/events', sectorialPayload);
  console.log(`Evento Sectorial creado: ID ${createdSectorial.id}`);
  logEntries.push({
    type: 'EVENT',
    id: createdSectorial.id,
    name: sectorialPayload.title,
    slug: sectorialPayload.slug,
    createdAt: new Date().toISOString(),
  });

  // 6 Sesiones de la Sectorial
  const sesionesSectorial = [
    {
      label: 'Acto de inauguración',
      location: 'Salón de Honor, Patio Histórico, Facultad de Derecho, calle Junín N.º 652',
      startsAt: '2026-10-19T09:30:00-04:00',
      endsAt: '2026-10-19T11:00:00-04:00', // PROVISIONAL SUPUESTO
    },
    {
      label:
        'Mesa N.º 1: Seguimiento y evaluación del cumplimiento de resoluciones y acuerdos de la Sectorial 2023',
      location:
        'Sala de Defensas, 2.º piso, Facultad de Derecho (calle Colombia esq. Av. Germán Mendoza)',
      startsAt: '2026-10-19T11:00:00-04:00',
      endsAt: '2026-10-19T13:00:00-04:00', // PROVISIONAL SUPUESTO
    },
    {
      label:
        'Mesa N.º 2: Seguimiento y evaluación del cumplimiento de resoluciones y acuerdos de la Sectorial 2023',
      location: 'Aula A-201, Facultad de Derecho (calle Colombia esq. Av. Germán Mendoza)',
      startsAt: '2026-10-19T11:00:00-04:00',
      endsAt: '2026-10-19T13:00:00-04:00', // PROVISIONAL SUPUESTO
    },
    {
      label: 'Sesión plenaria',
      location: 'Salón de Honor «Ramiro Samos Oroza», calle Colombia esq. Av. Germán Mendoza',
      startsAt: '2026-10-20T10:30:00-04:00',
      endsAt: '2026-10-20T16:00:00-04:00', // PROVISIONAL SUPUESTO
    },
    {
      label: 'Lectura de conclusiones',
      location: 'Salón de Honor «Ramiro Samos Oroza»',
      startsAt: '2026-10-20T16:00:00-04:00',
      endsAt: '2026-10-20T18:30:00-04:00', // PROVISIONAL SUPUESTO
    },
    {
      label: 'Acto de clausura',
      location: 'Salón de Honor «Ramiro Samos Oroza»',
      startsAt: '2026-10-20T18:30:00-04:00',
      endsAt: '2026-10-20T19:30:00-04:00', // PROVISIONAL SUPUESTO
    },
  ];

  for (const s of sesionesSectorial) {
    const ses = await apiPost('/api/v1/sessions', { eventId: createdSectorial.id, ...s });
    console.log(` - Sesión creada: ${s.label} (${ses.id})`);
    logEntries.push({
      type: 'SESSION',
      id: ses.id,
      name: s.label,
      createdAt: new Date().toISOString(),
    });
  }

  // 6 Expositores
  const expositoresSectorial = [
    {
      fullName: 'Dr. César Suárez Saavedra',
      role: 'MODERADOR',
      titleProfession: 'Abogado y docente universitario',
    },
    {
      fullName: 'Dr. Wilfredo Cervantes Ortiz',
      role: 'MODERADOR',
      titleProfession: 'Relator Mesa N.º 1',
    },
    {
      fullName: 'Dr. Ramiro Ibáñez Ferrufino',
      role: 'MODERADOR',
      titleProfession: 'Moderador Mesa N.º 2',
    },
    {
      fullName: 'Dr. Luis Fernando Gorena Belling',
      role: 'MODERADOR',
      titleProfession: 'Relator Mesa N.º 2 / Comité de Coordinación',
    },
    {
      fullName: 'Dr. Marco Antonio Barroso Mendizábal',
      role: 'MODERADOR',
      titleProfession: 'Moderador Sesión Plenaria / Comité de Coordinación',
    },
    {
      fullName: 'Dra. Ma. Tania Álvarez Gantier',
      role: 'MODERADOR',
      titleProfession: 'Relator Sesión Plenaria',
    },
  ];

  for (const exp of expositoresSectorial) {
    const spk = await apiPost(`/api/v1/events/${createdSectorial.id}/speakers`, exp);
    console.log(` - Expositor/Relator creado: ${exp.fullName} (${spk.id})`);
    logEntries.push({
      type: 'SPEAKER',
      id: spk.id,
      name: exp.fullName,
      createdAt: new Date().toISOString(),
    });
  }

  // =========================================================================
  // B. TRES EVENTOS RETROACTIVOS DE AFICHES (FINALIZADOS)
  // =========================================================================
  console.log('\n4. Preparando Eventos B (Afiches retroactivos)...');

  // E1
  const e1Payload = {
    title: 'Transformación o fin del multilateralismo en la ONU',
    slug: 'transformacion-multilateralismo-onu-2026',
    eventKind: 'Conferencia',
    institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
    commemoration:
      'En conmemoración del CCCXLV aniversario de la fundación de la Facultad de Derecho',
    organizer: 'Facultad de Derecho, Ciencias Políticas y Sociales',
    location: 'Salón de Honor de la Facultad de Derecho, Ciencias Políticas y Sociales',
    modality: 'PRESENCIAL',
    status: 'FINALIZADO',
    isFree: true,
    minAttendancePercent: 80,
    contactWhatsapp: '70314297',
  };
  const createdE1 = await apiPost('/api/v1/events', e1Payload);
  console.log(`Evento E1 creado: ID ${createdE1.id}`);
  logEntries.push({
    type: 'EVENT',
    id: createdE1.id,
    name: e1Payload.title,
    slug: e1Payload.slug,
    createdAt: new Date().toISOString(),
  });

  await apiPost('/api/v1/sessions', {
    eventId: createdE1.id,
    label: 'Conferencia Magistral',
    location: 'Salón de Honor, Facultad de Derecho',
    startsAt: '2026-10-16T11:00:00-04:00',
    endsAt: '2026-10-16T12:30:00-04:00',
  });
  await apiPost(`/api/v1/events/${createdE1.id}/speakers`, {
    fullName: 'Marco Antonio Barroso Mendizábal',
    role: 'EXPOSITOR',
    titleProfession:
      'Abogado, Diplomático de Carrera del Ministerio de Relaciones Exteriores y docente universitario',
  });

  // E2
  const e2Payload = {
    title:
      'Análisis del proyecto de ley de protección jurídica contra las denuncias o acusaciones falsas y la instrumentalización de la justicia',
    slug: 'analisis-proyecto-ley-denuncias-falsas-2026',
    eventKind: 'Conversatorio',
    institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
    commemoration:
      'En conmemoración del CCCXLV aniversario de la fundación de la Facultad de Derecho',
    organizer:
      'Facultad de Derecho, Ciencias Políticas y Sociales · Carrera de Derecho · Promociones 2026 · Cursos 5-3, 5-4 y 5-5',
    audienceNote: 'Dirigido a Promociones 2026 · Cursos 5-3, 5-4 y 5-5',
    location: 'Salón de Honor de la Facultad de Derecho, Ciencias Políticas y Sociales',
    modality: 'PRESENCIAL',
    status: 'FINALIZADO',
    isFree: true,
    minAttendancePercent: 80,
    contactWhatsapp: '67635450',
  };
  const createdE2 = await apiPost('/api/v1/events', e2Payload);
  console.log(`Evento E2 creado: ID ${createdE2.id}`);
  logEntries.push({
    type: 'EVENT',
    id: createdE2.id,
    name: e2Payload.title,
    slug: e2Payload.slug,
    createdAt: new Date().toISOString(),
  });

  await apiPost('/api/v1/sessions', {
    eventId: createdE2.id,
    label: 'Conversatorio Jurídico',
    location: 'Salón de Honor, Facultad de Derecho',
    startsAt: '2026-10-12T18:00:00-04:00',
    endsAt: '2026-10-12T20:00:00-04:00',
  });
  await apiPost(`/api/v1/events/${createdE2.id}/speakers`, {
    fullName: 'Dr. César Suárez Saavedra',
    role: 'EXPOSITOR',
    titleProfession: 'Abogado y docente',
  });
  await apiPost(`/api/v1/events/${createdE2.id}/speakers`, {
    fullName: 'Dr. Wilder Manuel Castillo Subirana',
    role: 'EXPOSITOR',
    titleProfession: 'Abogado y docente',
  });
  await apiPost(`/api/v1/events/${createdE2.id}/speakers`, {
    fullName: 'Dr. Marco Antonio Barroso Mendizábal',
    role: 'MODERADOR',
    titleProfession: 'Abogado, diplomático del Ministerio de Relaciones Exteriores y docente',
  });

  // E3
  const e3Payload = {
    title: 'El Estado de Derecho y Justicia Penal en Bolivia',
    slug: 'estado-derecho-justicia-penal-bolivia-2026',
    eventKind: 'Seminario',
    institution: 'Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca',
    commemoration: 'CCCXLV años de fundación de la Facultad de Derecho',
    organizer:
      'Sociedad Científica de Estudiantes de Derecho (SCED) · Carrera de Derecho · Facultad de Derecho, Cs. Políticas y Sociales',
    location: 'Salón de Honor de la Facultad de Derecho, Ciencias Políticas y Sociales',
    modality: 'PRESENCIAL',
    status: 'FINALIZADO',
    isFree: false,
    cost: 20,
    minAttendancePercent: 80,
    contactWhatsapp: 'Pago en efectivo, al lado de Dirección de Carrera de Derecho',
  };
  const createdE3 = await apiPost('/api/v1/events', e3Payload);
  console.log(`Evento E3 creado: ID ${createdE3.id}`);
  logEntries.push({
    type: 'EVENT',
    id: createdE3.id,
    name: e3Payload.title,
    slug: e3Payload.slug,
    createdAt: new Date().toISOString(),
  });

  await apiPost('/api/v1/sessions', {
    eventId: createdE3.id,
    label: 'Jornada Académica Penal',
    location: 'Salón de Honor, Facultad de Derecho',
    startsAt: '2026-10-13T18:00:00-04:00',
    endsAt: '2026-10-13T20:00:00-04:00',
  });
  await apiPost(`/api/v1/events/${createdE3.id}/speakers`, {
    fullName: 'Dr. Mario Gonzáles Durán',
    role: 'EXPOSITOR',
    titleProfession: 'Abogado, docente universitario y jurista',
  });
  await apiPost(`/api/v1/events/${createdE3.id}/speakers`, {
    fullName: 'Dr. Carlos Eduardo Ortega Sivila',
    role: 'EXPOSITOR',
    titleProfession: 'Abogado, Magistrado del Tribunal Supremo de Justicia y docente universitario',
  });
  await apiPost(`/api/v1/events/${createdE3.id}/speakers`, {
    fullName: 'Dr. Jaime René Conde Andrade',
    role: 'EXPOSITOR',
    titleProfession: 'Abogado y docente universitario',
  });
  await apiPost(`/api/v1/events/${createdE3.id}/speakers`, {
    fullName: 'Periodista Delfin Ustarez',
    role: 'MODERADOR',
    titleProfession: 'Periodista',
  });

  // Guardar log si fue confirmación real
  if (isConfirm) {
    const log: LoadLog = {
      targetApi: apiUrl,
      executedAt: new Date().toISOString(),
      entries: logEntries,
    };
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf8');
    console.log(
      `\nLog de carga guardado en ${LOG_FILE} (${logEntries.length} entidades registradas).`
    );
  } else {
    console.log(
      `\n[SIMULACIÓN COMPLETADA] Se registrarían ${logEntries.length} entidades en producción.`
    );
    console.log('Para ejecutar la carga real, agregue el flag --confirm-production.');
  }
}

main().catch((err) => {
  console.error('Error fatal durante la carga:', err);
  process.exit(1);
});
