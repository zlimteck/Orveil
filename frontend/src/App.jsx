import React from 'react';
import { Routes, Route, Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LangProvider } from './context/LangContext';
import { ToastProvider } from './context/ToastContext';
import Stats from './pages/Stats';
import Topology from './pages/Topology';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Logs from './pages/Logs';
import Incidents from './pages/Incidents';
import Timeline from './pages/Timeline';
import Settings from './pages/Settings';
import ApiDocs from './pages/ApiDocs';
import Login from './pages/Login';
import OAuthConsent from './pages/OAuthConsent';
import StatusPage from './pages/StatusPage';
import NotFound from './pages/NotFound';
import KonamiEasterEgg from './components/KonamiEasterEgg';

function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-muted text-sm">Chargement…</p>
    </div>
  );
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

// Same-origin-only redirect resolution, mirrored from Login.jsx's resolveContinue.
function resolveContinue(raw) {
  if (!raw) return '/';
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return '/';
    return url.pathname + url.search;
  } catch {
    return '/';
  }
}

function LoginGuard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  return user ? <Navigate to={resolveContinue(searchParams.get('continue'))} replace /> : <Login />;
}

export default function App() {
  return (
    <ThemeProvider>
    <LangProvider>
    <AuthProvider>
    <ToastProvider>
      <Routes>
        <Route path="/status" element={<StatusPage />} />
        <Route path="/login" element={<LoginGuard />} />
        <Route path="/oauth/authorize" element={<OAuthConsent />} />
        <Route path="*" element={<NotFound />} />
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="monitors" element={<Services />} />
            <Route path="logs" element={<Logs />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="settings" element={<Settings />} />
            <Route path="docs" element={<ApiDocs />} />
            <Route path="stats" element={<Stats />} />
            <Route path="topology" element={<Topology />} />
          </Route>
        </Route>
      </Routes>
      <KonamiEasterEgg />
    </ToastProvider>
    </AuthProvider>
    </LangProvider>
    </ThemeProvider>
  );
}
