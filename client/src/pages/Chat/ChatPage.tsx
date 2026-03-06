import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../context/authStore';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  message_type: string;
  sender_username: string;
  sender_display_name: string;
  sender_user_type: string;
  created_at: string;
}

interface RelationshipDetail {
  id: string;
  type: string;
  category: string;
  health_score: number;
  streak_count: number;
  partner_id: string;
  partner_username: string;
  partner_display_name: string;
  partner_user_type: string;
}

interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  progress: number;
  created_by_username: string;
}

interface CompatScore {
  overall_score: number;
  western_score: number;
  chinese_score: number;
  details: Record<string, string>;
}

export default function ChatPage() {
  const { relationshipId } = useParams<{ relationshipId: string }>();
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [relationship, setRelationship] = useState<RelationshipDetail | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [compatibility, setCompatibility] = useState<CompatScore | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!relationshipId) return;

    api.get<{ data: RelationshipDetail }>(`/relationships/${relationshipId}`)
      .then((res) => {
        setRelationship(res.data);
        // Load compatibility
        api.get<{ data: CompatScore }>(`/zodiac/compatibility/${res.data.partner_id}`)
          .then((compRes) => setCompatibility(compRes.data))
          .catch(() => {});
      })
      .catch(console.error);

    api.get<{ data: Message[] }>(`/messages/${relationshipId}`)
      .then((res) => setMessages(res.data))
      .catch(console.error);

    api.get<{ data: Goal[] }>(`/goals/${relationshipId}`)
      .then((res) => setGoals(res.data))
      .catch(() => {});
  }, [relationshipId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await api.post<{ data: Message }>(`/messages/${relationshipId}`, {
        content: newMessage.trim(),
      });
      setMessages((prev) => [...prev, {
        ...res.data,
        sender_username: user!.username,
        sender_display_name: '',
        sender_user_type: 'human',
      }]);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    try {
      const res = await api.post<{ data: Goal }>('/goals', {
        relationship_id: relationshipId,
        title: newGoalTitle.trim(),
      });
      setGoals((prev) => [{ ...res.data, created_by_username: user!.username }, ...prev]);
      setNewGoalTitle('');
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpdateGoalProgress(goalId: string, progress: number) {
    try {
      await api.put(`/goals/${goalId}`, {
        progress,
        status: progress >= 100 ? 'completed' : 'active',
      });
      setGoals((prev) =>
        prev.map((g) => g.id === goalId ? { ...g, progress, status: progress >= 100 ? 'completed' : 'active' } : g)
      );
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/relationships" className="text-gray-500">&larr;</Link>
          <div className="flex-1">
            <div className="font-medium">
              {relationship?.partner_display_name || relationship?.partner_username || 'Loading...'}
            </div>
            <div className="text-xs text-gray-500 flex gap-2">
              {relationship && (
                <>
                  <span>{relationship.type}</span>
                  <span className={
                    relationship.health_score >= 70 ? 'text-green-500' :
                    relationship.health_score >= 40 ? 'text-yellow-500' : 'text-red-500'
                  }>
                    Health: {relationship.health_score}
                  </span>
                  {relationship.streak_count > 0 && <span>Streak: {relationship.streak_count}</span>}
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
          >
            {showDetails ? 'Chat' : 'Details'}
          </button>
        </div>
      </div>

      {showDetails ? (
        /* Relationship Details Panel */
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
          {/* Compatibility */}
          {compatibility && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-2">Compatibility</h3>
              <div className="text-center mb-3">
                <div className="text-3xl font-bold text-secondary-500">{compatibility.overall_score}%</div>
                <div className="text-xs text-gray-500">Overall Compatibility</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-center">
                  <div className="font-medium">{compatibility.western_score}%</div>
                  <div className="text-xs text-gray-500">Western Zodiac</div>
                </div>
                <div className="text-center">
                  <div className="font-medium">{compatibility.chinese_score}%</div>
                  <div className="text-xs text-gray-500">Chinese Zodiac</div>
                </div>
              </div>
              {compatibility.details && (
                <div className="mt-2 text-xs text-gray-400 flex justify-center gap-3">
                  {compatibility.details.user_western && <span>You: {compatibility.details.user_western}</span>}
                  {compatibility.details.partner_western && <span>Partner: {compatibility.details.partner_western}</span>}
                </div>
              )}
            </div>
          )}

          {/* Goals */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Shared Goals</h3>

            {goals.filter((g) => g.status === 'active').map((goal) => (
              <div key={goal.id} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{goal.title}</span>
                  <span className="text-gray-400">{goal.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-secondary-500 transition-all"
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
                <div className="flex gap-1 mt-1">
                  {[25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() => handleUpdateGoalProgress(goal.id, p)}
                      className="text-xs bg-gray-100 px-2 py-0.5 rounded hover:bg-gray-200"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {goals.filter((g) => g.status === 'completed').length > 0 && (
              <div className="mt-2 text-xs text-gray-400">
                {goals.filter((g) => g.status === 'completed').length} goal(s) completed
              </div>
            )}

            <form onSubmit={handleAddGoal} className="flex gap-2 mt-3">
              <input
                type="text"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                placeholder="Add a goal..."
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                type="submit"
                className="bg-secondary-500 text-white px-3 py-1 rounded text-sm"
              >
                Add
              </button>
            </form>
          </div>

          {/* Streak check-in */}
          <button
            onClick={async () => {
              try {
                const res = await api.post<{ data: { streak_count: number; already_checked_in: boolean } }>(
                  `/gamification/streaks/${relationshipId}/check-in`
                );
                if (res.data.already_checked_in) {
                  alert('Already checked in today!');
                } else {
                  alert(`Streak: ${res.data.streak_count} days!`);
                  if (relationship) {
                    setRelationship({ ...relationship, streak_count: res.data.streak_count });
                  }
                }
              } catch (err) {
                console.error(err);
              }
            }}
            className="w-full bg-primary-500 text-white py-3 rounded-lg font-medium"
          >
            Daily Check-in
          </button>
        </div>
      ) : (
        /* Messages */
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No messages yet. Say hello!</p>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                        isMine
                          ? 'bg-primary-500 text-white'
                          : msg.sender_user_type === 'agent'
                            ? 'bg-agent-100 text-agent-900'
                            : 'bg-white text-gray-800 shadow'
                      }`}
                    >
                      {!isMine && (
                        <div className="text-xs font-medium mb-0.5 opacity-70">
                          {msg.sender_display_name || msg.sender_username}
                        </div>
                      )}
                      <div>{msg.content}</div>
                      <div className="text-xs opacity-50 mt-0.5">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="bg-white border-t p-3 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="bg-primary-500 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
