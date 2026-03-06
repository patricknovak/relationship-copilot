import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../context/authStore';

const LIFE_STAGES = [
  { value: 'student', label: 'Student', description: 'Currently in school or university, focused on learning and building foundations.' },
  { value: 'early_career', label: 'Early Career', description: 'Starting out professionally, building skills and establishing yourself.' },
  { value: 'established', label: 'Established', description: 'Settled in your career and personal life with clear direction.' },
  { value: 'parent', label: 'Parent', description: 'Raising children and balancing family with other responsibilities.' },
  { value: 'empty_nester', label: 'Empty Nester', description: 'Children have left home, rediscovering personal goals and relationships.' },
  { value: 'retired', label: 'Retired', description: 'Enjoying the freedom to focus on passions, hobbies, and meaningful connections.' },
];

const INTERESTS = [
  { value: 'communication', label: 'Communication' },
  { value: 'growth', label: 'Personal Growth' },
  { value: 'family', label: 'Family' },
  { value: 'romance', label: 'Romance' },
  { value: 'career', label: 'Career' },
  { value: 'health', label: 'Health & Wellness' },
  { value: 'spirituality', label: 'Spirituality' },
  { value: 'parenting', label: 'Parenting' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [lifeStage, setLifeStage] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [discoverVisible, setDiscoverVisible] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function toggleInterest(value: string) {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
    );
  }

  function canAdvance(): boolean {
    if (step === 1) return displayName.trim().length > 0;
    return true;
  }

  async function handleComplete() {
    setSubmitting(true);
    setError('');
    try {
      await api.put('/users/me/onboarding', {
        display_name: displayName,
        birthday: birthday || null,
        gender: gender || null,
        bio: bio || null,
        life_stage: lifeStage || null,
        preferences: {
          interests,
          discover_visible: discoverVisible,
        },
      });
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to save onboarding data');
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  }

  function handlePrevious() {
    if (step > 1) setStep(step - 1);
  }

  const progressPercent = (step / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress bar */}
      <div className="w-full bg-gray-200 h-2">
        <div
          className="bg-primary-500 h-2 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg">
          {/* Step indicator */}
          <div className="text-sm text-gray-500 mb-4 text-center">
            Step {step} of {TOTAL_STEPS}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
          )}

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl font-bold text-center mb-2">
                Welcome to Relationship Copilot
              </h1>
              <p className="text-gray-600 text-center mb-6">
                Let's get to know you a bit so we can personalize your experience.
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user?.username || 'Your name'}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {/* Step 2: About You */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-4">About You</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select...</option>
                    {GENDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Tell us a bit about yourself..."
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Life Stage */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold mb-2">Your Life Stage</h2>
              <p className="text-gray-600 text-sm mb-4">
                This helps us tailor advice and resources to where you are in life.
              </p>
              <div className="space-y-2">
                {LIFE_STAGES.map((stage) => (
                  <button
                    key={stage.value}
                    onClick={() => setLifeStage(stage.value)}
                    className={`w-full text-left p-3 rounded border transition ${
                      lifeStage === stage.value
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{stage.label}</div>
                    <div className="text-sm text-gray-500">{stage.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Preferences */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold mb-2">Your Interests</h2>
              <p className="text-gray-600 text-sm mb-4">
                Select the areas you'd like to focus on. You can change these later.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {INTERESTS.map((interest) => (
                  <button
                    key={interest.value}
                    onClick={() => toggleInterest(interest.value)}
                    className={`p-3 rounded border text-sm font-medium transition ${
                      interests.includes(interest.value)
                        ? 'border-secondary-500 bg-secondary-50 text-secondary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {interest.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <div className="text-sm font-medium">Visible in Discover</div>
                  <div className="text-xs text-gray-500">Let others find you on the platform</div>
                </div>
                <button
                  onClick={() => setDiscoverVisible(!discoverVisible)}
                  className={`relative w-11 h-6 rounded-full transition ${
                    discoverVisible ? 'bg-primary-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      discoverVisible ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <button
              onClick={handlePrevious}
              disabled={step === 1}
              className={`px-4 py-2 rounded font-medium ${
                step === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!canAdvance() || submitting}
              className="px-6 py-2 bg-primary-500 text-white rounded font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : step === TOTAL_STEPS ? 'Complete' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
