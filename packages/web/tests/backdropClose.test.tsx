import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

// Regresión: un arrastre que empieza dentro del panel y termina fuera (por
// ejemplo, seleccionar texto con el mouse y salirse del panel) hacía que el
// navegador emitiera el `click` en el ancestro común —el fondo— y el formulario
// se cerrara solo mientras el usuario escribía.

function renderDialog(onCerrar: () => void) {
  render(
    <Dialog titulo="Nuevo usuario" onCerrar={onCerrar}>
      <input aria-label="nombre" />
    </Dialog>
  );
  return {
    fondo: screen.getByRole('dialog', { name: 'Nuevo usuario' }),
    campo: screen.getByLabelText('nombre'),
  };
}

describe('cierre por clic en el fondo', () => {
  it('cierra cuando la presión empieza y termina en el fondo', () => {
    const onCerrar = vi.fn();
    const { fondo } = renderDialog(onCerrar);

    fireEvent.pointerDown(fondo);
    fireEvent.click(fondo);

    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('NO cierra cuando la presión empieza dentro del panel y el clic cae en el fondo', () => {
    const onCerrar = vi.fn();
    const { fondo, campo } = renderDialog(onCerrar);

    // pointerdown dentro del input, pointerup fuera del panel: el click llega
    // al fondo, no al input.
    fireEvent.pointerDown(campo);
    fireEvent.click(fondo);

    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('NO cierra con un clic en el fondo sin presión previa en el fondo', () => {
    const onCerrar = vi.fn();
    const { fondo } = renderDialog(onCerrar);

    fireEvent.click(fondo);

    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('NO cierra al hacer clic dentro del panel', () => {
    const onCerrar = vi.fn();
    const { campo } = renderDialog(onCerrar);

    fireEvent.pointerDown(campo);
    fireEvent.click(campo);

    expect(onCerrar).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog: cierre por clic en el fondo', () => {
  function renderConfirm(onCerrar: () => void, cargando = false) {
    render(
      <ConfirmDialog
        open
        titulo="Eliminar usuario"
        mensaje="¿Eliminar?"
        cargando={cargando}
        onConfirmar={vi.fn()}
        onCerrar={onCerrar}
      />
    );
    return screen.getByRole('alertdialog', { name: 'Eliminar usuario' });
  }

  it('cierra cuando la presión empieza y termina en el fondo', () => {
    const onCerrar = vi.fn();
    const fondo = renderConfirm(onCerrar);

    fireEvent.pointerDown(fondo);
    fireEvent.click(fondo);

    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('NO cierra mientras está cargando', () => {
    const onCerrar = vi.fn();
    const fondo = renderConfirm(onCerrar, true);

    fireEvent.pointerDown(fondo);
    fireEvent.click(fondo);

    expect(onCerrar).not.toHaveBeenCalled();
  });
});
