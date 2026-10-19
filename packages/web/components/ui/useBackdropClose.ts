'use client';

import { useRef, type MouseEvent, type PointerEvent } from 'react';

/**
 * Props para el fondo de un diálogo: cierra al hacer clic en el fondo SOLO si
 * la presión del puntero empezó ahí.
 *
 * Sin esta guarda, un arrastre que arranca dentro del panel y termina fuera
 * (por ejemplo, seleccionar texto con el mouse y salirse del panel) hace que el
 * navegador emita el `click` en el ancestro común de `pointerdown` y `pointerup`
 * —el fondo— y el diálogo se cerraba solo mientras el usuario estaba editando.
 *
 * Uso: `<div role="dialog" {...useBackdropClose(onCerrar)}>`
 */
export function useBackdropClose(onCerrar: () => void, habilitado = true) {
  const empezoEnFondo = useRef(false);

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>): void => {
      empezoEnFondo.current = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent<HTMLElement>): void => {
      if (!habilitado) return;
      if (!empezoEnFondo.current || e.target !== e.currentTarget) return;
      empezoEnFondo.current = false;
      onCerrar();
    },
  };
}
