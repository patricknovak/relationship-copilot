import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './context/authStore';
import Layout from './components/layout/Layout';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import HomePage from './pages/Home/HomePage';
import RelationshipsPage from './pages/Relationships/RelationshipsPage';
import ChatPage from './pages/Chat/ChatPage';
import ProfilePage from './pages/Profile/ProfilePage';
import DiscoverPage from './pages/Discover/DiscoverPage';
import HealthCenterPage from './pages/Health/HealthCenterPage';
import WikiPage from './pages/Wiki/WikiPage';
import CoachingPage from './pages/Coaching/CoachingPage';
import LifeStagesPage from './pages/LifeStages/LifeStagesPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/relationships" element={<RelationshipsPage />} />
                <Route path="/chat/:relationshipId" element={<ChatPage />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/health" element={<HealthCenterPage />} />
                <Route path="/wiki" element={<WikiPage />} />
                <Route path="/coaching" element={<CoachingPage />} />
                <Route path="/life-stages" element={<LifeStagesPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
