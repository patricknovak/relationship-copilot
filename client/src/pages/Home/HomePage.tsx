import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../context/authStore';

interface RelationshipSummary {
  id: string;
  type: string;
  category: string;
  health_score: number;
  streak_count: number;
  partner_username: string;
  partner_display_name: string;
  partner_user_type: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at: string;
}

interface Milestone {
  id: string;
  title: string;
  date: string;
  milestone_type: string;
  partner_username: string;
  partner_display_name: string;
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const [relationships, setRelationships] = useState<RelationshipSummary[]>([]);
  const [points, setPoints] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ data: RelationshipSummary[] }>('/relationships?status=active'),
      api.get<{ data: { total: number } }>('/gamification/points'),
      api.get<{ data: Achievement[] }>('/gamification/achievements'),
      api.get<{ data: Milestone[] }>('/milestones/upcoming').catch(() => ({ data: [] })),
    ])
      .then(([relRes, pointsRes, achieveRes, mileRes]) => {
        setRelationships(relRes.data);
        setPoints(pointsRes.data.total);
        setAchievements(achieveRes.data);
        setMilestones(mileRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const avgHealth =
    relationships.length > 0
      ? Math.round(relationships.reduce((sum, r) => sum + r.health_score, 0) / relationships.length)
      : 0;

  const totalStreaks = relationships.reduce((sum, r) => sum + (r.streak_count > 0 ? 1 : 0), 0);
  const needsAttention = relationships.filter((r) => r.health_score < 40);

  if (loading) return <p className="p-4 text-gray-400">Loading...</p>;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold">Welcome, {user?.username}</h1>
        <p className="text-gray-500 text-sm">Your relationship dashboard</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <div className={`text-2xl font-bold ${
            avgHealth >= 70 ? 'text-green-500' : avgHealth >= 40 ? 'text-yellow-500' : 'text-red-500'
          }`}>
            {avgHealth}
          </div>
          <div className="text-xs text-gray-500">Avg Health</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <div className="text-2xl font-bold text-primary-500">{points}</div>
          <div className="text-xs text-gray-500">Points</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <div className="text-2xl font-bold text-secondary-500">{totalStreaks}</div>
          <div className="text-xs text-gray-500">Streaks</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4">
        <Link to="/relationships" className="flex-1 bg-primary-500 text-white text-center py-2 rounded text-sm font-medium">
          Relationships
        </Link>
        <Link to="/discover" className="flex-1 bg-secondary-500 text-white text-center py-2 rounded text-sm font-medium">
          Discover
        </Link>
        <Link to="/health" className="flex-1 bg-green-500 text-white text-center py-2 rounded text-sm font-medium">
          Health
        </Link>
      </div>

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold mb-2 text-red-500">Needs Attention</h2>
          <div className="space-y-2">
            {needsAttention.map((r) => (
              <Link key={r.id} to={`/chat/${r.id}`} className="block bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.partner_display_name || r.partner_username}</div>
                    <div className="text-xs text-red-500">{r.type} - Health: {r.health_score}</div>
                  </div>
                  <span className="text-red-500 text-sm">View</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming milestones */}
      {milestones.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold mb-2">Upcoming Milestones</h2>
          <div className="space-y-2">
            {milestones.slice(0, 3).map((m) => (
              <div key={m.id} className="bg-white rounded-lg shadow p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 text-sm">
                  M
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{m.title}</div>
                  <div className="text-xs text-gray-500">
                    {m.partner_display_name || m.partner_username} - {new Date(m.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent achievements */}
      {achievements.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold mb-2">Achievements</h2>
          <div className="flex flex-wrap gap-2">
            {achievements.slice(0, 6).map((a) => (
              <div key={a.id} className="bg-white rounded-lg shadow px-3 py-2 text-center min-w-[80px]">
                <div className="text-lg mb-0.5">{a.icon === 'fire' ? '🔥' : a.icon === 'link' ? '🔗' : a.icon === 'robot' ? '🤖' : a.icon === 'trophy' ? '🏆' : a.icon === 'heart' ? '❤️' : '⭐'}</div>
                <div className="text-xs font-medium">{a.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connections */}
      {relationships.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-gray-500 mb-2">No active relationships yet</p>
          <Link to="/discover" className="text-primary-500 text-sm hover:underline">
            Find connections
          </Link>
        </div>
      ) : (
        <div>
          <h2 className="font-semibold mb-2">Your Connections</h2>
          <div className="space-y-2">
            {relationships.slice(0, 5).map((r) => (
              <Link key={r.id} to={`/chat/${r.id}`} className="block bg-white rounded-lg shadow p-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      r.partner_user_type === 'agent' ? 'bg-agent-500' : 'bg-secondary-500'
                    }`}>
                      {(r.partner_display_name || r.partner_username).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{r.partner_display_name || r.partner_username}</div>
                      <div className="text-xs text-gray-400">{r.type} {r.streak_count > 0 ? `• ${r.streak_count}d streak` : ''}</div>
                    </div>
                  </div>
                  <div className={`font-bold text-sm ${
                    r.health_score >= 70 ? 'text-green-500' : r.health_score >= 40 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {r.health_score}
                  </div>
                </div>
              </Link>
            ))}
            {relationships.length > 5 && (
              <Link to="/relationships" className="block text-center text-sm text-primary-500 py-2">
                View all {relationships.length} relationships
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
