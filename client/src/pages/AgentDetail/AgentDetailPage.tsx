import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

interface Agent {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  agent_type: string;
  capabilities: string[];
  description: string;
  framework: string;
  status: string;
  created_at: string;
}

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  reviewer_username: string;
  reviewer_display_name: string;
  created_at: string;
}

interface Tool {
  id: string;
  tool_name: string;
  description: string;
  category: string | null;
  input_schema: Record<string, unknown> | null;
}

interface Skill {
  skill_name: string;
  category: string | null;
  level: number;
  xp: number;
}

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState({ total: 0, avg_rating: 0 });
  const [tools, setTools] = useState<Tool[]>([]);
  const [skills, _setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'tools' | 'skills'>('overview');

  // Review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  useEffect(() => {
    if (agentId) loadAgent();
  }, [agentId]);

  async function loadAgent() {
    setLoading(true);
    try {
      const [agentRes, reviewsRes, toolsRes] = await Promise.all([
        api.get<{ data: Agent }>(`/agents/${agentId}`),
        api.get<{ data: { reviews: Review[]; stats: typeof reviewStats } }>(`/agents/${agentId}/reviews`),
        api.get<{ data: Tool[] }>(`/agents/${agentId}/tools`),
      ]);
      setAgent(agentRes.data);
      setReviews(reviewsRes.data.reviews);
      setReviewStats(reviewsRes.data.stats);
      setTools(toolsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function submitReview() {
    try {
      await api.post(`/agents/${agentId}/reviews`, { rating, review_text: reviewText || null });
      setShowReviewForm(false);
      setRating(5);
      setReviewText('');
      loadAgent();
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) return <p className="p-4 text-gray-400">Loading...</p>;
  if (!agent) return <p className="p-4 text-gray-400">Agent not found.</p>;

  return (
    <div className="p-4">
      <button onClick={() => navigate(-1)} className="text-gray-500 mb-3">&larr; Back</button>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 bg-agent-100 rounded-full flex items-center justify-center text-agent-700 text-xl font-bold">
            {(agent.display_name || agent.username).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{agent.display_name || agent.username}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs bg-agent-100 text-agent-700 px-2 py-0.5 rounded">{agent.agent_type}</span>
              <span className="text-xs text-gray-500">{agent.framework}</span>
              <span className={`text-xs ${agent.status === 'active' ? 'text-green-500' : 'text-gray-400'}`}>
                {agent.status}
              </span>
            </div>
            {agent.description && <p className="text-sm text-gray-600 mt-2">{agent.description}</p>}
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t">
          <div className="text-2xl font-bold text-yellow-500">
            {reviewStats.avg_rating.toFixed(1)}
          </div>
          <div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={`text-sm ${star <= Math.round(reviewStats.avg_rating) ? 'text-yellow-500' : 'text-gray-300'}`}>
                  *
                </span>
              ))}
            </div>
            <div className="text-xs text-gray-500">{reviewStats.total} reviews</div>
          </div>
        </div>

        {/* Capabilities */}
        {agent.capabilities && agent.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {agent.capabilities.map((cap, i) => (
              <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{cap}</span>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-400 mt-3">
          Joined {new Date(agent.created_at).toLocaleDateString()}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['overview', 'reviews', 'tools', 'skills'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize ${
              activeTab === tab ? 'bg-agent-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">About this Agent</h3>
          <p className="text-sm text-gray-600">{agent.bio || agent.description || 'No additional information available.'}</p>

          <h3 className="font-semibold mt-4 mb-2">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => navigate(`/coaching`)}
              className="w-full bg-secondary-500 text-white py-2 rounded text-sm"
            >
              Start Coaching Session
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className="w-full bg-gray-100 text-gray-700 py-2 rounded text-sm"
            >
              Read Reviews
            </button>
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Reviews</h3>
            <button
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="text-sm bg-primary-500 text-white px-3 py-1 rounded"
            >
              Write Review
            </button>
          </div>

          {showReviewForm && (
            <div className="bg-white rounded-lg shadow p-3 mb-3">
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-xl ${star <= rating ? 'text-yellow-500' : 'text-gray-300'}`}
                  >
                    *
                  </button>
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Write your review (optional)"
                rows={3}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-2"
              />
              <button onClick={submitReview} className="bg-secondary-500 text-white px-4 py-1.5 rounded text-sm">
                Submit
              </button>
            </div>
          )}

          <div className="space-y-2">
            {reviews.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No reviews yet. Be the first!</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-lg shadow p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm">{review.reviewer_display_name || review.reviewer_username}</div>
                      <div className="flex gap-0.5 mt-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={`text-xs ${star <= review.rating ? 'text-yellow-500' : 'text-gray-300'}`}>
                            *
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(review.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {review.review_text && <p className="text-sm text-gray-600 mt-2">{review.review_text}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="space-y-2">
          {tools.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">This agent has not declared any tools.</p>
          ) : (
            tools.map((tool) => (
              <div key={tool.id} className="bg-white rounded-lg shadow p-3">
                <div className="font-medium text-sm font-mono">{tool.tool_name}</div>
                {tool.description && <p className="text-xs text-gray-500 mt-1">{tool.description}</p>}
                {tool.category && (
                  <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">{tool.category}</span>
                )}
                {tool.input_schema && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-400 cursor-pointer">Input Schema</summary>
                    <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(tool.input_schema, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="space-y-2">
          {skills.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">This agent has not developed any tracked skills yet.</p>
          ) : (
            skills.map((skill, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm">{skill.skill_name}</div>
                    {skill.category && <div className="text-xs text-gray-500">{skill.category}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-agent-500">Lv.{skill.level}</div>
                    <div className="text-xs text-gray-400">{skill.xp} XP</div>
                  </div>
                </div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-agent-500 rounded-full"
                    style={{ width: `${Math.min(100, (skill.xp % (skill.level * 100)) / (skill.level * 100) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
