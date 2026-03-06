import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

interface Relationship {
  id: string;
  type: string;
  category: string;
  status: string;
  health_score: number;
  streak_count: number;
  last_interaction: string | null;
  partner_username: string;
  partner_display_name: string;
  partner_user_type: string;
}

type Filter = 'all' | 'human' | 'agent';

export default function RelationshipsPage() {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ data: Relationship[] }>('/relationships')
      .then((res) => setRelationships(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = relationships.filter((r) => {
    if (filter === 'human' && r.partner_user_type !== 'human') return false;
    if (filter === 'agent' && r.partner_user_type !== 'agent') return false;
    if (search) {
      const name = (r.partner_display_name || r.partner_username).toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Relationships</h1>

      {/* Search */}
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-3"
      />

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {(['all', 'human', 'agent'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm font-medium ${
              filter === f ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No relationships found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Link
              key={r.id}
              to={`/chat/${r.id}`}
              className="block bg-white rounded-lg shadow p-3 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    r.partner_user_type === 'agent' ? 'bg-agent-500' : 'bg-secondary-500'
                  }`}>
                    {(r.partner_display_name || r.partner_username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{r.partner_display_name || r.partner_username}</div>
                    <div className="text-xs text-gray-500 flex gap-2">
                      <span>{r.type}</span>
                      <span className={`${
                        r.status === 'active' ? 'text-green-500' :
                        r.status === 'pending' ? 'text-yellow-500' : 'text-gray-400'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${
                    r.health_score >= 70 ? 'text-green-500' :
                    r.health_score >= 40 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {r.health_score}
                  </div>
                  {r.streak_count > 0 && (
                    <div className="text-xs text-gray-400">{r.streak_count}d streak</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
