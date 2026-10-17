'use client';

import {
  useState,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { DateTimeInput } from './DateTimeInput';

const field =
  'mt-1 block w-full min-h-[44px] rounded-[var(--radius-md)] border border-line bg-surface p-2.5 text-ink shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50 transition-colors';

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
    <p role="alert" className="mt-1 text-sm text-danger">
      {message}
    </p>
  );
}

function Label({ id, etiqueta, opcional }: Base): ReactElement {
  return (
    <label htmlFor={id} className="block text-sm font-medium text-ink">
      {etiqueta}
      {opcional ? <span className="font-normal text-muted"> {opcional}</span> : null}
    </label>
  );
}

function PasswordInputField({
  id,
  fieldClass,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { id: string; fieldClass: string }): ReactElement {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        {...rest}
        type={show ? 'text' : 'password'}
        className={`${fieldClass} pr-11`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Ocultar contraseña' : 'Ver contraseña'}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex min-h-[36px] min-w-[36px] items-center justify-center rounded-[var(--radius-md)] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-gold transition-colors"
        tabIndex={-1}
      >
        {show ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

export function Input(props: InputProps): ReactElement;
export function Input(props: AreaProps): ReactElement;
export function Input(props: SelectProps): ReactElement;
export function Input(props: InputProps | AreaProps | SelectProps): ReactElement {
  if ('type' in props && props.type === 'datetime-local') {
    return <DateTimeInput {...(props as any)} />;
  }
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

  if (rest.type === 'password') {
    return (
      <div>
        <Label id={id} etiqueta={etiqueta} opcional={opcional} />
        <PasswordInputField id={id} fieldClass={field} {...rest} />
        <ErrorText message={error} />
      </div>
    );
  }

  return (
    <div>
      <Label id={id} etiqueta={etiqueta} opcional={opcional} />
      <input id={id} {...rest} className={field} />
      <ErrorText message={error} />
    </div>
  );
}
