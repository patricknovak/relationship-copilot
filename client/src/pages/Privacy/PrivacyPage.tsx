import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../context/authStore';

interface PrivacySettings {
  discover_visible: boolean;
  show_life_stage: boolean;
  show_bio: boolean;
  show_birthday: boolean;
}

export default function PrivacyPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ data: PrivacySettings }>('/privacy/settings')
      .then((res) => setSettings(res.data))
      .catch((err) => setError(err.message));
  }, []);

  async function handleToggle(key: keyof PrivacySettings) {
    if (!settings) return;

    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    setSaving(true);
    setSaveMessage('');

    try {
      await api.put('/privacy/settings', { [key]: updated[key] });
      setSaveMessage('Settings saved');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (err: any) {
      // Revert on error
      setSettings(settings);
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const data = await api.get<{ data: unknown }>('/privacy/export');
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relationship-copilot-data-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      setError('Please enter your password to confirm deletion');
      return;
    }

    setDeleting(true);
    setError('');

    try {
      // api.delete doesn't support a body, so we use a custom fetch request
      const token = localStorage.getItem('token');
      const response = await fetch('/api/privacy/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password: deletePassword }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  }

  if (!settings) {
    return <p className="p-4 text-gray-400">Loading...</p>;
  }

  const toggleItems: { key: keyof PrivacySettings; label: string; description: string }[] = [
    { key: 'discover_visible', label: 'Visible in Discover', description: 'Allow other users to find you on the Discover page' },
    { key: 'show_life_stage', label: 'Show Life Stage', description: 'Display your life stage on your profile' },
    { key: 'show_bio', label: 'Show Bio', description: 'Display your bio on your profile' },
    { key: 'show_birthday', label: 'Show Birthday', description: 'Display your birthday on your profile' },
  ];

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Privacy & Data</h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
      )}

      {saveMessage && (
        <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{saveMessage}</div>
      )}

      {/* Privacy Toggles */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="font-semibold mb-3">Privacy Settings</h2>
        <div className="space-y-4">
          {toggleItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-gray-500">{item.description}</div>
              </div>
              <button
                onClick={() => handleToggle(item.key)}
                disabled={saving}
                className={`relative w-11 h-6 rounded-full transition ${
                  settings[item.key] ? 'bg-primary-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings[item.key] ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data Export */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="font-semibold mb-2">Export Your Data</h2>
        <p className="text-sm text-gray-500 mb-3">
          Download a copy of all your data including your profile, relationships, messages, health data, and achievements.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full bg-secondary-500 text-white py-2 rounded font-medium hover:bg-secondary-600 disabled:opacity-50"
        >
          {exporting ? 'Preparing Export...' : 'Export Data'}
        </button>
      </div>

      {/* Account Deletion */}
      <div className="bg-white rounded-lg shadow p-4 border border-red-100">
        <h2 className="font-semibold text-red-600 mb-2">Delete Account</h2>
        <p className="text-sm text-gray-500 mb-3">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full border border-red-500 text-red-500 py-2 rounded font-medium hover:bg-red-50"
          >
            Delete My Account
          </button>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Enter your password to confirm
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Your password"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword('');
                  setError('');
                }}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword}
                className="flex-1 bg-red-500 text-white py-2 rounded font-medium hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
