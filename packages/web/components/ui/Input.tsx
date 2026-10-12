'use client';

import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

const field = 'mt-1 block w-full rounded-[8px] border border-[#D9DEE7] bg-white p-2 text-[#1B2433]';

interface Base {
  id: string;
  etiqueta: string;
  error?: string;
  opcional?: string;
}

type InputProps = Base &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { multiline?: false; desplegable?: false };

type AreaProps = Base &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & { multiline: true };

type SelectProps = Base &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
    desplegable: true;
    children?: ReactNode;
  };

function ErrorText({ message }: { message?: string }): ReactElement | null {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-[#B42318]">
      {message}
    </p>
  );
}

function Label({ id, etiqueta, opcional }: Base): ReactElement {
  return (
    <label htmlFor={id} className="text-[#1B2433]">
      {etiqueta}
      {opcional ? <span className="text-[#5B6677]"> {opcional}</span> : null}
    </label>
  );
}

export function Input(props: InputProps): ReactElement;
export function Input(props: AreaProps): ReactElement;
export function Input(props: SelectProps): ReactElement;
export function Input(props: InputProps | AreaProps | SelectProps): ReactElement {
  if ('desplegable' in props && props.desplegable) {
    const { id, etiqueta, error, opcional, desplegable: _d, children, ...rest } = props;
    void _d;
    return (
      <div>
        <Label id={id} etiqueta={etiqueta} opcional={opcional} />
        <select id={id} {...rest} className={field}>
          {children}
        </select>
        <ErrorText message={error} />
      </div>
    );
  }
  if ('multiline' in props && props.multiline) {
    const { id, etiqueta, error, opcional, multiline: _m, ...rest } = props;
    void _m;
    return (
      <div>
        <Label id={id} etiqueta={etiqueta} opcional={opcional} />
        <textarea id={id} {...rest} className={field} />
        <ErrorText message={error} />
      </div>
    );
  }
  const { id, etiqueta, error, opcional, multiline: _m2, desplegable: _d2, ...rest } = props;
  void _m2;
  void _d2;
  return (
    <div>
      <Label id={id} etiqueta={etiqueta} opcional={opcional} />
      <input id={id} {...rest} className={field} />
      <ErrorText message={error} />
    </div>
  );
}
