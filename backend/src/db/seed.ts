import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { db, DATABASE_PATH } from './connection';
import { aplicarMigraciones } from './migrations';
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
 db.exec(fs.readFileSync(schemaPath, 'utf8'));
 aplicarMigraciones(db);
}
const groups=['Soporte general','Redes y conectividad','Aplicaciones','Identidades y correo'];
const categories:[string,string,string[]][]=[
 ['Hardware','Soporte general',['teclado','pantalla','impresora','mouse','monitor']],
 ['Software','Aplicaciones',['programa','aplicación','instalar','licencia','error']],
 ['Red','Redes y conectividad',['wifi','internet','router','conexión','ethernet']],
 ['Accesos','Identidades y correo',['contraseña','usuario bloqueado','iniciar sesión','permiso']],
 ['Correo','Identidades y correo',['correo','outlook','email','bandeja','adjunto']],
 ['Otros','Soporte general',[]]
];
const seed = db.transaction(()=>{
 const groupInsert=db.prepare('INSERT OR IGNORE INTO grupos(nombre) VALUES (?)');
 groups.forEach(g=>groupInsert.run(g));
 const getGroup=db.prepare('SELECT id FROM grupos WHERE nombre = ?');
 const insertCat=db.prepare('INSERT OR IGNORE INTO categorias(nombre,grupo_id) VALUES (?,?)');
 const insertWord=db.prepare('INSERT OR IGNORE INTO palabras_clave(categoria_id,palabra) VALUES (?,?)');
 for(const [name,group,words] of categories){
  const gid=(getGroup.get(group) as {id:number}).id;
  insertCat.run(name,gid);
  const cid=(db.prepare('SELECT id FROM categorias WHERE nombre=?').get(name) as {id:number}).id;
  for(const word of words) insertWord.run(cid,word);
 }
 const insertUser=db.prepare('INSERT OR IGNORE INTO usuarios(nombre,usuario,password_hash,rol,grupo_id) VALUES (?,?,?,?,?)');
 const hash=bcrypt.hashSync('Cambiar123!',10);
 insertUser.run('Administrador Demo','admin',hash,'administrador',null);
 insertUser.run('Agente Demo','agente',hash,'agente',null);
 insertUser.run('Técnico General','tecnico1',hash,'tecnico',(getGroup.get('Soporte general') as {id:number}).id);
 insertUser.run('Técnico Redes','tecnico2',hash,'tecnico',(getGroup.get('Redes y conectividad') as {id:number}).id);
 insertUser.run('Técnico Aplicaciones','tecnico3',hash,'tecnico',(getGroup.get('Aplicaciones') as {id:number}).id);
 insertUser.run('Técnico Accesos','tecnico4',hash,'tecnico',(getGroup.get('Identidades y correo') as {id:number}).id);
});
seed();
console.log(`Datos de demostración preparados: ${DATABASE_PATH}`);
console.log('Credenciales SOLO para desarrollo: admin / agente / tecnico1..4 | clave Cambiar123!');
