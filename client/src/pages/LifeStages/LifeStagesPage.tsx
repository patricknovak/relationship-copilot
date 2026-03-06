import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface LifeStageEvent {
  id: string;
  from_stage: string | null;
  to_stage: string;
  event_type: string | null;
  notes: string | null;
  date: string;
}

interface Guide {
  id: string;
  life_stage: string;
  event_type: string | null;
  title: string;
  content: string;
  relationship_types: string[];
}

interface LifeStageData {
  life_stage: string | null;
  events: LifeStageEvent[];
  guides: Guide[];
}

const LIFE_STAGES = [
  { value: 'student', label: 'Student', description: 'In school or university' },
  { value: 'early_career', label: 'Early Career', description: 'Starting your professional journey' },
  { value: 'established', label: 'Established', description: 'Settled in career and life' },
  { value: 'parent', label: 'Parent', description: 'Raising children' },
  { value: 'empty_nester', label: 'Empty Nester', description: 'Children have moved out' },
  { value: 'retired', label: 'Retired', description: 'Enjoying retirement' },
];

const EVENT_TYPES = [
  'marriage', 'new_baby', 'divorce', 'job_change', 'retirement', 'loss', 'moving',
  'graduation', 'promotion', 'health_change',
];

export default function LifeStagesPage() {
  const [data, setData] = useState<LifeStageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTransition, setShowTransition] = useState(false);
  const [selectedStage, setSelectedStage] = useState('');
  const [eventType, setEventType] = useState('');
  const [notes, setNotes] = useState('');
  const [allGuides, setAllGuides] = useState<Guide[]>([]);
  const [showAllGuides, setShowAllGuides] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [currentRes, guidesRes] = await Promise.all([
        api.get<{ data: LifeStageData }>('/life-stages/current'),
        api.get<{ data: Guide[] }>('/life-stages/guides'),
      ]);
      setData(currentRes.data);
      setAllGuides(guidesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTransition(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStage) return;

    try {
      await api.post('/life-stages/events', {
        to_stage: selectedStage,
        event_type: eventType || null,
        notes: notes || null,
      });
      setShowTransition(false);
      setSelectedStage('');
      setEventType('');
      setNotes('');
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) return <p className="p-4 text-gray-400">Loading...</p>;

  const currentStageInfo = LIFE_STAGES.find((s) => s.value === data?.life_stage);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Life Stages</h1>

      {/* Current life stage */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Current Stage</div>
            <div className="text-2xl font-bold text-primary-500 mt-1">
              {currentStageInfo?.label || data?.life_stage || 'Not Set'}
            </div>
            {currentStageInfo && (
              <div className="text-sm text-gray-500 mt-0.5">{currentStageInfo.description}</div>
            )}
          </div>
          <button
            onClick={() => setShowTransition(!showTransition)}
            className="text-sm bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200"
          >
            {showTransition ? 'Cancel' : 'Record Change'}
          </button>
        </div>

        {/* Life stage timeline */}
        <div className="flex gap-1 mt-4">
          {LIFE_STAGES.map((stage) => (
            <div
              key={stage.value}
              className={`flex-1 h-2 rounded-full ${
                stage.value === data?.life_stage ? 'bg-primary-500' : 'bg-gray-200'
              }`}
              title={stage.label}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>Student</span>
          <span>Retired</span>
        </div>
      </div>

      {/* Transition form */}
      {showTransition && (
        <form onSubmit={handleTransition} className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
          <h3 className="font-semibold text-sm">Record Life Transition</h3>

          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">Select new life stage...</option>
            {LIFE_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label} - {s.description}</option>
            ))}
          </select>

          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Life event (optional)...</option>
            {EVENT_TYPES.map((e) => (
              <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes about this transition (optional)"
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />

          <button
            type="submit"
            disabled={!selectedStage}
            className="w-full bg-primary-500 text-white py-2 rounded font-medium disabled:opacity-50"
          >
            Record Transition
          </button>
        </form>
      )}

      {/* Relevant guides */}
      {data && data.guides.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold mb-2">Guidance for Your Stage</h2>
          <div className="space-y-3">
            {data.guides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </div>
      )}

      {/* All guides toggle */}
      <button
        onClick={() => setShowAllGuides(!showAllGuides)}
        className="text-sm text-secondary-500 font-medium mb-3"
      >
        {showAllGuides ? 'Hide all guides' : 'Browse all guides'}
      </button>

      {showAllGuides && (
        <div className="space-y-3 mb-4">
          {allGuides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      )}

      {/* Event history */}
      {data && data.events.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2">Life Timeline</h2>
          <div className="space-y-2">
            {data.events.map((event) => (
              <div key={event.id} className="bg-white rounded-lg shadow p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm">
                      {event.from_stage ? `${event.from_stage} → ` : ''}{event.to_stage}
                    </div>
                    {event.event_type && (
                      <div className="text-xs text-gray-500">{event.event_type.replace(/_/g, ' ')}</div>
                    )}
                    {event.notes && <p className="text-xs text-gray-400 mt-1">{event.notes}</p>}
                  </div>
                  <div className="text-xs text-gray-400">{new Date(event.date).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GuideCard({ guide }: { guide: Guide }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow p-3">
      <div className="flex justify-between items-start cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div>
          <h3 className="font-medium text-sm">{guide.title}</h3>
          <div className="flex gap-1 mt-1">
            <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{guide.life_stage}</span>
            {guide.event_type && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                {guide.event_type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
        <span className="text-gray-400 text-sm">{expanded ? '−' : '+'}</span>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{guide.content}</p>
          {guide.relationship_types.length > 0 && (
            <div className="flex gap-1 mt-2">
              {guide.relationship_types.map((rt, i) => (
                <span key={i} className="text-xs bg-secondary-100 text-secondary-700 px-1.5 py-0.5 rounded">{rt}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
