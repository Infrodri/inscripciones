'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatFecha } from '@/lib/format';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
  active: boolean;
}

interface StaffAssignment {
  id: string;
  eventId: string;
  userId: string;
  accessLevel: 'OPERATOR' | 'MANAGER';
  assignedBy: string | null;
  createdAt: string;
  user: StaffUser;
  assigner?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export function PersonalTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'OPERATOR' | 'MANAGER'>('OPERATOR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffAssignment | null>(null);

  // 1. Obtener personal asignado a este evento
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['event-staff', eventId],
    queryFn: async (): Promise<{ data: StaffAssignment[] }> =>
      (await api.get(`/events/${eventId}/staff`)).data,
  });

  // 2. Obtener lista de todos los usuarios para el selector
  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<{ data: StaffUser[] }> => (await api.get('/users')).data,
    enabled: isAssignModalOpen,
  });

  const assignments = data?.data ?? [];
  const assignedUserIds = new Set(assignments.map((a) => a.userId));
  const availableStaff = (usersQuery.data?.data ?? []).filter(
    (u) => u.role === 'STAFF' && u.active && !assignedUserIds.has(u.id)
  );

  async function handleAssign() {
    if (!selectedUserId) {
      toast.error('Seleccione un usuario de la lista');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/events/${eventId}/staff`, {
        userId: selectedUserId,
        accessLevel: selectedLevel,
      });
      await queryClient.invalidateQueries({ queryKey: ['event-staff', eventId] });
      toast.success('Personal asignado correctamente');
      setIsAssignModalOpen(false);
      setSelectedUserId('');
      setSelectedLevel('OPERATOR');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateLevel(userId: string, newLevel: 'OPERATOR' | 'MANAGER') {
    try {
      await api.patch(`/events/${eventId}/staff/${userId}`, {
        accessLevel: newLevel,
      });
      await queryClient.invalidateQueries({ queryKey: ['event-staff', eventId] });
      toast.success(`Nivel de acceso actualizado a ${newLevel}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/events/${eventId}/staff/${deleteTarget.userId}`);
      await queryClient.invalidateQueries({ queryKey: ['event-staff', eventId] });
      toast.success(`Acceso removido para ${deleteTarget.user.name}`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <p className="text-sm text-muted">Cargando personal asignado…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-sm text-danger">
        Error al cargar personal: {apiErrorMessage(error)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarjeta de Encabezado y Acción */}
      <div className="rounded-xl border border-line bg-surface p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Personal Asignado (Staff)</h3>
          <p className="mt-1 text-sm text-muted">
            Delegue el evento a operadores de sala o administradores auxiliares. Los operadores
            pueden escanear QR y registrar walk-ins; los managers pueden editar datos y emitir
            certificados.
          </p>
        </div>
        <Button variant="primario" onClick={() => setIsAssignModalOpen(true)}>
          + Asignar personal
        </Button>
      </div>

      {/* Lista de Personal Asignado */}
      {assignments.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
          <p className="font-medium text-ink">Este evento aún no tiene personal asignado</p>
          <p className="mt-1 text-sm">
            Solo el Administrador y el creador del evento tienen acceso actualmente.
          </p>
          <div className="mt-4">
            <Button variant="secundario" onClick={() => setIsAssignModalOpen(true)}>
              Asignar primer staff
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
          <table className="w-full text-left text-sm text-ink border-collapse">
            <thead className="bg-canvas/60 border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-3 px-4 font-medium">Usuario / Staff</th>
                <th className="py-3 px-4 font-medium">Correo Institucional</th>
                <th className="py-3 px-4 font-medium">Nivel de Acceso</th>
                <th className="py-3 px-4 font-medium">Asignado el</th>
                <th className="py-3 px-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {assignments.map((item) => (
                <tr key={item.id} className="hover:bg-canvas/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-ink">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-navy/10 text-navy flex items-center justify-center font-bold text-xs uppercase">
                        {item.user.name.slice(0, 2)}
                      </div>
                      <div>
                        <span>{item.user.name}</span>
                        {!item.user.active && (
                          <span className="ml-2 text-xs text-danger font-normal">(Inactivo)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted">{item.user.email}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Badge tono={item.accessLevel === 'MANAGER' ? 'ABIERTO' : 'BORRADOR'}>
                        {item.accessLevel === 'MANAGER' ? 'Manager (Gestor)' : 'Operador (Escáner)'}
                      </Badge>
                      <select
                        aria-label={`Cambiar rol de ${item.user.name}`}
                        className="text-xs bg-canvas border border-line rounded px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-navy"
                        value={item.accessLevel}
                        onChange={(e) =>
                          void handleUpdateLevel(
                            item.userId,
                            e.target.value as 'OPERATOR' | 'MANAGER'
                          )
                        }
                      >
                        <option value="OPERATOR">Cambiar a Operador</option>
                        <option value="MANAGER">Cambiar a Manager</option>
                      </select>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted text-xs">{formatFecha(item.createdAt)}</td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="peligro" size="sm" onClick={() => setDeleteTarget(item)}>
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Asignación de Personal */}
      {isAssignModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-bold text-ink">Asignar Personal al Evento</h3>
            <p className="mt-1 text-sm text-muted">
              Seleccione un usuario activo del sistema y defina su rol en este evento.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Usuario STAFF
                </label>
                {usersQuery.isLoading ? (
                  <p className="text-sm text-muted">Cargando usuarios…</p>
                ) : availableStaff.length === 0 ? (
                  <p className="text-sm text-muted italic">
                    No hay otros usuarios de rol STAFF disponibles para asignar. Cree nuevos
                    usuarios en el panel de Usuarios.
                  </p>
                ) : (
                  <select
                    className="w-full h-11 px-3 bg-canvas border border-line rounded-lg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    <option value="">-- Seleccionar Staff --</option>
                    {availableStaff.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Nivel de Acceso
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 border border-line rounded-lg bg-canvas/40 cursor-pointer hover:bg-canvas">
                    <input
                      type="radio"
                      name="accessLevel"
                      value="OPERATOR"
                      checked={selectedLevel === 'OPERATOR'}
                      onChange={() => setSelectedLevel('OPERATOR')}
                      className="mt-0.5 text-navy focus:ring-navy"
                    />
                    <div>
                      <span className="block text-sm font-semibold text-ink">
                        Operador (Recomendado para sala)
                      </span>
                      <span className="block text-xs text-muted">
                        Acceso a escaneo de QR, búsqueda de CI, walk-in y vista del evento. No puede
                        editar ni exportar certificados.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-line rounded-lg bg-canvas/40 cursor-pointer hover:bg-canvas">
                    <input
                      type="radio"
                      name="accessLevel"
                      value="MANAGER"
                      checked={selectedLevel === 'MANAGER'}
                      onChange={() => setSelectedLevel('MANAGER')}
                      className="mt-0.5 text-navy focus:ring-navy"
                    />
                    <div>
                      <span className="block text-sm font-semibold text-ink">
                        Manager (Gestor completo)
                      </span>
                      <span className="block text-xs text-muted">
                        Capacidad de editar evento, sesiones, plantillas, destinatarios y exportar
                        certificados y credenciales.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="secundario"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setSelectedUserId('');
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="primario"
                disabled={!selectedUserId || isSubmitting}
                onClick={() => void handleAssign()}
              >
                {isSubmitting ? 'Asignando…' : 'Confirmar asignación'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de Desasignación (Única instancia condicional a nivel raíz) */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          titulo="Remover Acceso de Personal"
          mensaje={
            <span>
              ¿Está seguro de que desea remover el acceso de{' '}
              <strong>{deleteTarget.user.name}</strong> ({deleteTarget.user.email}) a este evento?
              El usuario ya no podrá visualizarlo ni operarlo.
            </span>
          }
          confirmar="Remover acceso"
          onConfirmar={() => void handleConfirmDelete()}
          onCerrar={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
