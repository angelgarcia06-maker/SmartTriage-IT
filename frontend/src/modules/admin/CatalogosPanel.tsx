
import { useEffect, useState, type FormEvent } from 'react';
import {
  obtenerCategorias,
  obtenerGrupos,
  crearGrupo,
  editarGrupo,
  desactivarGrupo,
  crearCategoria,
  editarCategoria,
  desactivarCategoria,
  type CategoriaCatalogo,
  type GrupoCatalogo
} from './catalogos.api';

function obtenerMensaje(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado';
}

export function CatalogosPanel() {
  const [categorias, setCategorias] =
    useState<CategoriaCatalogo[]>([]);
  const [grupos, setGrupos] =
    useState<GrupoCatalogo[]>([]);

  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  // Formulario de grupos
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [grupoEditando, setGrupoEditando] =
    useState<number | null>(null);

  // Formulario de categorías
  const [nombreCategoria, setNombreCategoria] = useState('');
  const [grupoCategoria, setGrupoCategoria] = useState('');
  const [categoriaEditando, setCategoriaEditando] =
    useState<number | null>(null);

  async function recargar() {
    const [listaCategorias, listaGrupos] = await Promise.all([
      obtenerCategorias(),
      obtenerGrupos()
    ]);

    setCategorias(listaCategorias);
    setGrupos(listaGrupos);
  }

  useEffect(() => {
    let vigente = true;

    Promise.all([obtenerCategorias(), obtenerGrupos()])
      .then(([listaCategorias, listaGrupos]) => {
        if (!vigente) return;
        setCategorias(listaCategorias);
        setGrupos(listaGrupos);
      })
      .catch((err: unknown) => {
        if (vigente) setError(obtenerMensaje(err));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  async function ejecutar(
    accion: () => Promise<unknown>,
    textoExito: string
  ): Promise<boolean> {
    setOcupado(true);
    setError('');
    setMensaje('');

    try {
      await accion();
      await recargar();
      setMensaje(textoExito);
      return true;
    } catch (err: unknown) {
      setError(obtenerMensaje(err));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  // Guardar grupo: crear o editar
  async function guardarGrupo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nombre = nombreGrupo.trim();

    if (!nombre) {
      setError('Ingresa el nombre del grupo');
      return;
    }

    const correcto = await ejecutar(
      () => grupoEditando === null
        ? crearGrupo(nombre)
        : editarGrupo(grupoEditando, nombre),
      'Grupo guardado correctamente'
    );

    if (correcto) {
      setNombreGrupo('');
      setGrupoEditando(null);
    }
  }

  // Guardar categoría: crear o editar
  async function guardarCategoria(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const nombre = nombreCategoria.trim();
    const grupoId = Number(grupoCategoria);

    if (!nombre || !Number.isSafeInteger(grupoId) || grupoId <= 0) {
      setError('Ingresa una categoría y selecciona un grupo');
      return;
    }

    const correcto = await ejecutar(
      () => categoriaEditando === null
        ? crearCategoria(nombre, grupoId)
        : editarCategoria(categoriaEditando, nombre, grupoId),
      'Categoría guardada correctamente'
    );

    if (correcto) {
      setNombreCategoria('');
      setGrupoCategoria('');
      setCategoriaEditando(null);
    }
  }

  async function quitarGrupo(grupo: GrupoCatalogo) {
    if (!window.confirm(
      `¿Desactivar el grupo "${grupo.nombre}"?`
    )) return;

    await ejecutar(
      () => desactivarGrupo(grupo.id),
      'Grupo desactivado correctamente'
    );
  }

  async function quitarCategoria(categoria: CategoriaCatalogo) {
    if (!window.confirm(
      `¿Desactivar la categoría "${categoria.nombre}"?`
    )) return;

    await ejecutar(
      () => desactivarCategoria(categoria.id),
      'Categoría desactivada correctamente'
    );
  }

  return (
    <section className="container py-4">
      <h2>Administración de catálogos</h2>
      <p className="text-muted">
        Gestión de categorías y grupos de soporte técnico.
      </p>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="alert alert-success" role="status">
          {mensaje}
        </div>
      )}

      {cargando && <p>Cargando catálogos...</p>}

      {!cargando && (
        <>
          {/* ADMINISTRACIÓN DE GRUPOS */}
          <div className="card mb-4">
            <div className="card-body">
              <h3 className="h5">
                {grupoEditando === null
                  ? 'Registrar grupo'
                  : 'Editar grupo'}
              </h3>

              <form onSubmit={guardarGrupo}>
                <div className="mb-3">
                  <label htmlFor="nombreGrupo" className="form-label">
                    Nombre del grupo
                  </label>
                  <input
                    id="nombreGrupo"
                    className="form-control"
                    value={nombreGrupo}
                    onChange={e => setNombreGrupo(e.target.value)}
                    maxLength={80}
                    required
                    disabled={ocupado}
                    placeholder="Ejemplo: Soporte técnico"
                  />
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={ocupado}
                >
                  {grupoEditando === null
                    ? 'Registrar grupo'
                    : 'Guardar cambios'}
                </button>

                {grupoEditando !== null && (
                  <button
                    type="button"
                    className="btn btn-secondary ms-2"
                    disabled={ocupado}
                    onClick={() => {
                      setGrupoEditando(null);
                      setNombreGrupo('');
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </form>
            </div>
          </div>

          <h3 className="h5">Grupos activos</h3>
          <div className="table-responsive mb-4">
            <table className="table table-bordered table-striped">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(grupo => (
                  <tr key={grupo.id}>
                    <td>{grupo.id}</td>
                    <td>{grupo.nombre}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-warning me-2"
                        disabled={ocupado}
                        onClick={() => {
                          setGrupoEditando(grupo.id);
                          setNombreGrupo(grupo.nombre);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        disabled={ocupado}
                        onClick={() => void quitarGrupo(grupo)}
                      >
                        Desactivar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ADMINISTRACIÓN DE CATEGORÍAS */}
          <div className="card mb-4">
            <div className="card-body">
              <h3 className="h5">
                {categoriaEditando === null
                  ? 'Registrar categoría'
                  : 'Editar categoría'}
              </h3>

              <form onSubmit={guardarCategoria}>
                <div className="mb-3">
                  <label htmlFor="nombreCategoria" className="form-label">
                    Nombre de la categoría
                  </label>
                  <input
                    id="nombreCategoria"
                    className="form-control"
                    value={nombreCategoria}
                    onChange={e => setNombreCategoria(e.target.value)}
                    maxLength={80}
                    required
                    disabled={ocupado}
                    placeholder="Ejemplo: Impresoras"
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="grupoCategoria" className="form-label">
                    Grupo responsable
                  </label>
                  <select
                    id="grupoCategoria"
                    className="form-select"
                    value={grupoCategoria}
                    onChange={e => setGrupoCategoria(e.target.value)}
                    disabled={ocupado}
                    required
                  >
                    <option value="">Seleccionar grupo</option>
                    {grupos.map(grupo => (
                      <option key={grupo.id} value={grupo.id}>
                        {grupo.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={ocupado}
                >
                  {categoriaEditando === null
                    ? 'Registrar categoría'
                    : 'Guardar cambios'}
                </button>

                {categoriaEditando !== null && (
                  <button
                    type="button"
                    className="btn btn-secondary ms-2"
                    disabled={ocupado}
                    onClick={() => {
                      setCategoriaEditando(null);
                      setNombreCategoria('');
                      setGrupoCategoria('');
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </form>
            </div>
          </div>

          <h3 className="h5">Categorías activas</h3>
          <div className="table-responsive">
            <table className="table table-bordered table-striped">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Categoría</th>
                  <th>Grupo responsable</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map(categoria => (
                  <tr key={categoria.id}>
                    <td>{categoria.id}</td>
                    <td>{categoria.nombre}</td>
                    <td>{categoria.grupo_nombre ?? 'Sin grupo'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-warning me-2"
                        disabled={ocupado}
                        onClick={() => {
                          setCategoriaEditando(categoria.id);
                          setNombreCategoria(categoria.nombre);
                          setGrupoCategoria(
                            categoria.grupo_id === null
                              ? ''
                              : String(categoria.grupo_id)
                          );
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        disabled={ocupado}
                        onClick={() => void quitarCategoria(categoria)}
                      >
                        Desactivar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
