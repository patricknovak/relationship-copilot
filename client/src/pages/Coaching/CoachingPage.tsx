import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuthStore } from '../../context/authStore';

interface Coach {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  agent_type: string;
  capabilities: string[];
  description: string;
  framework: string;
  avg_rating: number;
  review_count: number;
}

interface Session {
  id: string;
  agent_id: string;
  relationship_id: string | null;
  topic: string | null;
  category: string | null;
  status: string;
  session_data: { messages?: { sender_id: string; content: string; timestamp: string }[] };
  goals: unknown[];
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  agent_username: string;
  agent_display_name: string;
}

interface Relationship {
  id: string;
  partner_username: string;
  partner_display_name: string;
  type: string;
}

export default function CoachingPage() {
  const user = useAuthStore((s) => s.user);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sessions' | 'coaches'>('sessions');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messageText, setMessageText] = useState('');

  // New session form
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState('');
  const [selectedRelationship, setSelectedRelationship] = useState('');
  const [sessionTopic, setSessionTopic] = useState('');
  const [sessionCategory, setSessionCategory] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [coachRes, sessionRes, relRes] = await Promise.all([
        api.get<{ data: Coach[] }>('/coaching/coaches'),
        api.get<{ data: Session[] }>('/coaching/sessions'),
        api.get<{ data: Relationship[] }>('/relationships'),
      ]);
      setCoaches(coachRes.data);
      setSessions(sessionRes.data);
      setRelationships(relRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function startSession(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCoach) return;

    try {
      const res = await api.post<{ data: Session }>('/coaching/sessions', {
        agent_id: selectedCoach,
        relationship_id: selectedRelationship || null,
        topic: sessionTopic || null,
        category: sessionCategory || null,
      });
      setSessions((prev) => [{ ...res.data, agent_username: '', agent_display_name: '' }, ...prev]);
      setShowNewSession(false);
      setSelectedCoach('');
      setSelectedRelationship('');
      setSessionTopic('');
      setSessionCategory('');
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function sendMessage() {
    if (!messageText.trim() || !activeSession) return;
    try {
      await api.post(`/coaching/sessions/${activeSession.id}/message`, { content: messageText.trim() });

      // Optimistically update UI
      const sessionData = activeSession.session_data || {};
      const messages = sessionData.messages || [];
      messages.push({
        sender_id: user!.id,
        content: messageText.trim(),
        timestamp: new Date().toISOString(),
      });

      setActiveSession({ ...activeSession, session_data: { ...sessionData, messages } });
      setMessageText('');
    } catch (err) {
      console.error(err);
    }
  }

  async function endSession(sessionId: string) {
    try {
      await api.put(`/coaching/sessions/${sessionId}/end`);
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, status: 'completed' } : s));
      if (activeSession?.id === sessionId) setActiveSession(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadSession(sessionId: string) {
    try {
      const res = await api.get<{ data: Session }>(`/coaching/sessions/${sessionId}`);
      setActiveSession(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  const categories = ['communication', 'conflict', 'growth', 'parenting', 'career', 'exit_planning', 'general'];

  if (loading) return <p className="p-4 text-gray-400">Loading...</p>;

  // Active session view
  if (activeSession) {
    const messages = activeSession.session_data?.messages || [];

    return (
      <div className="flex flex-col h-screen">
        <div className="bg-white border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveSession(null)} className="text-gray-500">&larr;</button>
            <div className="flex-1">
              <div className="font-medium">{activeSession.agent_display_name || activeSession.agent_username || 'Coach'}</div>
              <div className="text-xs text-gray-500">
                {activeSession.topic || activeSession.category || 'Coaching Session'}
                <span className={`ml-2 ${activeSession.status === 'active' ? 'text-green-500' : 'text-gray-400'}`}>
                  {activeSession.status}
                </span>
              </div>
            </div>
            {activeSession.status === 'active' && (
              <button
                onClick={() => endSession(activeSession.id)}
                className="text-sm text-red-500 px-2 py-1 rounded hover:bg-red-50"
              >
                End
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              Session started. Send your first message to begin coaching.
            </p>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div key={idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    isMine ? 'bg-primary-500 text-white' : 'bg-agent-100 text-agent-900'
                  }`}>
                    <div>{msg.content}</div>
                    <div className="text-xs opacity-50 mt-0.5">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {activeSession.summary && (
            <div className="bg-white rounded-lg shadow p-3 mt-4">
              <div className="text-xs font-semibold text-gray-500 mb-1">Session Summary</div>
              <p className="text-sm">{activeSession.summary}</p>
            </div>
          )}
        </div>

        {activeSession.status === 'active' && (
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="bg-white border-t p-3 flex gap-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!messageText.trim()}
              className="bg-primary-500 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              Send
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Coaching</h1>
        <button
          onClick={() => setShowNewSession(!showNewSession)}
          className="bg-primary-500 text-white px-3 py-1.5 rounded text-sm"
        >
          {showNewSession ? 'Cancel' : 'New Session'}
        </button>
      </div>

      {/* New session form */}
      {showNewSession && (
        <form onSubmit={startSession} className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
          <select
            value={selectedCoach}
            onChange={(e) => setSelectedCoach(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">Select a coach...</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name || c.username} ({c.agent_type}) - {Number(c.avg_rating).toFixed(1)} stars
              </option>
            ))}
          </select>

          <select
            value={selectedRelationship}
            onChange={(e) => setSelectedRelationship(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">About a relationship (optional)...</option>
            {relationships.map((r) => (
              <option key={r.id} value={r.id}>
                {r.partner_display_name || r.partner_username} ({r.type})
              </option>
            ))}
          </select>

          <select
            value={sessionCategory}
            onChange={(e) => setSessionCategory(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Category (optional)...</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <input
            type="text"
            value={sessionTopic}
            onChange={(e) => setSessionTopic(e.target.value)}
            placeholder="Topic (optional)"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />

          <button
            type="submit"
            disabled={!selectedCoach}
            className="w-full bg-secondary-500 text-white py-2 rounded font-medium disabled:opacity-50"
          >
            Start Session
          </button>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            activeTab === 'sessions' ? 'bg-secondary-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          My Sessions
        </button>
        <button
          onClick={() => setActiveTab('coaches')}
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            activeTab === 'coaches' ? 'bg-secondary-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Browse Coaches
        </button>
      </div>

      {activeTab === 'sessions' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No coaching sessions yet. Start one above!</p>
          ) : (
            <>
              {sessions.filter((s) => s.status === 'active').length > 0 && (
                <div className="mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Active</h3>
                  {sessions.filter((s) => s.status === 'active').map((session) => (
                    <div
                      key={session.id}
                      onClick={() => loadSession(session.id)}
                      className="bg-white rounded-lg shadow p-3 mb-2 cursor-pointer hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-sm">{session.agent_display_name || session.agent_username}</div>
                          <div className="text-xs text-gray-500">{session.topic || session.category || 'General coaching'}</div>
                        </div>
                        <span className="text-xs text-green-500 font-medium">Active</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {sessions.filter((s) => s.status === 'completed').length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Past Sessions</h3>
                  {sessions.filter((s) => s.status === 'completed').map((session) => (
                    <div
                      key={session.id}
                      onClick={() => loadSession(session.id)}
                      className="bg-white rounded-lg shadow p-3 mb-2 cursor-pointer hover:bg-gray-50 opacity-70"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-sm">{session.agent_display_name || session.agent_username}</div>
                          <div className="text-xs text-gray-500">{session.topic || session.category || 'General coaching'}</div>
                        </div>
                        <span className="text-xs text-gray-400">Completed</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'coaches' && (
        <div className="space-y-3">
          {coaches.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No coach agents available yet.</p>
          ) : (
            coaches.map((coach) => (
              <div key={coach.id} className="bg-white rounded-lg shadow p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">{coach.display_name || coach.username}</div>
                    <div className="text-xs text-gray-500">{coach.agent_type} &middot; {coach.framework}</div>
                    {coach.description && <p className="text-xs text-gray-600 mt-1">{coach.description}</p>}
                    <div className="flex gap-1 mt-1">
                      {(coach.capabilities || []).slice(0, 3).map((cap, i) => (
                        <span key={i} className="text-xs bg-agent-100 text-agent-700 px-1.5 py-0.5 rounded">{cap}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-yellow-500">
                      {Number(coach.avg_rating).toFixed(1)} stars
                    </div>
                    <div className="text-xs text-gray-400">{coach.review_count} reviews</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCoach(coach.id);
                    setShowNewSession(true);
                    setActiveTab('sessions');
                  }}
                  className="mt-2 w-full bg-secondary-500 text-white py-1.5 rounded text-sm"
                >
                  Start Session
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
