import type { PrismaClient } from '@prisma/client';
import { DomainError } from '../domain/errors.js';

export type EventStaffRole = 'ADMIN' | 'OWNER' | 'MANAGER' | 'OPERATOR';

export interface AccessibleEvent {
  id: string;
  createdBy?: string | null;
  staffAssignments?: Array<{
    userId: string;
    accessLevel: 'OPERATOR' | 'MANAGER';
  }>;
}

/**
 * Resolves the effective access level of a user for a given event.
 */
export function getEventUserAccess(
  user: { id: string; role: 'ADMIN' | 'STAFF' } | undefined,
  event: AccessibleEvent
): EventStaffRole | null {
  if (!user) return null;
  if (user.role === 'ADMIN') return 'ADMIN';
  if (event.createdBy === user.id) return 'OWNER';
  const assignment = event.staffAssignments?.find((a) => a.userId === user.id);
  if (assignment) return assignment.accessLevel;
  return null;
}

/**
 * Checks if a user has sufficient privileges to perform an action on an event.
 * - OPERATOR endpoints allow: ADMIN, OWNER, MANAGER, OPERATOR.
 * - MANAGER endpoints allow: ADMIN, OWNER, MANAGER.
 */
export function canAccessEvent(
  user: { id: string; role: 'ADMIN' | 'STAFF' } | undefined,
  event: AccessibleEvent,
  requiredLevel: 'OPERATOR' | 'MANAGER' = 'OPERATOR'
): boolean {
  const access = getEventUserAccess(user, event);
  if (!access) return false;
  if (access === 'ADMIN' || access === 'OWNER') return true;
  if (requiredLevel === 'OPERATOR') return true;
  if (requiredLevel === 'MANAGER') return access === 'MANAGER';
  return false;
}

/**
 * Asserts that a user has access to an event by ID.
 * Throws NOT_FOUND if event does not exist, or FORBIDDEN if user lacks permissions.
 */
export async function assertEventAccess(
  prisma: PrismaClient,
  user: { id: string; role: 'ADMIN' | 'STAFF' } | undefined,
  eventId: string,
  requiredLevel: 'OPERATOR' | 'MANAGER' = 'OPERATOR'
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      staffAssignments: {
        select: { userId: true, accessLevel: true },
      },
      creator: { select: { id: true, role: true } },
    },
  });

  if (!event) {
    throw new DomainError('NOT_FOUND', 'Evento no encontrado');
  }

  if (!canAccessEvent(user, event, requiredLevel)) {
    throw new DomainError(
      'FORBIDDEN',
      requiredLevel === 'MANAGER'
        ? 'No tiene permisos de administración sobre este evento'
        : 'No tiene permiso para acceder a este evento'
    );
  }

  return event;
}

/**
 * Asserts that a user has access to a session by ID.
 * Throws NOT_FOUND if session does not exist, or FORBIDDEN if user lacks permissions on the parent event.
 */
export async function assertSessionAccess(
  prisma: PrismaClient,
  user: { id: string; role: 'ADMIN' | 'STAFF' } | undefined,
  sessionId: string,
  requiredLevel: 'OPERATOR' | 'MANAGER' = 'OPERATOR'
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      event: {
        include: {
          staffAssignments: {
            select: { userId: true, accessLevel: true },
          },
          creator: { select: { id: true, role: true } },
        },
      },
    },
  });

  if (!session) {
    throw new DomainError('NOT_FOUND', 'Sesión no encontrada');
  }

  if (!canAccessEvent(user, session.event, requiredLevel)) {
    throw new DomainError(
      'FORBIDDEN',
      requiredLevel === 'MANAGER'
        ? 'No tiene permisos de administración sobre esta sesión'
        : 'No tiene permiso para acceder a esta sesión'
    );
  }

  return session;
}
