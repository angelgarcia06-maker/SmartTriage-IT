import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from './useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!usuario.trim() || !password) {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }
    setEnviando(true);
    try {
      await login(usuario.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth-shell">
      <main className="auth-panel">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true"><ShieldCheck size={25} /></span>
          <span>SmartTriage IT</span>
        </div>
        <h1>Iniciar sesión</h1>
        <p className="auth-subtitle">Accede a tu espacio de gestión de servicios TI.</p>
        <form onSubmit={enviar} noValidate>
          <div className="mb-3">
            <label htmlFor="usuario" className="form-label">Usuario</label>
            <input
              id="usuario"
              className="form-control"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              disabled={enviando}
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="form-label">Contraseña</label>
            <input
              id="password"
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={enviando}
            />
          </div>

          {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </main>
    </div>
  );
}