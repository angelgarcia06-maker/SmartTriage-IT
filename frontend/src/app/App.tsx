import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from '../modules/auth/LoginPage';
import UsuariosPage from '../modules/auth/UsuariosPage';
import RutaProtegida from '../modules/auth/RutaProtegida';
import { useAuth } from '../modules/auth/useAuth';
import Layout from './Layout';
import InicioPage from './InicioPage';

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
          path="usuarios"
          element={
            <RutaProtegida roles={['administrador']}>
              <UsuariosPage />
            </RutaProtegida>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
