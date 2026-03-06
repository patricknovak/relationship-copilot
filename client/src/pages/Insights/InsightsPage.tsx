import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface Insight {
  id: string;
  relationship_id: string | null;
  insight_type: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string | null;
  partner_username: string | null;
  partner_display_name: string | null;
  relationship_type: string | null;
  created_at: string;
}

const severityColors: Record<string, string> = {
  critical: 'border-red-500 bg-red-50',
  warning: 'border-yellow-500 bg-yellow-50',
  info: 'border-blue-500 bg-blue-50',
};

const severityBadge: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  warning: 'bg-yellow-500 text-white',
  info: 'bg-blue-500 text-white',
};

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    loadInsights();
  }, [showDismissed]);

  async function loadInsights() {
    setLoading(true);
    try {
      const status = showDismissed ? 'dismissed' : 'active';
      const res = await api.get<{ data: Insight[] }>(`/insights?status=${status}`);
      setInsights(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function dismissInsight(id: string) {
    try {
      await api.put(`/insights/${id}/dismiss`);
      setInsights((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const criticalCount = insights.filter((i) => i.severity === 'critical').length;
  const warningCount = insights.filter((i) => i.severity === 'warning').length;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-1">Insights</h1>
      <p className="text-sm text-gray-500 mb-4">AI-powered predictions and recommendations for your relationships</p>

      {/* Summary */}
      {!showDismissed && (criticalCount > 0 || warningCount > 0) && (
        <div className="flex gap-3 mb-4">
          {criticalCount > 0 && (
            <div className="bg-red-500 text-white px-3 py-2 rounded-lg flex-1 text-center">
              <div className="text-lg font-bold">{criticalCount}</div>
              <div className="text-xs">Critical</div>
            </div>
          )}
          {warningCount > 0 && (
            <div className="bg-yellow-500 text-white px-3 py-2 rounded-lg flex-1 text-center">
              <div className="text-lg font-bold">{warningCount}</div>
              <div className="text-xs">Warnings</div>
            </div>
          )}
          <div className="bg-blue-500 text-white px-3 py-2 rounded-lg flex-1 text-center">
            <div className="text-lg font-bold">{insights.length}</div>
            <div className="text-xs">Total</div>
          </div>
        </div>
      )}

      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowDismissed(!showDismissed)}
          className="text-xs text-gray-500 underline"
        >
          {showDismissed ? 'Show active' : 'Show dismissed'}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm text-center py-8">Analyzing your relationships...</p>
      ) : insights.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">All clear!</div>
          <p className="text-gray-500 text-sm">
            {showDismissed ? 'No dismissed insights.' : 'No actionable insights right now. Keep nurturing your relationships!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`rounded-lg border-l-4 p-4 ${severityColors[insight.severity] || severityColors.info}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${severityBadge[insight.severity] || severityBadge.info}`}>
                    {insight.severity}
                  </span>
                  <span className="text-xs text-gray-500">
                    {insight.insight_type.replace(/_/g, ' ')}
                  </span>
                </div>
                {!showDismissed && (
                  <button
                    onClick={() => dismissInsight(insight.id)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Dismiss
                  </button>
                )}
              </div>

              <h3 className="font-semibold text-sm mb-1">{insight.title}</h3>
              <p className="text-sm text-gray-700 mb-2">{insight.description}</p>

              {insight.recommendation && (
                <div className="bg-white bg-opacity-60 rounded p-2 mt-2">
                  <div className="text-xs font-semibold text-gray-500 mb-0.5">Recommendation</div>
                  <p className="text-sm text-gray-600">{insight.recommendation}</p>
                </div>
              )}

              <div className="text-xs text-gray-400 mt-2">
                {new Date(insight.created_at).toLocaleDateString()}
                {insight.partner_display_name && ` · ${insight.partner_display_name}`}
                {insight.relationship_type && ` · ${insight.relationship_type}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
