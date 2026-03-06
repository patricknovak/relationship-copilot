import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../context/authStore';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  life_stage: string | null;
  onboarding_complete: boolean;
  created_at: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ data: UserProfile }>('/auth/me')
      .then((res) => setProfile(res.data))
      .catch(console.error);
  }, []);

  function handleLogout() {
    api.post('/auth/logout').catch(() => {});
    logout();
    navigate('/login');
  }

  if (!profile) return <p className="p-4 text-gray-400">Loading...</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Profile</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center text-white text-xl font-bold">
            {(profile.display_name || profile.username).charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold">{profile.display_name || profile.username}</div>
            <div className="text-sm text-gray-500">@{profile.username}</div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span>{profile.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Life Stage</span>
            <span>{profile.life_stage || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Bio</span>
            <span>{profile.bio || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Member since</span>
            <span>{new Date(profile.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-red-500 text-white py-2 rounded font-medium hover:bg-red-600"
      >
        Sign Out
      </button>
    </div>
  );
}
