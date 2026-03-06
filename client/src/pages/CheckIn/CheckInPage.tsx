import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface Template {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  frequency: string;
  relationship_type: string | null;
}

interface Question {
  q: string;
  type: 'scale' | 'text' | 'boolean';
  min?: number;
  max?: number;
}

interface Relationship {
  id: string;
  partner_username: string;
  partner_display_name: string;
  type: string;
}

interface CheckInResponse {
  id: string;
  template_title: string;
  frequency: string;
  mood_score: number | null;
  notes: string | null;
  created_at: string;
}

interface MoodTrend {
  date: string;
  avg_mood: number;
  count: number;
}

export default function CheckInPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [history, setHistory] = useState<CheckInResponse[]>([]);
  const [trends, setTrends] = useState<MoodTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'check-in' | 'history' | 'trends'>('check-in');

  // Active check-in state
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState('');
  const [answers, setAnswers] = useState<(string | number | boolean)[]>([]);
  const [moodScore, setMoodScore] = useState(5);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [tRes, rRes, hRes, trRes] = await Promise.all([
        api.get<{ data: Template[] }>('/check-ins/templates'),
        api.get<{ data: Relationship[] }>('/relationships'),
        api.get<{ data: CheckInResponse[] }>('/check-ins/history'),
        api.get<{ data: MoodTrend[] }>('/check-ins/trends'),
      ]);
      setTemplates(tRes.data);
      setRelationships(rRes.data);
      setHistory(hRes.data);
      setTrends(trRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function startCheckIn(template: Template) {
    setSelectedTemplate(template);
    setAnswers(new Array(template.questions.length).fill(''));
    setMoodScore(5);
    setNotes('');
    setSubmitted(false);
  }

  async function submitCheckIn() {
    if (!selectedTemplate) return;

    try {
      await api.post('/check-ins/respond', {
        template_id: selectedTemplate.id,
        relationship_id: selectedRelationship || null,
        answers,
        mood_score: moodScore,
        notes: notes || null,
      });
      setSubmitted(true);
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) return <p className="p-4 text-gray-400">Loading...</p>;

  // Active check-in form
  if (selectedTemplate && !submitted) {
    return (
      <div className="p-4">
        <button onClick={() => setSelectedTemplate(null)} className="text-gray-500 mb-3">&larr; Back</button>

        <h2 className="text-lg font-bold mb-1">{selectedTemplate.title}</h2>
        {selectedTemplate.description && (
          <p className="text-sm text-gray-500 mb-4">{selectedTemplate.description}</p>
        )}

        {/* Relationship selector */}
        <select
          value={selectedRelationship}
          onChange={(e) => setSelectedRelationship(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-4"
        >
          <option value="">General (no specific relationship)</option>
          {relationships.map((r) => (
            <option key={r.id} value={r.id}>
              {r.partner_display_name || r.partner_username} ({r.type})
            </option>
          ))}
        </select>

        {/* Questions */}
        <div className="space-y-4 mb-6">
          {selectedTemplate.questions.map((q, idx) => (
            <div key={idx} className="bg-white rounded-lg shadow p-3">
              <p className="text-sm font-medium mb-2">{q.q}</p>

              {q.type === 'scale' && (
                <div>
                  <input
                    type="range"
                    min={q.min || 1}
                    max={q.max || 10}
                    value={answers[idx] as number || q.min || 1}
                    onChange={(e) => {
                      const newAnswers = [...answers];
                      newAnswers[idx] = parseInt(e.target.value, 10);
                      setAnswers(newAnswers);
                    }}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{q.min || 1}</span>
                    <span className="font-medium text-gray-700">{answers[idx] || q.min || 1}</span>
                    <span>{q.max || 10}</span>
                  </div>
                </div>
              )}

              {q.type === 'text' && (
                <textarea
                  value={answers[idx] as string || ''}
                  onChange={(e) => {
                    const newAnswers = [...answers];
                    newAnswers[idx] = e.target.value;
                    setAnswers(newAnswers);
                  }}
                  rows={3}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Your thoughts..."
                />
              )}

              {q.type === 'boolean' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newAnswers = [...answers];
                      newAnswers[idx] = true;
                      setAnswers(newAnswers);
                    }}
                    className={`px-4 py-2 rounded text-sm ${answers[idx] === true ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => {
                      const newAnswers = [...answers];
                      newAnswers[idx] = false;
                      setAnswers(newAnswers);
                    }}
                    className={`px-4 py-2 rounded text-sm ${answers[idx] === false ? 'bg-red-500 text-white' : 'bg-gray-100'}`}
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mood score */}
        <div className="bg-white rounded-lg shadow p-3 mb-4">
          <p className="text-sm font-medium mb-2">Overall mood (1-10)</p>
          <input
            type="range"
            min={1}
            max={10}
            value={moodScore}
            onChange={(e) => setMoodScore(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>Low</span>
            <span className="font-medium text-gray-700 text-lg">{moodScore}</span>
            <span>High</span>
          </div>
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional notes..."
          rows={2}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-4"
        />

        <button
          onClick={submitCheckIn}
          className="w-full bg-primary-500 text-white py-2.5 rounded font-medium"
        >
          Submit Check-In
        </button>
      </div>
    );
  }

  // Submission success
  if (submitted) {
    return (
      <div className="p-4 text-center py-16">
        <div className="text-4xl mb-3">Done!</div>
        <p className="text-gray-600 mb-4">Your check-in has been recorded. Keep it up!</p>
        <button
          onClick={() => { setSelectedTemplate(null); setSubmitted(false); }}
          className="bg-primary-500 text-white px-6 py-2 rounded font-medium"
        >
          Back to Check-Ins
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Check-Ins</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['check-in', 'history', 'trends'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              activeTab === tab ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tab === 'check-in' ? 'New' : tab === 'history' ? 'History' : 'Trends'}
          </button>
        ))}
      </div>

      {activeTab === 'check-in' && (
        <div className="space-y-3">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow p-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-sm">{template.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                  <div className="flex gap-1 mt-1">
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{template.frequency}</span>
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {template.questions.length} questions
                    </span>
                    {template.relationship_type && (
                      <span className="text-xs bg-secondary-100 text-secondary-700 px-1.5 py-0.5 rounded">
                        {template.relationship_type}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => startCheckIn(template)}
                  className="bg-primary-500 text-white px-3 py-1.5 rounded text-sm"
                >
                  Start
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No check-ins yet. Start your first one!</p>
          ) : (
            history.map((h) => (
              <div key={h.id} className="bg-white rounded-lg shadow p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm">{h.template_title}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(h.created_at).toLocaleDateString()} &middot; {h.frequency}
                    </div>
                  </div>
                  {h.mood_score && (
                    <div className={`text-lg font-bold ${h.mood_score >= 7 ? 'text-green-500' : h.mood_score >= 4 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {h.mood_score}/10
                    </div>
                  )}
                </div>
                {h.notes && <p className="text-xs text-gray-400 mt-1">{h.notes}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'trends' && (
        <div>
          {trends.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Complete check-ins with mood scores to see trends.</p>
          ) : (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-sm mb-3">30-Day Mood Trend</h3>
              <div className="flex items-end gap-1 h-40">
                {trends.map((t, idx) => {
                  const height = (parseFloat(String(t.avg_mood)) / 10) * 100;
                  const color = t.avg_mood >= 7 ? 'bg-green-400' : t.avg_mood >= 4 ? 'bg-yellow-400' : 'bg-red-400';
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end">
                      <div className="text-xs text-gray-400 mb-1">{parseFloat(String(t.avg_mood)).toFixed(1)}</div>
                      <div className={`w-full rounded-t ${color}`} style={{ height: `${height}%` }} />
                      <div className="text-xs text-gray-400 mt-1 transform -rotate-45 origin-top-left">
                        {new Date(t.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
