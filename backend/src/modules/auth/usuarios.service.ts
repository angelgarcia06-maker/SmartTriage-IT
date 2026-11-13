import bcrypt from 'bcryptjs';
import { buscarPorId } from './auth.repository';
import { aDtoPublico } from './auth.service';
import type { RolAuth, UsuarioPublico } from './auth.types';
import * as repo from './usuarios.repository';

export class ErrorNegocio extends Error {
  readonly status: number;
  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.status = status;
  }
}

export interface DatosCrear {
  nombre: string;
  usuario: string;
  password: string;
  rol: RolAuth;
  grupo_id?: number | null;
  activo?: boolean;
}
export type DatosActualizar = Partial<DatosCrear>;

function esDuplicadoSqlite(e: unknown): boolean {
  const code = (e as { code?: string }).code;
  return typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT');
}

/** Solo los técnicos pertenecen a un grupo, y debe existir y estar activo. */
function validarGrupo(rol: RolAuth, grupoId: number | null): void {
  if (rol !== 'tecnico') {
    if (grupoId !== null) throw new ErrorNegocio(400, 'Solo los técnicos pueden pertenecer a un grupo');
    return;
  }
  if (grupoId === null) throw new ErrorNegocio(400, 'Un técnico debe pertenecer a un grupo');
  const g = repo.buscarGrupo(grupoId);
  if (!g || g.activo !== 1) throw new ErrorNegocio(400, 'El grupo no existe o está inactivo');
}

export function listarUsuarios(): UsuarioPublico[] {
  return repo.listarUsuarios().map(aDtoPublico);
}

export function listarGrupos(): { id: number; nombre: string }[] {
  return repo.listarGruposActivos().map((g) => ({ id: g.id, nombre: g.nombre }));
}

export function crearUsuario(datos: DatosCrear): UsuarioPublico {
  const grupoId = datos.grupo_id ?? null;
  validarGrupo(datos.rol, grupoId);
  if (repo.existeUsuario(datos.usuario)) throw new ErrorNegocio(409, 'El nombre de usuario ya existe');

  let id: number;
  try {
    id = repo.insertarUsuario({
      nombre: datos.nombre,
      usuario: datos.usuario,
      password_hash: bcrypt.hashSync(datos.password, 10),
      rol: datos.rol,
      activo: datos.activo === false ? 0 : 1,
      grupo_id: grupoId,
    });
  } catch (e) {
    if (esDuplicadoSqlite(e)) throw new ErrorNegocio(409, 'El nombre de usuario ya existe');
    throw e;
  }
  return aDtoPublico(buscarPorId(id)!);
}

export function actualizarUsuario(id: number, cambios: DatosActualizar, actorId: number): UsuarioPublico {
  const actual = buscarPorId(id);
  if (!actual) throw new ErrorNegocio(404, 'Usuario no encontrado');

  const rolFinal = cambios.rol ?? actual.rol;
  const activoFinal = cambios.activo === undefined ? actual.activo === 1 : cambios.activo;

  // Al dejar de ser técnico, el grupo se limpia solo.
  let grupoFinal = cambios.grupo_id !== undefined ? cambios.grupo_id : actual.grupo_id;
  if (rolFinal !== 'tecnico' && cambios.grupo_id === undefined) grupoFinal = null;
  if (cambios.rol !== undefined || cambios.grupo_id !== undefined) validarGrupo(rolFinal, grupoFinal);

  if (cambios.usuario !== undefined && repo.existeUsuario(cambios.usuario, id)) {
    throw new ErrorNegocio(409, 'El nombre de usuario ya existe');
  }

  if (id === actorId && (!activoFinal || rolFinal !== 'administrador')) {
    throw new ErrorNegocio(409, 'No puedes desactivarte ni quitarte el rol de administrador');
  }
  const eraAdminActivo = actual.rol === 'administrador' && actual.activo === 1;
  if (eraAdminActivo && (rolFinal !== 'administrador' || !activoFinal) && repo.contarAdminsActivos() <= 1) {
    throw new ErrorNegocio(409, 'Debe quedar al menos un administrador activo');
  }

  const campos: repo.CamposActualizables = {};
  if (cambios.nombre !== undefined) campos.nombre = cambios.nombre;
  if (cambios.usuario !== undefined) campos.usuario = cambios.usuario;
  if (cambios.password !== undefined) campos.password_hash = bcrypt.hashSync(cambios.password, 10);
  if (cambios.rol !== undefined) campos.rol = cambios.rol;
  if (cambios.activo !== undefined) campos.activo = cambios.activo ? 1 : 0;
  if (grupoFinal !== actual.grupo_id) campos.grupo_id = grupoFinal;

  try {
    repo.actualizarUsuario(id, campos);
  } catch (e) {
    if (esDuplicadoSqlite(e)) throw new ErrorNegocio(409, 'El nombre de usuario ya existe');
    throw e;
  }
  return aDtoPublico(buscarPorId(id)!);
}