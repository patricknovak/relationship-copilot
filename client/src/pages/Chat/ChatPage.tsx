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
  partner_username: string;
  partner_display_name: string;
  partner_user_type: string;
}

export default function ChatPage() {
  const { relationshipId } = useParams<{ relationshipId: string }>();
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [relationship, setRelationship] = useState<RelationshipDetail | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!relationshipId) return;

    // Load relationship detail
    api.get<{ data: RelationshipDetail }>(`/relationships/${relationshipId}`)
      .then((res) => setRelationship(res.data))
      .catch(console.error);

    // Load messages
    api.get<{ data: Message[] }>(`/messages/${relationshipId}`)
      .then((res) => setMessages(res.data))
      .catch(console.error);
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
      setMessages((prev) => [...prev, { ...res.data, sender_username: user!.username, sender_display_name: '', sender_user_type: 'human' }]);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
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
      </div>

      {/* Messages */}
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

      {/* Input */}
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
    </div>
  );
}
