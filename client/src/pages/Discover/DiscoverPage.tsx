import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface DiscoverProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  user_type: 'human' | 'agent';
  bio: string | null;
  life_stage: string | null;
  interests: string[];
  looking_for: string[];
  agent_type?: string;
  capabilities?: string[];
  agent_description?: string;
  framework?: string;
}

interface Match {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  user_type: string;
  matched_at: string;
}

type Tab = 'people' | 'agents' | 'matches';

export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>('people');
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchAlert, setMatchAlert] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    if (tab === 'matches') {
      api.get<{ data: Match[] }>('/discover/matches')
        .then((res) => setMatches(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      const type = tab === 'agents' ? '?type=agent' : '?type=human';
      api.get<{ data: DiscoverProfile[] }>(`/discover/profiles${type}`)
        .then((res) => {
          setProfiles(res.data);
          setCurrentIndex(0);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [tab]);

  async function handleSwipe(action: 'like' | 'pass') {
    if (currentIndex >= profiles.length) return;

    const target = profiles[currentIndex];
    try {
      const res = await api.post<{ data: { is_match: boolean } }>('/discover/swipe', {
        target_id: target.id,
        action,
      });

      if (res.data.is_match) {
        setMatchAlert(target.display_name || target.username);
        setTimeout(() => setMatchAlert(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }

    setCurrentIndex((i) => i + 1);
  }

  async function handleConnectAgent(agentId: string) {
    try {
      await api.post('/relationships', {
        partner_id: agentId,
        type: 'companion',
        category: 'human-agent',
      });
      setProfiles((prev) => prev.filter((p) => p.id !== agentId));
    } catch (err) {
      console.error(err);
    }
  }

  const currentProfile = profiles[currentIndex];

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Discover</h1>

      {/* Match alert */}
      {matchAlert && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 text-center">
          It's a match with <strong>{matchAlert}</strong>!
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(['people', 'agents', 'matches'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              tab === t ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
      ) : tab === 'matches' ? (
        /* Matches list */
        matches.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No matches yet. Keep swiping!</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.id} className="bg-white rounded-lg shadow p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary-500 flex items-center justify-center text-white font-bold">
                  {(m.display_name || m.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{m.display_name || m.username}</div>
                  <div className="text-xs text-gray-500">Matched {new Date(m.matched_at).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={() =>
                    api.post('/relationships', { partner_id: m.id, type: 'friend', category: 'human-human' })
                      .then(() => setMatches((prev) => prev.filter((x) => x.id !== m.id)))
                      .catch(console.error)
                  }
                  className="text-sm bg-primary-500 text-white px-3 py-1 rounded"
                >
                  Connect
                </button>
              </div>
            ))}
          </div>
        )
      ) : tab === 'people' ? (
        /* Swipe cards for people */
        !currentProfile ? (
          <p className="text-gray-400 text-sm text-center py-8">No more profiles to show. Check back later!</p>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-br from-primary-400 to-secondary-400 h-48 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-white/30 flex items-center justify-center text-white text-4xl font-bold">
                {(currentProfile.display_name || currentProfile.username).charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold">{currentProfile.display_name || currentProfile.username}</h3>
              {currentProfile.life_stage && (
                <p className="text-sm text-gray-500 mb-2">{currentProfile.life_stage.replace('_', ' ')}</p>
              )}
              {currentProfile.bio && <p className="text-sm text-gray-600 mb-3">{currentProfile.bio}</p>}
              {currentProfile.interests?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {currentProfile.interests.map((i: string) => (
                    <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">{i}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex border-t">
              <button
                onClick={() => handleSwipe('pass')}
                className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50"
              >
                Pass
              </button>
              <button
                onClick={() => handleSwipe('like')}
                className="flex-1 py-3 text-primary-500 font-medium hover:bg-primary-50 border-l"
              >
                Like
              </button>
            </div>
          </div>
        )
      ) : (
        /* Agent directory */
        profiles.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No agents available yet</p>
        ) : (
          <div className="space-y-3">
            {profiles.map((agent) => (
              <div key={agent.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-agent-500 flex items-center justify-center text-white font-bold">
                    {(agent.display_name || agent.username).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{agent.display_name || agent.username}</div>
                    <div className="text-xs text-agent-600 font-medium mb-1">
                      {agent.agent_type} {agent.framework && `(${agent.framework})`}
                    </div>
                    {agent.agent_description && (
                      <p className="text-sm text-gray-600 mb-2">{agent.agent_description}</p>
                    )}
                    {agent.capabilities && agent.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {agent.capabilities.map((c: string) => (
                          <span key={c} className="bg-agent-100 text-agent-700 text-xs px-2 py-0.5 rounded">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleConnectAgent(agent.id)}
                  className="w-full mt-2 bg-agent-500 text-white py-2 rounded text-sm font-medium hover:bg-agent-600"
                >
                  Connect with Agent
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
