
export interface CategoriaCatalogo {
  id: number;
  nombre: string;
  grupo_id: number | null;
  grupo_nombre: string | null;
}

export interface GrupoCatalogo {
  id: number;
  nombre: string;
}

async function consultarAPI<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(ruta, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!respuesta.ok) {
    throw new Error(
      `Error al consultar ${ruta}: HTTP ${respuesta.status}`
    );
  }

  return (await respuesta.json()) as T;
}

export function obtenerCategorias() {
  return consultarAPI<CategoriaCatalogo[]>(
    '/api/catalogos/categorias'
  );
}

export function obtenerGrupos() {
  return consultarAPI<GrupoCatalogo[]>(
    '/api/catalogos/grupos'
  );
}
