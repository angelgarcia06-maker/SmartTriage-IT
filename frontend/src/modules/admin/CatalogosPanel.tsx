
import { useEffect, useState } from 'react';
import {
  obtenerCategorias,
  obtenerGrupos,
  type CategoriaCatalogo,
  type GrupoCatalogo
} from './catalogos.api';

export function CatalogosPanel() {
  const [categorias, setCategorias] =
    useState<CategoriaCatalogo[]>([]);

  const [grupos, setGrupos] =
    useState<GrupoCatalogo[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;

    Promise.all([
      obtenerCategorias(),
      obtenerGrupos()
    ])
      .then(([categorias, grupos]) => {
        if (!activo) return;
        setCategorias(categorias);
        setGrupos(grupos);
      })
      .catch((err: unknown) => {
        if (activo) {
          setError(
            err instanceof Error
              ? err.message
              : 'Error al cargar catálogos'
          );
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  if (cargando) return <p>Cargando catálogos...</p>;

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <section className="container py-4">
      <h2>Administración de catálogos</h2>

      <h3 className="h5 mt-4">Categorías</h3>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>ID</th>
            <th>Categoría</th>
            <th>Grupo responsable</th>
          </tr>
        </thead>
        <tbody>
          {categorias.map(categoria => (
            <tr key={categoria.id}>
              <td>{categoria.id}</td>
              <td>{categoria.nombre}</td>
              <td>{categoria.grupo_nombre ?? 'Sin grupo'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="h5 mt-4">Grupos activos</h3>
      <ul className="list-group">
        {grupos.map(grupo => (
          <li className="list-group-item" key={grupo.id}>
            {grupo.nombre}
          </li>
        ))}
      </ul>
    </section>
  );
}
