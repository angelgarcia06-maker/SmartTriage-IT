import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { usuariosApi, type DatosUsuario, type Grupo, type UsuarioAdmin } from './usuariosApi';

const VACIO: DatosUsuario = { nombre: '', usuario: '', password: '', rol: 'agente', grupo_id: null, activo: true };

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [form, setForm] = useState<DatosUsuario>(VACIO);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [u, g] = await Promise.all([usuariosApi.listar(), usuariosApi.grupos()]);
      setUsuarios(u);
      setGrupos(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function editar(u: UsuarioAdmin) {
    setEditandoId(u.id);
    setForm({ nombre: u.nombre, usuario: u.usuario, password: '', rol: u.rol, grupo_id: u.grupo_id, activo: u.activo });
    setError('');
    setAviso('');
  }

  function cancelar() {
    setEditandoId(null);
    setForm(VACIO);
    setError('');
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setAviso('');
    if (!form.nombre.trim() || !form.usuario.trim()) return setError('Nombre y usuario son obligatorios.');
    if (editandoId === null && !form.password) return setError('La contraseña es obligatoria al crear.');
    if (form.rol === 'tecnico' && form.grupo_id === null) return setError('Un técnico debe tener grupo.');

    const datos: Partial<DatosUsuario> = {
      nombre: form.nombre.trim(),
      usuario: form.usuario.trim(),
      rol: form.rol,
      grupo_id: form.rol === 'tecnico' ? form.grupo_id : null,
      activo: form.activo,
    };
    if (form.password) datos.password = form.password;

    setEnviando(true);
    try {
      if (editandoId === null) await usuariosApi.crear(datos as DatosUsuario);
      else await usuariosApi.actualizar(editandoId, datos);
      setAviso(editandoId === null ? 'Usuario creado.' : 'Usuario actualizado.');
      cancelar();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setEnviando(false);
    }
  }

  async function alternar(u: UsuarioAdmin) {
    setError('');
    setAviso('');
    try {
      await usuariosApi.actualizar(u.id, { activo: !u.activo });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado');
    }
  }

  const nombreGrupo = (id: number | null) => grupos.find((g) => g.id === id)?.nombre ?? (id ? `#${id}` : '—');

  return (
    <div className="page-section">
      <p className="page-description">Crea y administra las cuentas, roles y grupos de soporte.</p>
      {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
      {aviso && <div className="alert alert-success py-2" role="status">{aviso}</div>}

      <form onSubmit={enviar} noValidate className="card card-body mb-4">
        <h2 className="h6">{editandoId === null ? 'Nuevo usuario' : 'Editar usuario'}</h2>
        <div className="row g-2">
          <div className="col-md-4">
            <label htmlFor="u-nombre" className="form-label">Nombre</label>
            <input id="u-nombre" className="form-control" value={form.nombre} disabled={enviando}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="col-md-3">
            <label htmlFor="u-usuario" className="form-label">Usuario</label>
            <input id="u-usuario" className="form-control" value={form.usuario} disabled={enviando}
              onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
          </div>
          <div className="col-md-3">
            <label htmlFor="u-pass" className="form-label">
              {editandoId === null ? 'Contraseña' : 'Nueva contraseña (opcional)'}
            </label>
            <input id="u-pass" type="password" className="form-control" autoComplete="new-password"
              value={form.password ?? ''} disabled={enviando}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="col-md-2">
            <label htmlFor="u-rol" className="form-label">Rol</label>
            <select id="u-rol" className="form-select" value={form.rol} disabled={enviando}
              onChange={(e) => {
                const rol = e.target.value as DatosUsuario['rol'];
                setForm({ ...form, rol, grupo_id: rol === 'tecnico' ? form.grupo_id : null });
              }}>
              <option value="agente">Agente</option>
              <option value="tecnico">Técnico</option>
              <option value="administrador">Administrador</option>
            </select>
          </div>
          {form.rol === 'tecnico' && (
            <div className="col-md-4">
              <label htmlFor="u-grupo" className="form-label">Grupo</label>
              <select id="u-grupo" className="form-select" value={form.grupo_id ?? ''} disabled={enviando}
                onChange={(e) => setForm({ ...form, grupo_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Selecciona un grupo</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="col-md-3 d-flex align-items-end">
            <div className="form-check">
              <input id="u-activo" type="checkbox" className="form-check-input" checked={form.activo}
                disabled={enviando} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
              <label htmlFor="u-activo" className="form-check-label">Activo</label>
            </div>
          </div>
        </div>
        <div className="mt-3 d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? 'Guardando...' : editandoId === null ? 'Crear' : 'Guardar cambios'}
          </button>
          {editandoId !== null && (
            <button type="button" className="btn btn-outline-secondary" onClick={cancelar} disabled={enviando}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {cargando ? (
        <p role="status">Cargando usuarios…</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Grupo</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td>{u.usuario}</td>
                  <td>{u.rol}</td>
                  <td>{nombreGrupo(u.grupo_id)}</td>
                  <td>
                    <span className={`badge ${u.activo ? 'text-bg-success' : 'text-bg-secondary'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-primary me-2" onClick={() => editar(u)}>Editar</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => void alternar(u)}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}