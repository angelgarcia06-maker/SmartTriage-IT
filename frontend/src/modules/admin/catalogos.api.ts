
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

type MetodoCambio = 'POST' | 'PATCH';

async function enviarCambio<T>(
  ruta: string,
  metodo: MetodoCambio,
  datos?: object
): Promise<T> {
  const respuesta = await fetch(ruta, {
    method: metodo,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    ...(datos !== undefined
      ? { body: JSON.stringify(datos) }
      : {})
  });

  if (!respuesta.ok) {
    const detalle: unknown = await respuesta.json()
      .catch(() => null);

    const mensaje =
      detalle !== null &&
      typeof detalle === 'object' &&
      'error' in detalle &&
      typeof detalle.error === 'string'
        ? detalle.error
        : `Error HTTP ${respuesta.status}`;

    throw new Error(mensaje);
  }

  return (await respuesta.json()) as T;
}

// ADM-02: Operaciones de grupos

export function crearGrupo(nombre: string) {
  return enviarCambio(
    '/api/catalogos/grupos',
    'POST',
    { nombre }
  );
}

export function editarGrupo(id: number, nombre: string) {
  return enviarCambio(
    `/api/catalogos/grupos/${id}`,
    'PATCH',
    { nombre }
  );
}

export function desactivarGrupo(id: number) {
  return enviarCambio(
    `/api/catalogos/grupos/${id}/desactivar`,
    'PATCH'
  );
}

// ADM-02: Operaciones de categorías

export function crearCategoria(
  nombre: string,
  grupoId: number
) {
  return enviarCambio(
    '/api/catalogos/categorias',
    'POST',
    { nombre, grupo_id: grupoId }
  );
}

export function editarCategoria(
  id: number,
  nombre: string,
  grupoId: number
) {
  return enviarCambio(
    `/api/catalogos/categorias/${id}`,
    'PATCH',
    { nombre, grupo_id: grupoId }
  );
}

export function desactivarCategoria(id: number) {
  return enviarCambio(
    `/api/catalogos/categorias/${id}/desactivar`,
    'PATCH'
  );
}
