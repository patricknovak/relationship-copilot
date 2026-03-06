import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

interface HealthDashboard {
  total_relationships: number;
  average_health: number;
  relationships: {
    id: string;
    type: string;
    category: string;
    health_score: number;
    streak_count: number;
    partner_username: string;
    partner_display_name: string;
  }[];
  needs_attention: {
    id: string;
    type: string;
    health_score: number;
    partner_username: string;
    partner_display_name: string;
  }[];
}

interface Pattern {
  id: string;
  relationship_id: string;
  pattern_type: string;
  description: string;
  severity: string;
  suggestion: string;
  detected_at: string;
  relationship_type: string;
  partner_username: string;
  partner_display_name: string;
}

export default function HealthCenterPage() {
  const [dashboard, setDashboard] = useState<HealthDashboard | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ data: HealthDashboard }>('/health/dashboard'),
      api.get<{ data: Pattern[] }>('/patterns'),
    ])
      .then(([healthRes, patternsRes]) => {
        setDashboard(healthRes.data);
        setPatterns(patternsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-4 text-gray-400">Loading...</p>;

  function healthColor(score: number) {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  }

  function healthBg(score: number) {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  function severityColor(severity: string) {
    if (severity === 'critical') return 'bg-red-100 border-red-300 text-red-800';
    if (severity === 'warning') return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    return 'bg-blue-100 border-blue-300 text-blue-800';
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Health Center</h1>

      {/* Overall health */}
      {dashboard && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center gap-4 mb-3">
            <div className={`text-4xl font-bold ${healthColor(dashboard.average_health)}`}>
              {dashboard.average_health}
            </div>
            <div>
              <div className="font-medium">Average Health</div>
              <div className="text-sm text-gray-500">
                Across {dashboard.total_relationships} relationship{dashboard.total_relationships !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Health bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${healthBg(dashboard.average_health)}`}
              style={{ width: `${dashboard.average_health}%` }}
            />
          </div>
        </div>
      )}

      {/* Patterns / Alerts */}
      {patterns.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold mb-2">Detected Patterns</h2>
          <div className="space-y-2">
            {patterns.map((p) => (
              <div key={p.id} className={`rounded-lg border p-3 ${severityColor(p.severity)}`}>
                <div className="flex justify-between items-start mb-1">
                  <div className="font-medium text-sm">
                    {p.partner_display_name || p.partner_username} ({p.relationship_type})
                  </div>
                  <span className="text-xs uppercase font-semibold">{p.severity}</span>
                </div>
                <p className="text-sm mb-1">{p.description}</p>
                {p.suggestion && (
                  <p className="text-xs italic">Suggestion: {p.suggestion}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Needs attention */}
      {dashboard && dashboard.needs_attention.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold mb-2">Needs Attention</h2>
          <div className="space-y-2">
            {dashboard.needs_attention.map((r) => (
              <Link
                key={r.id}
                to={`/chat/${r.id}`}
                className="block bg-white rounded-lg shadow p-3 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.partner_display_name || r.partner_username}</div>
                    <div className="text-xs text-gray-500">{r.type}</div>
                  </div>
                  <div className={`text-lg font-bold ${healthColor(r.health_score)}`}>
                    {r.health_score}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All relationships by health */}
      {dashboard && (
        <div>
          <h2 className="font-semibold mb-2">All Relationships</h2>
          <div className="space-y-2">
            {dashboard.relationships.map((r) => (
              <Link
                key={r.id}
                to={`/chat/${r.id}`}
                className="block bg-white rounded-lg shadow p-3 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium">{r.partner_display_name || r.partner_username}</div>
                  <span className={`font-bold ${healthColor(r.health_score)}`}>{r.health_score}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${healthBg(r.health_score)}`}
                    style={{ width: `${r.health_score}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>{r.type}</span>
                  {r.streak_count > 0 && <span>{r.streak_count}d streak</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
