
import express from 'express';
import request from 'supertest';
import { catalogosRouter } from './catalogos.routes';

const app = express();
app.use('/api/catalogos', catalogosRouter);

async function verificarCatalogos() {
  const rutas = [
    '/api/catalogos/categorias',
    '/api/catalogos/grupos'
  ];

  for (const ruta of rutas) {
    const respuesta = await request(app).get(ruta);

    console.log(`\nRuta: ${ruta}`);
    console.log(`Estado HTTP: ${respuesta.status}`);
    console.table(respuesta.body);

    if (respuesta.status !== 200) {
      throw new Error(`La ruta ${ruta} falló`);
    }
  }
}

verificarCatalogos().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
