import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { RegistrationForm } from '../components/RegistrationForm';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    isAxiosError: (e: unknown): boolean => (e as { isAxiosError?: boolean })?.isAxiosError === true,
  },
}));

const mockedPost = axios.post as unknown as ReturnType<typeof vi.fn>;

function fillValid(): void {
  fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Pérez' } });
  fireEvent.change(screen.getByLabelText('CI'), { target: { value: '123' } });
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@test.com' } });
  fireEvent.click(screen.getByLabelText(/Acepto el tratamiento/));
}

describe('RegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra errores de validación con el formulario vacío', async () => {
    render(
      <RegistrationForm
        slug="evento"
        required={{ career: false, semester: false, institution: false, phone: false }}
      />
    );
    fireEvent.click(screen.getByText('Confirmar inscripción'));
    expect(await screen.findByText('El nombre es obligatorio')).toBeDefined();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('envía el honeypot vacío y muestra el QR al éxito', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        firstName: 'Ana',
        lastName: 'Pérez',
        qrToken: 'tok',
        qrPngUrl: 'http://x/qr.png',
        mailSent: true,
        notice: null,
      },
    });
    render(
      <RegistrationForm
        slug="evento"
        required={{ career: false, semester: false, institution: false, phone: false }}
      />
    );
    fillValid();
    fireEvent.click(screen.getByText('Confirmar inscripción'));
    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
    const [, body] = mockedPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.website).toBe('');
    expect(await screen.findByAltText('QR personal de ingreso')).toBeDefined();
  });

  it('muestra el mensaje de duplicado sin romper el formulario', async () => {
    mockedPost.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: { message: 'El registro ya existe' } } },
    });
    render(
      <RegistrationForm
        slug="evento"
        required={{ career: false, semester: false, institution: false, phone: false }}
      />
    );
    fillValid();
    fireEvent.click(screen.getByText('Confirmar inscripción'));
    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
    expect(screen.queryByAltText('QR personal de ingreso')).toBeNull();
  });
});
