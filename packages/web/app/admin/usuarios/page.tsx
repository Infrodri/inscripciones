'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { api, apiErrorMessage, getSessionUser } from '@/lib/api';
import { formatFecha } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, PageHeader } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF' | string;
  active: boolean;
  createdAt?: string;
}

export default function UsuariosPage() {
  const router = useRouter();
  const sessionUser = getSessionUser();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (sessionUser && sessionUser.role !== 'ADMIN') {
      router.replace('/admin/eventos');
    }
  }, [sessionUser, router]);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Creación de usuario
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'ADMIN' | 'STAFF'>('STAFF');
  const [isCreating, setIsCreating] = useState(false);

  // Edición de usuario / rol y contraseña
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'ADMIN' | 'STAFF'>('STAFF');
  const [editPassword, setEditPassword] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Eliminación de usuario (ConfirmDialog)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  // Manejo de tecla Escape para modales propios
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        if (isCreateOpen) setIsCreateOpen(false);
        if (editTarget) setEditTarget(null);
      }
    }
    if (isCreateOpen || editTarget) {
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }
  }, [isCreateOpen, editTarget]);

  // Consulta de usuarios
  const { data, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<{ data: UserRow[] }> => (await api.get('/users')).data,
  });

  const users = data?.data ?? [];

  // Filtrado de usuarios
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Handler para crear usuario
  async function handleCreateUser(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    try {
      setIsCreating(true);
      await api.post('/users', {
        email: createEmail,
        password: createPassword,
        name: createName,
        role: createRole,
      });
      setCreateEmail('');
      setCreatePassword('');
      setCreateName('');
      setCreateRole('STAFF');
      setIsCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario creado con éxito');
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) {
        toast.error(apiErrorMessage(error));
      }
    } finally {
      setIsCreating(false);
    }
  }

  // Handler para abrir edición
  function handleOpenEdit(user: UserRow): void {
    setEditTarget(user);
    setEditName(user.name);
    setEditRole(user.role === 'ADMIN' ? 'ADMIN' : 'STAFF');
    setEditPassword('');
  }

  // Handler para guardar cambios de edición
  async function handleEditUser(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!editTarget) return;
    try {
      setIsEditing(true);
      const payload: Record<string, unknown> = {
        name: editName,
        role: editRole,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      await api.patch(`/users/${editTarget.id}`, payload);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario actualizado con éxito');
      setEditTarget(null);
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) {
        toast.error(apiErrorMessage(error));
      }
    } finally {
      setIsEditing(false);
    }
  }

  // Handler para eliminación
  async function handleDeleteUser(): Promise<void> {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Usuario ${deleteTarget.name} eliminado`);
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) {
        toast.error(apiErrorMessage(error));
      }
    } finally {
      setDeleteTarget(null);
    }
  }

  if (sessionUser && sessionUser.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Navegación y encabezado */}
      <PageHeader
        titulo="Usuarios"
        migas={[{ etiqueta: 'Administración' }, { etiqueta: 'Usuarios' }]}
        volverA="/admin/eventos"
        accion={
          <Button
            variant="primario"
            onClick={() => {
              setCreateName('');
              setCreateEmail('');
              setCreatePassword('');
              setCreateRole('STAFF');
              setIsCreateOpen(true);
            }}
          >
            + Nuevo usuario
          </Button>
        }
      />

      {/* Card de búsqueda y filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              id="filtro-busqueda"
              etiqueta="Buscar"
              placeholder="Buscar por nombre o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <Input
              id="filtro-rol"
              etiqueta="Rol"
              desplegable
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">Todos los roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="STAFF">STAFF</option>
            </Input>
          </div>
        </div>
      </Card>

      {/* Estados de carga y error */}
      {isLoading ? (
        <div className="rounded-[var(--radius-md)] border border-line bg-surface p-8 text-center text-muted">
          <p>Cargando usuarios…</p>
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-bg p-4 text-danger">
          <p className="font-medium">No se pudieron cargar los usuarios.</p>
        </div>
      ) : null}

      {/* Lista de usuarios */}
      {!isLoading && !isError ? (
        filteredUsers.length === 0 ? (
          <EmptyState
            mensaje={
              users.length === 0
                ? 'No hay usuarios registrados.'
                : 'No se encontraron usuarios con los filtros aplicados.'
            }
            accion={
              users.length === 0 ? (
                <Button variant="primario" onClick={() => setIsCreateOpen(true)}>
                  + Nuevo usuario
                </Button>
              ) : (
                <Button
                  variant="secundario"
                  onClick={() => {
                    setSearchQuery('');
                    setRoleFilter('');
                  }}
                >
                  Limpiar filtros
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Tabla para escritorio (md:block) */}
            <div className="hidden md:block overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas/60 border-b border-line">
                  <tr className="h-10 text-xs uppercase tracking-wider text-muted">
                    <th scope="col" className="px-4 font-semibold">
                      Usuario
                    </th>
                    <th scope="col" className="px-4 font-semibold">
                      Correo
                    </th>
                    <th scope="col" className="px-4 font-semibold">
                      Rol
                    </th>
                    <th scope="col" className="px-4 font-semibold">
                      Fecha de creación
                    </th>
                    <th scope="col" className="px-4 font-semibold text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="h-14 hover:bg-canvas/40 transition-colors">
                      <td className="px-4 font-medium text-ink">{u.name}</td>
                      <td className="px-4 text-muted">{u.email}</td>
                      <td className="px-4">
                        <Badge tono={u.role === 'ADMIN' ? 'aviso' : 'ok'}>{u.role}</Badge>
                      </td>
                      <td className="px-4 text-muted text-xs">
                        {u.createdAt ? formatFecha(u.createdAt) : '—'}
                      </td>
                      <td className="px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secundario"
                            size="sm"
                            onClick={() => handleOpenEdit(u)}
                          >
                            Editar / Cambiar rol
                          </Button>
                          <Button
                            variant="peligro"
                            size="sm"
                            onClick={() => setDeleteTarget(u)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarjetas apiladas para móvil (md:hidden) */}
            <div className="space-y-3 md:hidden">
              {filteredUsers.map((u) => (
                <Card key={u.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink truncate">{u.name}</p>
                      <p className="text-sm text-muted truncate">{u.email}</p>
                    </div>
                    <Badge tono={u.role === 'ADMIN' ? 'aviso' : 'ok'}>{u.role}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    Registrado: {u.createdAt ? formatFecha(u.createdAt) : '—'}
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                    <Button
                      variant="secundario"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleOpenEdit(u)}
                    >
                      Editar / Cambiar rol
                    </Button>
                    <Button
                      variant="peligro"
                      size="sm"
                      onClick={() => setDeleteTarget(u)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )
      ) : null}

      {/* Diálogo modal: Crear nuevo usuario */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Nuevo usuario"
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 backdrop-blur-xs p-4"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-[var(--radius-md)] border border-line bg-surface p-6 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
              <h2 className="font-serif text-xl font-bold text-navy">Nuevo usuario</h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                aria-label="Cerrar diálogo"
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-canvas hover:text-ink transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={(e) => void handleCreateUser(e)} className="mt-4 space-y-4">
              <Input
                id="create-nombre"
                etiqueta="Nombre completo"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
                placeholder="Ej: Juan Pérez"
              />
              <Input
                id="create-correo"
                etiqueta="Correo electrónico"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
                placeholder="usuario@ejemplo.com"
              />
              <Input
                id="create-clave"
                etiqueta="Contraseña"
                opcional="(mínimo 8 caracteres)"
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
                minLength={8}
              />
              <Input
                id="create-rol"
                etiqueta="Rol del usuario"
                desplegable
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as 'ADMIN' | 'STAFF')}
              >
                <option value="STAFF">STAFF (Operador de eventos y escáner)</option>
                <option value="ADMIN">ADMIN (Acceso total al sistema)</option>
              </Input>
              <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
                <Button
                  variant="secundario"
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancelar
                </Button>
                <Button variant="primario" type="submit" cargando={isCreating}>
                  Crear usuario
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diálogo modal: Editar usuario / cambiar rol / contraseña */}
      {editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Editar usuario"
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 backdrop-blur-xs p-4"
          onClick={() => setEditTarget(null)}
        >
          <div
            className="w-full max-w-lg rounded-[var(--radius-md)] border border-line bg-surface p-6 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
              <h2 className="font-serif text-xl font-bold text-navy">Editar usuario / Cambiar contraseña</h2>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                aria-label="Cerrar diálogo"
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-canvas hover:text-ink transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={(e) => void handleEditUser(e)} className="mt-4 space-y-4">
              <div>
                <span className="block text-sm font-medium text-ink">Correo electrónico</span>
                <p className="mt-1 text-sm text-muted">{editTarget.email}</p>
              </div>
              <Input
                id="edit-nombre"
                etiqueta="Nombre completo"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
              <Input
                id="edit-rol"
                etiqueta="Rol del usuario"
                desplegable
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as 'ADMIN' | 'STAFF')}
              >
                <option value="STAFF">STAFF (Operador de eventos y escáner)</option>
                <option value="ADMIN">ADMIN (Acceso total al sistema)</option>
              </Input>
              <Input
                id="edit-clave"
                etiqueta="Nueva contraseña"
                opcional="(opcional, mín. 8 caracteres para cambiarla)"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Dejar en blanco para conservar la actual"
                minLength={8}
              />
              <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
                <Button
                  variant="secundario"
                  type="button"
                  onClick={() => setEditTarget(null)}
                >
                  Cancelar
                </Button>
                <Button variant="primario" type="submit" cargando={isEditing}>
                  Guardar cambios
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diálogo modal único a nivel raíz para eliminación con ConfirmDialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        titulo="Eliminar usuario"
        mensaje={
          deleteTarget ? (
            <span>
              ¿Eliminar al usuario <strong>{deleteTarget.name}</strong> ({deleteTarget.email})? Esta
              acción no se puede deshacer.
            </span>
          ) : (
            ''
          )
        }
        confirmar="Eliminar"
        onConfirmar={() => void handleDeleteUser()}
        onCerrar={() => setDeleteTarget(null)}
      />
    </div>
  );
}
