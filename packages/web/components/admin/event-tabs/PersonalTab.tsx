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
  commission?: string | null;
  isOrganizerRecipient?: boolean;
  recipientId?: string | null;
  user: StaffUser;
  assigner?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export function PersonalTab({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'create' | 'select'>('create');

  // Form states for Create New Personal
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCommission, setNewCommission] = useState('');
  const [newRegisterAsOrganizer, setNewRegisterAsOrganizer] = useState(true);
  const [newLevel, setNewLevel] = useState<'OPERATOR' | 'MANAGER'>('OPERATOR');

  // Form states for Select Existing Staff
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectCommission, setSelectCommission] = useState('');
  const [selectRegisterAsOrganizer, setSelectRegisterAsOrganizer] = useState(false);
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
    enabled: isModalOpen && modalTab === 'select',
  });

  const assignments = data?.data ?? [];
  const assignedUserIds = new Set(assignments.map((a) => a.userId));
  const availableStaff = (usersQuery.data?.data ?? []).filter(
    (u) => u.active && !assignedUserIds.has(u.id)
  );

  function resetForm() {
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewCommission('');
    setNewRegisterAsOrganizer(true);
    setNewLevel('OPERATOR');

    setSelectedUserId('');
    setSelectCommission('');
    setSelectRegisterAsOrganizer(false);
    setSelectedLevel('OPERATOR');
    setIsModalOpen(false);
  }

  async function handleCreateAndAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      toast.error('Complete el nombre completo y el correo electrónico');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/events/${eventId}/staff/create-and-assign`, {
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword.trim() || undefined,
        accessLevel: newLevel,
        commission: newCommission.trim() || undefined,
        registerAsOrganizer: newRegisterAsOrganizer,
      });
      await queryClient.invalidateQueries({ queryKey: ['event-staff', eventId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(
        newRegisterAsOrganizer
          ? 'Personal creado, asignado y registrado para diploma de organizador'
          : 'Personal creado y asignado con éxito'
      );
      resetForm();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignExisting(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Seleccione un usuario de la lista');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/events/${eventId}/staff`, {
        userId: selectedUserId,
        accessLevel: selectedLevel,
        commission: selectCommission.trim() || undefined,
        registerAsOrganizer: selectRegisterAsOrganizer,
      });
      await queryClient.invalidateQueries({ queryKey: ['event-staff', eventId] });
      toast.success('Personal asignado correctamente');
      resetForm();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateLevel(userId: string, targetLevel: 'OPERATOR' | 'MANAGER') {
    try {
      await api.patch(`/events/${eventId}/staff/${userId}`, {
        accessLevel: targetLevel,
      });
      await queryClient.invalidateQueries({ queryKey: ['event-staff', eventId] });
      toast.success(`Nivel de acceso actualizado a ${targetLevel}`);
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
      <div className="rounded-[var(--radius-md)] border border-line bg-surface p-6 shadow-soft">
        <p className="text-sm text-muted">Cargando personal asignado…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-bg p-6 text-sm text-danger space-y-2">
        <p className="font-semibold">Error al cargar personal: {apiErrorMessage(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarjeta de Encabezado y Acción */}
      <div className="rounded-[var(--radius-md)] border border-line bg-surface p-6 shadow-soft flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Personal y Comisiones de Trabajo</h3>
          <p className="mt-1 text-sm text-muted">
            Cree y asigne operadores para escaneo de credenciales, o gestores de comisiones (Acreditación,
            Logística, Protocolo). Puede otorgarles simultáneamente reconocimiento oficial como Organizadores.
          </p>
        </div>
        <Button
          variant="primario"
          onClick={() => {
            setModalTab('create');
            setIsModalOpen(true);
          }}
        >
          + Crear o Asignar Personal
        </Button>
      </div>

      {/* Lista de Personal Asignado */}
      {assignments.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-line bg-surface p-8 text-center text-muted">
          <p className="font-medium text-ink">Este evento aún no tiene personal asignado</p>
          <p className="mt-1 text-sm">
            Cree personal para las comisiones o asigne operadores para el control de ingreso.
          </p>
          <div className="mt-4">
            <Button
              variant="secundario"
              onClick={() => {
                setModalTab('create');
                setIsModalOpen(true);
              }}
            >
              Crear primer personal
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface shadow-soft">
          <table className="w-full text-left text-sm text-ink border-collapse">
            <thead className="bg-canvas/60 border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="py-3 px-4 font-semibold">Usuario / Personal</th>
                <th scope="col" className="py-3 px-4 font-semibold">Correo Institucional</th>
                <th scope="col" className="py-3 px-4 font-semibold">Comisión</th>
                <th scope="col" className="py-3 px-4 font-semibold">Reconocimiento</th>
                <th scope="col" className="py-3 px-4 font-semibold">Nivel de Acceso</th>
                <th scope="col" className="py-3 px-4 font-semibold">Asignado el</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {assignments.map((item) => (
                <tr key={item.id} className="hover:bg-canvas/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-ink">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-navy/10 text-navy flex items-center justify-center font-bold text-xs uppercase shrink-0">
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
                    {item.commission ? (
                      <Badge tono="neutro">{item.commission}</Badge>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {item.isOrganizerRecipient ? (
                      <Badge tono="ok">Diploma Asignado</Badge>
                    ) : (
                      <span className="text-muted text-xs">Sin diploma</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Badge tono={item.accessLevel === 'MANAGER' ? 'aviso' : 'neutro'}>
                        {item.accessLevel === 'MANAGER' ? 'Manager (Gestor)' : 'Operador (Sala)'}
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
                        <option value="OPERATOR">Operador</option>
                        <option value="MANAGER">Manager</option>
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

      {/* Modal: Crear o Asignar Personal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gestión de Personal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 backdrop-blur-xs p-4"
          onClick={() => resetForm()}
        >
          <div
            className="w-full max-w-lg rounded-[var(--radius-md)] border border-line bg-surface p-6 shadow-soft max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
              <div>
                <h3 className="text-lg font-bold text-ink">Personal y Comisiones del Evento</h3>
                <p className="text-xs text-muted mt-0.5">
                  Registre personal nuevo o asigne usuarios existentes con comisiones y diplomas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => resetForm()}
                className="text-muted hover:text-ink text-lg leading-none"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {/* Selector de Pestaña: Crear vs Seleccionar */}
            <div className="mt-4 flex border-b border-line">
              <button
                type="button"
                onClick={() => setModalTab('create')}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  modalTab === 'create'
                    ? 'border-navy text-navy font-semibold'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                + Crear nuevo personal
              </button>
              <button
                type="button"
                onClick={() => setModalTab('select')}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  modalTab === 'select'
                    ? 'border-navy text-navy font-semibold'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                Asignar usuario existente
              </button>
            </div>

            {modalTab === 'create' ? (
              <form onSubmit={(e) => void handleCreateAndAssign(e)} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Lic. Fernando Gorena Belling"
                    className="w-full h-11 px-3 bg-canvas border border-line rounded-[var(--radius-md)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="correo@usfx.bo"
                    className="w-full h-11 px-3 bg-canvas border border-line rounded-[var(--radius-md)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Contraseña de Acceso (Opcional)
                  </label>
                  <input
                    type="password"
                    placeholder="Auto-generada si se deja en blanco"
                    className="w-full h-11 px-3 bg-canvas border border-line rounded-[var(--radius-md)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <span className="text-[11px] text-muted block mt-1">
                    El usuario tendrá rol STAFF para operar este evento.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Comisión de Trabajo (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Comisión de Acreditación, Comisión de Logística"
                    className="w-full h-11 px-3 bg-canvas border border-line rounded-[var(--radius-md)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                    value={newCommission}
                    onChange={(e) => setNewCommission(e.target.value)}
                  />
                </div>

                {/* Reconocimiento como Organizador / Diploma */}
                <div className="rounded-[var(--radius-md)] border border-line bg-canvas/40 p-3 space-y-1">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRegisterAsOrganizer}
                      onChange={(e) => setNewRegisterAsOrganizer(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-line text-navy focus:ring-navy"
                    />
                    <div>
                      <span className="text-sm font-semibold text-ink">
                        Otorgar reconocimiento como Organizador
                      </span>
                      <p className="text-xs text-muted leading-relaxed">
                        Habilita la emisión automática de su Certificado / Diploma oficial de Organizador o Comité
                        Académico con su comisión.
                      </p>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Nivel de Permisos en el Evento
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 border border-line rounded-[var(--radius-md)] bg-canvas/40 cursor-pointer hover:bg-canvas">
                      <input
                        type="radio"
                        name="newAccessLevel"
                        value="OPERATOR"
                        checked={newLevel === 'OPERATOR'}
                        onChange={() => setNewLevel('OPERATOR')}
                        className="mt-0.5 text-navy focus:ring-navy"
                      />
                      <div>
                        <span className="block text-sm font-semibold text-ink">
                          Operador (Escáner y Asistencia)
                        </span>
                        <span className="block text-xs text-muted">
                          Acceso para escanear credenciales QR, búsqueda de CI y registro de asistentes en sala.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border border-line rounded-[var(--radius-md)] bg-canvas/40 cursor-pointer hover:bg-canvas">
                      <input
                        type="radio"
                        name="newAccessLevel"
                        value="MANAGER"
                        checked={newLevel === 'MANAGER'}
                        onChange={() => setNewLevel('MANAGER')}
                        className="mt-0.5 text-navy focus:ring-navy"
                      />
                      <div>
                        <span className="block text-sm font-semibold text-ink">
                          Manager (Coordinador de Comisión)
                        </span>
                        <span className="block text-xs text-muted">
                          Gestión completa del evento, edición de sesiones, expositores, personal y emisión de certificados.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-line">
                  <Button variant="secundario" type="button" onClick={() => resetForm()}>
                    Cancelar
                  </Button>
                  <Button variant="primario" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando…' : 'Crear y Asignar Personal'}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={(e) => void handleAssignExisting(e)} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Usuario STAFF Existente
                  </label>
                  {usersQuery.isLoading ? (
                    <p className="text-sm text-muted">Cargando usuarios…</p>
                  ) : availableStaff.length === 0 ? (
                    <p className="text-sm text-muted italic">
                      No hay otros usuarios STAFF disponibles sin asignar. Utilice la pestaña &quot;Crear nuevo personal&quot;.
                    </p>
                  ) : (
                    <select
                      className="w-full h-11 px-3 bg-canvas border border-line rounded-[var(--radius-md)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      <option value="">-- Seleccionar Usuario --</option>
                      {availableStaff.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email}) · {u.role}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Comisión de Trabajo (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Comisión de Acreditación"
                    className="w-full h-11 px-3 bg-canvas border border-line rounded-[var(--radius-md)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                    value={selectCommission}
                    onChange={(e) => setSelectCommission(e.target.value)}
                  />
                </div>

                {/* Reconocimiento como Organizador / Diploma */}
                <div className="rounded-[var(--radius-md)] border border-line bg-canvas/40 p-3 space-y-1">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectRegisterAsOrganizer}
                      onChange={(e) => setSelectRegisterAsOrganizer(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-line text-navy focus:ring-navy"
                    />
                    <div>
                      <span className="text-sm font-semibold text-ink">
                        Otorgar reconocimiento como Organizador
                      </span>
                      <p className="text-xs text-muted leading-relaxed">
                        Registrar para emisión de Certificado / Diploma de Organizador del evento.
                      </p>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Nivel de Permisos en el Evento
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 border border-line rounded-[var(--radius-md)] bg-canvas/40 cursor-pointer hover:bg-canvas">
                      <input
                        type="radio"
                        name="selectAccessLevel"
                        value="OPERATOR"
                        checked={selectedLevel === 'OPERATOR'}
                        onChange={() => setSelectedLevel('OPERATOR')}
                        className="mt-0.5 text-navy focus:ring-navy"
                      />
                      <div>
                        <span className="block text-sm font-semibold text-ink">
                          Operador (Escáner y Asistencia)
                        </span>
                        <span className="block text-xs text-muted">
                          Acceso a control de asistencia y escaneo de credenciales en sala.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border border-line rounded-[var(--radius-md)] bg-canvas/40 cursor-pointer hover:bg-canvas">
                      <input
                        type="radio"
                        name="selectAccessLevel"
                        value="MANAGER"
                        checked={selectedLevel === 'MANAGER'}
                        onChange={() => setSelectedLevel('MANAGER')}
                        className="mt-0.5 text-navy focus:ring-navy"
                      />
                      <div>
                        <span className="block text-sm font-semibold text-ink">
                          Manager (Coordinador de Comisión)
                        </span>
                        <span className="block text-xs text-muted">
                          Gestión completa del evento, sesiones, expositores y emisión de certificados.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-line">
                  <Button variant="secundario" type="button" onClick={() => resetForm()}>
                    Cancelar
                  </Button>
                  <Button
                    variant="primario"
                    type="submit"
                    disabled={!selectedUserId || isSubmitting}
                  >
                    {isSubmitting ? 'Asignando…' : 'Asignar Personal'}
                  </Button>
                </div>
              </form>
            )}
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
