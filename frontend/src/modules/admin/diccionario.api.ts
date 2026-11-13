
export interface PalabraClave {
  id: number;
  palabra: string;
  categoria_id: number;
  categoria: string;
}

export interface ResultadoPrueba {
  frase: string;
  categoria_id: number;
  categoria: string;
  palabra_activadora: string | null;
  es_otros: boolean;
  explicacion: string;
}

async function solicitar<T>(
  ruta: string,
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  datos?: object
): Promise<T> {
  const respuesta = await fetch(`/api/admin${ruta}`, {
    method: metodo,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(datos !== undefined
        ? { 'Content-Type': 'application/json' }
        : {})
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

// Consultar diccionario
export function listarPalabras() {
  return solicitar<PalabraClave[]>('/palabras-clave');
}

// Agregar palabra
export function agregarPalabra(
  palabra: string,
  categoriaId: number
) {
  return solicitar<PalabraClave>(
    '/palabras-clave',
    'POST',
    { palabra, categoria_id: categoriaId }
  );
}

// Editar palabra
export function editarPalabra(
  id: number,
  palabra: string,
  categoriaId: number
) {
  return solicitar<PalabraClave>(
    `/palabras-clave/${id}`,
    'PATCH',
    { palabra, categoria_id: categoriaId }
  );
}

// Quitar palabra
export function quitarPalabra(id: number) {
  return solicitar<{ id: number; mensaje: string }>(
    `/palabras-clave/${id}`,
    'DELETE'
  );
}

// Probar una frase con el clasificador del proyecto
export function probarFrase(frase: string) {
  return solicitar<ResultadoPrueba>(
    '/probar-frase',
    'POST',
    { frase }
  );
}
