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

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const [relationships, setRelationships] = useState<RelationshipSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ data: RelationshipSummary[] }>('/relationships?status=active')
      .then((res) => setRelationships(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const avgHealth =
    relationships.length > 0
      ? Math.round(relationships.reduce((sum, r) => sum + r.health_score, 0) / relationships.length)
      : 0;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold">Welcome, {user?.username}</h1>
        <p className="text-gray-500 text-sm">Your relationship dashboard</p>
      </div>

      {/* Health Overview */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="font-semibold mb-2">Relationship Health</h2>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-primary-500">{avgHealth}</div>
          <div className="text-sm text-gray-500">
            Average health across {relationships.length} relationship{relationships.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4">
        <Link
          to="/relationships"
          className="flex-1 bg-primary-500 text-white text-center py-2 rounded text-sm font-medium"
        >
          My Relationships
        </Link>
        <Link
          to="/discover"
          className="flex-1 bg-secondary-500 text-white text-center py-2 rounded text-sm font-medium"
        >
          Discover
        </Link>
      </div>

      {/* Relationships needing attention */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : relationships.length === 0 ? (
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
            {relationships.map((r) => (
              <Link
                key={r.id}
                to={`/chat/${r.id}`}
                className="block bg-white rounded-lg shadow p-3 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.partner_display_name || r.partner_username}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-white text-xs ${
                        r.partner_user_type === 'agent' ? 'bg-agent-500' : 'bg-secondary-500'
                      }`}>
                        {r.type}
                      </span>
                      {r.streak_count > 0 && <span>Streak: {r.streak_count}</span>}
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${
                    r.health_score >= 70 ? 'text-green-500' :
                    r.health_score >= 40 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {r.health_score}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
