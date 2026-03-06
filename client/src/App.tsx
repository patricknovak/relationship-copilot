import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './context/authStore';
import { api } from './api/client';
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
import InsightsPage from './pages/Insights/InsightsPage';
import CheckInPage from './pages/CheckIn/CheckInPage';
import AgentDetailPage from './pages/AgentDetail/AgentDetailPage';
import OnboardingPage from './pages/Onboarding/OnboardingPage';
import PrivacyPage from './pages/Privacy/PrivacyPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) return;
    api.get<{ data: { onboarding_complete: boolean } }>('/auth/me')
      .then((res) => setOnboardingComplete(res.data.onboarding_complete ?? false))
      .catch(() => setOnboardingComplete(true)); // On error, don't block
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  // Still loading onboarding status
  if (onboardingComplete === null) {
    return <p className="p-4 text-gray-400">Loading...</p>;
  }

  // Redirect to onboarding if not complete (but not if already on onboarding page)
  if (!onboardingComplete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

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
            <Routes>
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route
                path="/*"
                element={
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
                      <Route path="/insights" element={<InsightsPage />} />
                      <Route path="/check-ins" element={<CheckInPage />} />
                      <Route path="/agents/:agentId" element={<AgentDetailPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/privacy" element={<PrivacyPage />} />
                    </Routes>
                  </Layout>
                }
              />
            </Routes>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
