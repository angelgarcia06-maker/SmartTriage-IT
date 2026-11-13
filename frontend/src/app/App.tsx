import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from '../modules/auth/LoginPage';
import UsuariosPage from '../modules/auth/UsuariosPage';
import RutaProtegida from '../modules/auth/RutaProtegida';
import { useAuth } from '../modules/auth/useAuth';
import Layout from './Layout';
import InicioPage from './InicioPage';
import TriajePage from '../modules/triaje/TriajePage';
import { CatalogosPanel } from '../modules/admin/CatalogosPanel';
import { DiccionarioPanel } from '../modules/admin/DiccionarioPanel';
import { DashboardPanel } from '../modules/admin/DashboardPanel';

/** /login: si ya hay sesión, redirige al inicio; si no, muestra el formulario. */
function RutaLogin() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <p className="p-4">Cargando...</p>;
  if (usuario) return <Navigate to="/" replace />;
  return <LoginPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<RutaLogin />} />

      {/* Todo lo demás exige sesión. El rol se comprueba además en el backend. */}
      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route index element={<InicioPage />} />
        <Route
          path="triaje"
          element={
            <RutaProtegida roles={['agente', 'administrador']}>
              <TriajePage />
            </RutaProtegida>
          }
        />
        <Route
          path="usuarios"
          element={
            <RutaProtegida roles={['administrador']}>
              <UsuariosPage />
            </RutaProtegida>
          }
        />
        <Route
          path="admin/dashboard"
          element={
            <RutaProtegida roles={['administrador']}>
              <DashboardPanel />
            </RutaProtegida>
          }
        />
        <Route
          path="admin/catalogos"
          element={
            <RutaProtegida roles={['administrador']}>
              <CatalogosPanel />
            </RutaProtegida>
          }
        />
        <Route
          path="admin/diccionario"
          element={
            <RutaProtegida roles={['administrador']}>
              <DiccionarioPanel />
            </RutaProtegida>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
