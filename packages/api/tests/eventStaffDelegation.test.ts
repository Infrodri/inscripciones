import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/api/app.js';
import { parseEnv } from '../src/api/env.js';
import { getPrisma } from '../src/infrastructure/prisma.js';
import { hashPassword } from '../src/infrastructure/passwordHasher.js';

const stamp = Date.now();
let baseUrl = '';
let server: Server | null = null;
const env = parseEnv(process.env);

// 5 Test Personas
let adminId = '';
let ownerStaffId = '';
let managerStaffId = '';
let operatorStaffId = '';
let unrelatedStaffId = '';

let adminToken = '';
let ownerToken = '';
let managerToken = '';
let operatorToken = '';
let unrelatedToken = '';

let adminEventId = '';
let staffOwnerEventId = '';
let sessionId = '';

async function api(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

describe('Matriz de Permisos: Delegación de Eventos a STAFF (EventStaff)', () => {
  beforeAll(async () => {
    const app = buildApp(env);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const prisma = getPrisma();

    // 1. Crear usuarios
    const adminUser = await prisma.user.create({
      data: {
        email: `del-admin-${stamp}@test.com`,
        passwordHash: await hashPassword('Admin1234!'),
        name: 'Admin User',
        role: 'ADMIN',
      },
    });
    adminId = adminUser.id;
    adminToken = jwt.sign(
      { sub: adminUser.id, role: 'ADMIN', email: adminUser.email },
      env.JWT_SECRET
    );

    const ownerUser = await prisma.user.create({
      data: {
        email: `del-owner-${stamp}@test.com`,
        passwordHash: await hashPassword('Staff1234!'),
        name: 'Owner Staff',
        role: 'STAFF',
      },
    });
    ownerStaffId = ownerUser.id;
    ownerToken = jwt.sign(
      { sub: ownerUser.id, role: 'STAFF', email: ownerUser.email },
      env.JWT_SECRET
    );

    const managerUser = await prisma.user.create({
      data: {
        email: `del-mgr-${stamp}@test.com`,
        passwordHash: await hashPassword('Staff1234!'),
        name: 'Manager Staff',
        role: 'STAFF',
      },
    });
    managerStaffId = managerUser.id;
    managerToken = jwt.sign(
      { sub: managerUser.id, role: 'STAFF', email: managerUser.email },
      env.JWT_SECRET
    );

    const operatorUser = await prisma.user.create({
      data: {
        email: `del-op-${stamp}@test.com`,
        passwordHash: await hashPassword('Staff1234!'),
        name: 'Operator Staff',
        role: 'STAFF',
      },
    });
    operatorStaffId = operatorUser.id;
    operatorToken = jwt.sign(
      { sub: operatorUser.id, role: 'STAFF', email: operatorUser.email },
      env.JWT_SECRET
    );

    const unrelatedUser = await prisma.user.create({
      data: {
        email: `del-unrelated-${stamp}@test.com`,
        passwordHash: await hashPassword('Staff1234!'),
        name: 'Unrelated Staff',
        role: 'STAFF',
      },
    });
    unrelatedStaffId = unrelatedUser.id;
    unrelatedToken = jwt.sign(
      { sub: unrelatedUser.id, role: 'STAFF', email: unrelatedUser.email },
      env.JWT_SECRET
    );

    // 2. Crear Evento de Admin con asignaciones iniciales
    const adminEvent = await prisma.event.create({
      data: {
        slug: `event-admin-${stamp}`,
        title: 'Evento Privado de Admin',
        eventKind: 'Congreso',
        institution: 'Facultad de Derecho',
        organizer: 'USFX',
        location: 'Paraninfo Universitario',
        issuesCertificate: true,
        createdBy: adminId,
        staffAssignments: {
          create: [
            { userId: managerStaffId, accessLevel: 'MANAGER', assignedBy: adminId },
            { userId: operatorStaffId, accessLevel: 'OPERATOR', assignedBy: adminId },
          ],
        },
      },
    });
    adminEventId = adminEvent.id;

    // 3. Crear Evento creado por STAFF (Owner)
    const staffEvent = await prisma.event.create({
      data: {
        slug: `event-staff-owner-${stamp}`,
        title: 'Evento Creado por Staff Owner',
        eventKind: 'Seminario',
        institution: 'Facultad de Derecho',
        organizer: 'Staff Owner',
        location: 'Aula 1',
        issuesCertificate: true,
        createdBy: ownerStaffId,
      },
    });
    staffOwnerEventId = staffEvent.id;

    // 4. Crear sesión en evento de admin
    const session = await prisma.session.create({
      data: {
        eventId: adminEventId,
        label: 'Sesión 1',
        startsAt: new Date(Date.now() - 10 * 60_000),
      },
    });
    sessionId = session.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.event.deleteMany({ where: { slug: { contains: `event-admin-${stamp}` } } });
    await prisma.event.deleteMany({ where: { slug: { contains: `event-staff-owner-${stamp}` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `del-` } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  describe('1. Visibilidad en GET /api/v1/events', () => {
    it('ADMIN ve todos los eventos y su nivel es ADMIN', async () => {
      const res = await api('/api/v1/events', adminToken);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: Array<{ id: string; accessLevel: string }> };
      const ids = json.data.map((e) => e.id);
      expect(ids).toContain(adminEventId);
      expect(ids).toContain(staffOwnerEventId);

      const item = json.data.find((e) => e.id === adminEventId);
      expect(item?.accessLevel).toBe('ADMIN');
    });

    it('STAFF Owner ve su evento como "propio" y con accessLevel OWNER', async () => {
      const res = await api('/api/v1/events', ownerToken);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: Array<{ id: string; ownership: string; accessLevel: string }>;
      };
      const ids = json.data.map((e) => e.id);
      expect(ids).toContain(staffOwnerEventId);
      expect(ids).not.toContain(adminEventId);

      const item = json.data.find((e) => e.id === staffOwnerEventId);
      expect(item?.ownership).toBe('propio');
      expect(item?.accessLevel).toBe('OWNER');
    });

    it('STAFF Assigned MANAGER ve el evento como "asignado" con accessLevel MANAGER', async () => {
      const res = await api('/api/v1/events', managerToken);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: Array<{ id: string; ownership: string; accessLevel: string }>;
      };
      const ids = json.data.map((e) => e.id);
      expect(ids).toContain(adminEventId);
      expect(ids).not.toContain(staffOwnerEventId);

      const item = json.data.find((e) => e.id === adminEventId);
      expect(item?.ownership).toBe('asignado');
      expect(item?.accessLevel).toBe('MANAGER');
    });

    it('STAFF Assigned OPERATOR ve el evento como "asignado" con accessLevel OPERATOR', async () => {
      const res = await api('/api/v1/events', operatorToken);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: Array<{ id: string; ownership: string; accessLevel: string }>;
      };
      const ids = json.data.map((e) => e.id);
      expect(ids).toContain(adminEventId);
      expect(ids).not.toContain(staffOwnerEventId);

      const item = json.data.find((e) => e.id === adminEventId);
      expect(item?.ownership).toBe('asignado');
      expect(item?.accessLevel).toBe('OPERATOR');
    });

    it('STAFF Unrelated NO ve eventos donde no es dueño ni asignado', async () => {
      const res = await api('/api/v1/events', unrelatedToken);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: Array<{ id: string }> };
      const ids = json.data.map((e) => e.id);
      expect(ids).not.toContain(adminEventId);
      expect(ids).not.toContain(staffOwnerEventId);
    });
  });

  describe('2. Detalle y Edición de Eventos', () => {
    it('GET /events/:id permite ADMIN, OWNER, MANAGER, OPERATOR; rechaza UNRELATED', async () => {
      expect((await api(`/api/v1/events/${adminEventId}`, adminToken)).status).toBe(200);
      expect((await api(`/api/v1/events/${staffOwnerEventId}`, ownerToken)).status).toBe(200);
      expect((await api(`/api/v1/events/${adminEventId}`, managerToken)).status).toBe(200);
      expect((await api(`/api/v1/events/${adminEventId}`, operatorToken)).status).toBe(200);
      expect((await api(`/api/v1/events/${adminEventId}`, unrelatedToken)).status).toBe(403);
    });

    it('PATCH /events/:id permite ADMIN, OWNER y MANAGER; rechaza OPERATOR (403) y UNRELATED (403)', async () => {
      // MANAGER puede editar
      const mgrRes = await api(`/api/v1/events/${adminEventId}`, managerToken, {
        method: 'PATCH',
        body: JSON.stringify({ location: 'Paraninfo Actualizado por Manager' }),
      });
      expect(mgrRes.status).toBe(200);

      // OPERATOR NO puede editar
      const opRes = await api(`/api/v1/events/${adminEventId}`, operatorToken, {
        method: 'PATCH',
        body: JSON.stringify({ location: 'Intento de edicion por Operador' }),
      });
      expect(opRes.status).toBe(403);

      // UNRELATED NO puede editar
      const unrelRes = await api(`/api/v1/events/${adminEventId}`, unrelatedToken, {
        method: 'PATCH',
        body: JSON.stringify({ location: 'Intento de edicion por no asignado' }),
      });
      expect(unrelRes.status).toBe(403);
    });
  });

  describe('3. Gestión de Personal (Solo ADMIN)', () => {
    it('GET /events/:id/staff permite ADMIN pero rechaza STAFF (incluso OWNER o MANAGER)', async () => {
      const adminRes = await api(`/api/v1/events/${adminEventId}/staff`, adminToken);
      expect(adminRes.status).toBe(200);
      const json = (await adminRes.json()) as { data: Array<{ userId: string }> };
      expect(json.data.length).toBeGreaterThanOrEqual(2);

      // MANAGER no puede gestionar personal
      expect((await api(`/api/v1/events/${adminEventId}/staff`, managerToken)).status).toBe(403);
      // OWNER no puede gestionar personal
      expect((await api(`/api/v1/events/${staffOwnerEventId}/staff`, ownerToken)).status).toBe(403);
      // OPERATOR no puede gestionar personal
      expect((await api(`/api/v1/events/${adminEventId}/staff`, operatorToken)).status).toBe(403);
    });

    it('ADMIN puede asignar un nuevo STAFF, actualizar su rol y desasignarlo', async () => {
      // Asignar
      const addRes = await api(`/api/v1/events/${adminEventId}/staff`, adminToken, {
        method: 'POST',
        body: JSON.stringify({ userId: unrelatedStaffId, accessLevel: 'OPERATOR' }),
      });
      expect(addRes.status).toBe(201);

      // Ahora unrelatedStaff tiene acceso como OPERATOR
      expect((await api(`/api/v1/events/${adminEventId}`, unrelatedToken)).status).toBe(200);

      // Modificar rol a MANAGER
      const patchRes = await api(
        `/api/v1/events/${adminEventId}/staff/${unrelatedStaffId}`,
        adminToken,
        {
          method: 'PATCH',
          body: JSON.stringify({ accessLevel: 'MANAGER' }),
        }
      );
      expect(patchRes.status).toBe(200);
      const updated = (await patchRes.json()) as { accessLevel: string };
      expect(updated.accessLevel).toBe('MANAGER');

      // Eliminar asignación
      const delRes = await api(
        `/api/v1/events/${adminEventId}/staff/${unrelatedStaffId}`,
        adminToken,
        {
          method: 'DELETE',
        }
      );
      expect(delRes.status).toBe(200);

      // Ya no tiene acceso
      expect((await api(`/api/v1/events/${adminEventId}`, unrelatedToken)).status).toBe(403);
    });
  });

  describe('4. Operación vs Gestión: Sesiones, Participantes y Exportaciones', () => {
    it('GET /sessions/event/:eventId permite OPERATOR pero rechaza UNRELATED', async () => {
      expect((await api(`/api/v1/sessions/event/${adminEventId}`, operatorToken)).status).toBe(200);
      expect((await api(`/api/v1/sessions/event/${adminEventId}`, unrelatedToken)).status).toBe(
        403
      );
    });

    it('POST /sessions permite MANAGER pero rechaza OPERATOR (403)', async () => {
      // OPERATOR rechazado
      const opRes = await api('/api/v1/sessions', operatorToken, {
        method: 'POST',
        body: JSON.stringify({
          eventId: adminEventId,
          startsAt: new Date(Date.now() + 3600_000).toISOString(),
          label: 'Sesión por Operador',
        }),
      });
      expect(opRes.status).toBe(403);

      // MANAGER permitido
      const mgrRes = await api('/api/v1/sessions', managerToken, {
        method: 'POST',
        body: JSON.stringify({
          eventId: adminEventId,
          startsAt: new Date(Date.now() + 7200_000).toISOString(),
          label: 'Sesión por Manager',
        }),
      });
      expect(mgrRes.status).toBe(201);
    });

    it('GET /events/:id/exports/participants permite MANAGER pero rechaza OPERATOR (403)', async () => {
      expect(
        (await api(`/api/v1/events/${adminEventId}/exports/participants`, managerToken)).status
      ).toBe(200);
      expect(
        (await api(`/api/v1/events/${adminEventId}/exports/participants`, operatorToken)).status
      ).toBe(403);
      expect(
        (await api(`/api/v1/events/${adminEventId}/exports/participants`, unrelatedToken)).status
      ).toBe(403);
    });

    it('GET /events/:id/stats permite OPERATOR', async () => {
      expect((await api(`/api/v1/events/${adminEventId}/stats`, operatorToken)).status).toBe(200);
      expect((await api(`/api/v1/events/${adminEventId}/stats`, unrelatedToken)).status).toBe(403);
    });

    it('OPERATOR puede acceder a token y QR de auto-asistencia (proyección)', async () => {
      const tokenRes = await api(`/api/v1/sessions/${sessionId}/self-checkin/token`, operatorToken);
      expect(tokenRes.status).toBe(200);
      const json = (await tokenRes.json()) as { url: string; qrPngUrl: string };
      expect(json.url).toContain('/a/');

      const pngRes = await api(`/api/v1/sessions/${sessionId}/self-checkin/qr.png`, operatorToken);
      expect(pngRes.status).toBe(200);
      expect(pngRes.headers.get('content-type')).toBe('image/png');

      // UNRELATED no puede acceder al token ni QR
      expect(
        (await api(`/api/v1/sessions/${sessionId}/self-checkin/token`, unrelatedToken)).status
      ).toBe(403);
      expect(
        (await api(`/api/v1/sessions/${sessionId}/self-checkin/qr.png`, unrelatedToken)).status
      ).toBe(403);
    });
  });

  describe('5. Limpieza en Cascada al Desactivar o Eliminar Usuario', () => {
    it('Desactivar usuario (active: false) elimina sus asignaciones en event_staff', async () => {
      const prisma = getPrisma();
      // Asignamos de nuevo a unrelatedUser
      await prisma.eventStaff.create({
        data: { eventId: adminEventId, userId: unrelatedStaffId, accessLevel: 'OPERATOR' },
      });
      expect(await prisma.eventStaff.count({ where: { userId: unrelatedStaffId } })).toBe(1);

      // Desactivamos al usuario vía PATCH /users/:id
      const deactRes = await api(`/api/v1/users/${unrelatedStaffId}`, adminToken, {
        method: 'PATCH',
        body: JSON.stringify({ active: false }),
      });
      expect(deactRes.status).toBe(200);

      // Las asignaciones fueron removidas
      expect(await prisma.eventStaff.count({ where: { userId: unrelatedStaffId } })).toBe(0);
    });
  });
});
