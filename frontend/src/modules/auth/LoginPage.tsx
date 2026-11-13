import { useState, type FormEvent } from 'react';
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
    <div className="container py-5" style={{ maxWidth: 420 }}>
      <h1 className="h3 mb-4 text-center">SmartTriage IT</h1>
      <form onSubmit={enviar} noValidate className="card card-body shadow-sm">
        <h2 className="h5 mb-3">Iniciar sesión</h2>

        <label htmlFor="usuario" className="form-label">Usuario</label>
        <input
          id="usuario"
          className="form-control mb-3"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          disabled={enviando}
          autoFocus
        />

        <label htmlFor="password" className="form-label">Contraseña</label>
        <input
          id="password"
          type="password"
          className="form-control mb-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={enviando}
        />

        {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}