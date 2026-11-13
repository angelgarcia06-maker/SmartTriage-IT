
import { useEffect, useState, type FormEvent } from 'react';
import {
  obtenerCategorias,
  type CategoriaCatalogo
} from './catalogos.api';

import {
  listarPalabras,
  agregarPalabra,
  editarPalabra,
  quitarPalabra,
  probarFrase,
  type PalabraClave,
  type ResultadoPrueba
} from './diccionario.api';

export function DiccionarioPanel() {
  const [categorias, setCategorias] =
    useState<CategoriaCatalogo[]>([]);
  const [palabras, setPalabras] =
    useState<PalabraClave[]>([]);

  const [palabra, setPalabra] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [editando, setEditando] = useState<number | null>(null);

  const [frase, setFrase] = useState('');
  const [resultado, setResultado] =
    useState<ResultadoPrueba | null>(null);

  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  function mostrarError(err: unknown) {
    setError(
      err instanceof Error
        ? err.message
        : 'Ocurrió un error inesperado'
    );
  }

  async function recargar() {
    const lista = await listarPalabras();
    setPalabras(lista);
    setResultado(null);
  }

  useEffect(() => {
    let vigente = true;

    Promise.all([
      obtenerCategorias(),
      listarPalabras()
    ]).then(([cats, lista]) => {
      if (!vigente) return;

      setCategorias(cats.filter(c => c.nombre !== 'Otros'));
      setPalabras(lista);
    }).catch(err => {
      if (vigente) {
        setError(
          err instanceof Error
            ? err.message
            : 'Error al cargar diccionario'
        );
      }
    }).finally(() => {
      if (vigente) setCargando(false);
    });

    return () => { vigente = false; };
  }, []);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const id = Number(categoriaId);

    if (!palabra.trim() || !Number.isSafeInteger(id) || id <= 0) {
      setError('Ingresa una palabra y selecciona una categoría');
      return;
    }

    setOcupado(true);
    setError('');
    setMensaje('');

    try {
      if (editando === null) {
        await agregarPalabra(palabra.trim(), id);
      } else {
        await editarPalabra(editando, palabra.trim(), id);
      }

      await recargar();
      setPalabra('');
      setCategoriaId('');
      setEditando(null);
      setMensaje('Diccionario actualizado correctamente');
    } catch (err) {
      mostrarError(err);
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar(item: PalabraClave) {
    if (!window.confirm(
      `¿Quitar la palabra "${item.palabra}"?`
    )) return;

    setOcupado(true);
    setError('');
    setMensaje('');

    try {
      await quitarPalabra(item.id);
      await recargar();
      setMensaje('Palabra eliminada del diccionario');
    } catch (err) {
      mostrarError(err);
    } finally {
      setOcupado(false);
    }
  }

  async function probar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!frase.trim()) {
      setError('Ingresa una frase para probar');
      return;
    }

    setOcupado(true);
    setError('');
    setResultado(null);

    try {
      const respuesta = await probarFrase(frase);
      setResultado(respuesta);
    } catch (err) {
      mostrarError(err);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="container py-4">
      <h2>Diccionario de palabras clave</h2>
      <p className="text-muted">
        Administra las palabras utilizadas para clasificar
        incidencias de soporte técnico.
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

      {cargando ? (
        <p>Cargando diccionario...</p>
      ) : (
        <>
          <div className="card mb-4">
            <div className="card-body">
              <h3 className="h5">
                {editando === null
                  ? 'Agregar palabra clave'
                  : 'Editar palabra clave'}
              </h3>

              <form onSubmit={guardar}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="palabra">
                    Palabra o frase clave
                  </label>
                  <input
                    id="palabra"
                    className="form-control"
                    value={palabra}
                    onChange={e => setPalabra(e.target.value)}
                    maxLength={80}
                    required
                    disabled={ocupado}
                    placeholder="Ejemplo: proyector"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="categoria">
                    Categoría
                  </label>
                  <select
                    id="categoria"
                    className="form-select"
                    value={categoriaId}
                    onChange={e => setCategoriaId(e.target.value)}
                    required
                    disabled={ocupado}
                  >
                    <option value="">Seleccionar categoría</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={ocupado}
                >
                  {editando === null
                    ? 'Agregar palabra'
                    : 'Guardar cambios'}
                </button>

                {editando !== null && (
                  <button
                    className="btn btn-secondary ms-2"
                    type="button"
                    disabled={ocupado}
                    onClick={() => {
                      setEditando(null);
                      setPalabra('');
                      setCategoriaId('');
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </form>
            </div>
          </div>

          <h3 className="h5">Palabras registradas</h3>
          <div className="table-responsive mb-4">
            <table className="table table-striped table-bordered">
              <thead>
                <tr>
                  <th>Palabra clave</th>
                  <th>Categoría</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {palabras.map(item => (
                  <tr key={item.id}>
                    <td>{item.palabra}</td>
                    <td>{item.categoria}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-warning me-2"
                        type="button"
                        disabled={ocupado}
                        onClick={() => {
                          setEditando(item.id);
                          setPalabra(item.palabra);
                          setCategoriaId(String(item.categoria_id));
                        }}
                      >
                        Editar
                      </button>

                      <button
                        className="btn btn-sm btn-outline-danger"
                        type="button"
                        disabled={ocupado}
                        onClick={() => void eliminar(item)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
                {palabras.length === 0 && (
                  <tr>
                    <td colSpan={3}>
                      No hay palabras registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-body">
              <h3 className="h5">Probar frase</h3>
              <p className="text-muted">
                Comprueba cómo clasifica SmartTriage
                una incidencia según el diccionario actual.
              </p>

              <form onSubmit={probar}>
                <textarea
                  className="form-control mb-3"
                  value={frase}
                  onChange={e => setFrase(e.target.value)}
                  placeholder="Ejemplo: Mi proyector no enciende"
                  rows={3}
                  maxLength={5000}
                  required
                  disabled={ocupado}
                  aria-label="Frase para clasificar"
                />

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={ocupado}
                >
                  Probar frase
                </button>
              </form>

              {resultado && (
                <div className="alert alert-info mt-3" role="status">
                  <h4 className="h6">Resultado</h4>
                  <p>
                    <strong>Categoría:</strong>{' '}
                    {resultado.categoria}
                  </p>
                  <p>
                    <strong>Palabra activadora:</strong>{' '}
                    {resultado.palabra_activadora ?? 'Ninguna'}
                  </p>
                  <p className="mb-0">
                    <strong>Explicación:</strong>{' '}
                    {resultado.explicacion}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
