import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Input } from '../Input';

describe('Input', () => {
  it('debe renderizar el input', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText(/enter text/i)).toBeInTheDocument();
  });

  it('debe mostrar el label cuando se proporciona', () => {
    render(<Input label="Email" />);
    expect(screen.getByText(/email/i)).toBeInTheDocument();
  });

  it('debe mostrar el mensaje de error cuando se proporciona', () => {
    render(<Input error="Este campo es requerido" />);
    expect(screen.getByText(/este campo es requerido/i)).toBeInTheDocument();
  });

  it('debe mostrar el helperText cuando se proporciona y no hay error', () => {
    render(<Input helperText="Ingresa tu email" />);
    expect(screen.getByText(/ingresa tu email/i)).toBeInTheDocument();
  });

  it('debe permitir escribir texto', async () => {
    const user = userEvent.setup();
    render(<Input placeholder="Enter text" />);
    
    const input = screen.getByPlaceholderText(/enter text/i) as HTMLInputElement;
    await user.type(input, 'test@example.com');
    
    expect(input.value).toBe('test@example.com');
  });

  it('debe estar deshabilitado cuando disabled es true', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
