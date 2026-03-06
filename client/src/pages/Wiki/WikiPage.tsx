import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface Article {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  upvotes: number;
  life_stage: string | null;
  relationship_type: string | null;
  author_username: string;
  author_display_name: string;
  author_user_type: string;
  created_at: string;
  comments?: Comment[];
  user_vote?: number;
}

interface Comment {
  id: string;
  content: string;
  author_username: string;
  author_display_name: string;
  created_at: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  relationship_type: string | null;
}

export default function WikiPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'articles' | 'quizzes' | 'write'>('articles');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Write form
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [writeCategory, setWriteCategory] = useState('');

  // Comment form
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    loadData();
  }, [categoryFilter, searchQuery]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (searchQuery) params.set('search', searchQuery);

      const [articlesRes, quizzesRes] = await Promise.all([
        api.get<{ data: Article[] }>(`/wiki?${params}`),
        api.get<{ data: Quiz[] }>('/wiki/quizzes/list'),
      ]);
      setArticles(articlesRes.data);
      setQuizzes(quizzesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadArticle(id: string) {
    try {
      const res = await api.get<{ data: Article }>(`/wiki/${id}`);
      setSelectedArticle(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleVote(articleId: string, vote: number) {
    try {
      await api.post(`/wiki/${articleId}/vote`, { vote });
      if (selectedArticle?.id === articleId) {
        loadArticle(articleId);
      }
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleComment(articleId: string) {
    if (!commentText.trim()) return;
    try {
      await api.post(`/wiki/${articleId}/comments`, { content: commentText.trim() });
      setCommentText('');
      loadArticle(articleId);
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!writeTitle.trim() || !writeContent.trim()) return;

    try {
      await api.post('/wiki', {
        title: writeTitle.trim(),
        content: writeContent.trim(),
        category: writeCategory || null,
      });
      setWriteTitle('');
      setWriteContent('');
      setWriteCategory('');
      setActiveTab('articles');
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  const categories = ['relationship', 'communication', 'growth', 'health', 'parenting', 'career', 'self-care'];

  if (selectedArticle) {
    return (
      <div className="p-4">
        <button onClick={() => setSelectedArticle(null)} className="text-gray-500 mb-3">&larr; Back</button>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h1 className="text-xl font-bold mb-2">{selectedArticle.title}</h1>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <span>By {selectedArticle.author_display_name || selectedArticle.author_username}</span>
            {selectedArticle.author_user_type === 'agent' && (
              <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Agent</span>
            )}
            <span>{new Date(selectedArticle.created_at).toLocaleDateString()}</span>
            {selectedArticle.category && (
              <span className="bg-gray-100 px-1.5 py-0.5 rounded">{selectedArticle.category}</span>
            )}
          </div>

          <div className="prose prose-sm max-w-none mb-4 whitespace-pre-wrap">{selectedArticle.content}</div>

          <div className="flex items-center gap-3 border-t pt-3">
            <button
              onClick={() => handleVote(selectedArticle.id, 1)}
              className={`text-sm px-2 py-1 rounded ${selectedArticle.user_vote === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}
            >
              Upvote
            </button>
            <span className="text-sm font-medium">{selectedArticle.upvotes}</span>
            <button
              onClick={() => handleVote(selectedArticle.id, -1)}
              className={`text-sm px-2 py-1 rounded ${selectedArticle.user_vote === -1 ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}
            >
              Downvote
            </button>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3">Comments ({selectedArticle.comments?.length || 0})</h3>

          {selectedArticle.comments?.map((c) => (
            <div key={c.id} className="border-b last:border-0 py-2">
              <div className="text-xs text-gray-500 mb-1">
                {c.author_display_name || c.author_username} &middot; {new Date(c.created_at).toLocaleDateString()}
              </div>
              <p className="text-sm">{c.content}</p>
            </div>
          ))}

          <form onSubmit={(e) => { e.preventDefault(); handleComment(selectedArticle.id); }} className="flex gap-2 mt-3">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button type="submit" className="bg-secondary-500 text-white px-3 py-1 rounded text-sm">Post</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Wiki & Assessments</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['articles', 'quizzes', 'write'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              activeTab === tab ? 'bg-secondary-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tab === 'articles' ? 'Articles' : tab === 'quizzes' ? 'Assessments' : 'Write'}
          </button>
        ))}
      </div>

      {activeTab === 'articles' && (
        <>
          {/* Search and filter */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles..."
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : articles.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No articles yet. Be the first to write one!</p>
          ) : (
            <div className="space-y-3">
              {articles.map((article) => (
                <div
                  key={article.id}
                  onClick={() => loadArticle(article.id)}
                  className="bg-white rounded-lg shadow p-3 cursor-pointer hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{article.title}</h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{article.content}</p>
                    </div>
                    <div className="text-sm font-medium text-secondary-500 ml-2">{article.upvotes}</div>
                  </div>
                  <div className="flex gap-2 mt-2 text-xs text-gray-400">
                    <span>{article.author_display_name || article.author_username}</span>
                    {article.author_user_type === 'agent' && <span className="text-indigo-500">Agent</span>}
                    {article.category && <span className="bg-gray-100 px-1 rounded">{article.category}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'quizzes' && (
        <div className="space-y-3">
          {quizzes.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No assessments available yet.</p>
          ) : (
            quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))
          )}
        </div>
      )}

      {activeTab === 'write' && (
        <form onSubmit={handlePublish} className="bg-white rounded-lg shadow p-4 space-y-3">
          <input
            type="text"
            value={writeTitle}
            onChange={(e) => setWriteTitle(e.target.value)}
            placeholder="Article title"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={writeCategory}
            onChange={(e) => setWriteCategory(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select category (optional)</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea
            value={writeContent}
            onChange={(e) => setWriteContent(e.target.value)}
            placeholder="Write your article..."
            rows={10}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!writeTitle.trim() || !writeContent.trim()}
            className="w-full bg-secondary-500 text-white py-2 rounded font-medium disabled:opacity-50"
          >
            Publish Article
          </button>
        </form>
      )}
    </div>
  );
}

function QuizCard({ quiz }: { quiz: Quiz }) {
  const [taking, setTaking] = useState(false);
  const [questions, setQuestions] = useState<{ q: string; options: string[]; categories: string[] }[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; result_type: string } | null>(null);

  async function startQuiz() {
    try {
      const res = await api.get<{ data: { questions: typeof questions; previous_result: typeof result } }>(`/wiki/quizzes/${quiz.id}`);
      setQuestions(res.data.questions);
      setAnswers(new Array(res.data.questions.length).fill(-1));
      if (res.data.previous_result) {
        setResult(res.data.previous_result);
      }
      setTaking(true);
    } catch (err) {
      console.error(err);
    }
  }

  async function submitQuiz() {
    if (answers.some((a) => a === -1)) return;
    try {
      const res = await api.post<{ data: { score: number; result_type: string } }>(`/wiki/quizzes/${quiz.id}/submit`, { answers });
      setResult(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  const resultLabels: Record<string, string> = {
    words: 'Words of Affirmation',
    gifts: 'Receiving Gifts',
    time: 'Quality Time',
    service: 'Acts of Service',
    touch: 'Physical Touch',
    secure: 'Secure Attachment',
    anxious: 'Anxious Attachment',
    avoidant: 'Avoidant Attachment',
    disorganized: 'Disorganized Attachment',
    direct: 'Direct Communicator',
    indirect: 'Indirect Communicator',
    reserved: 'Reserved Communicator',
    'action-oriented': 'Action-Oriented Communicator',
  };

  if (taking) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-1">{quiz.title}</h3>

        {result ? (
          <div className="text-center py-4">
            <div className="text-2xl font-bold text-secondary-500 mb-1">
              {resultLabels[result.result_type] || result.result_type}
            </div>
            <div className="text-sm text-gray-500 mb-3">Confidence: {result.score}%</div>
            <button onClick={() => { setResult(null); setTaking(false); }} className="text-sm text-gray-500 underline">
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4 mt-3">
            {questions.map((q, qIdx) => (
              <div key={qIdx}>
                <p className="text-sm font-medium mb-2">{q.q}</p>
                <div className="space-y-1">
                  {q.options.map((opt, optIdx) => (
                    <button
                      key={optIdx}
                      onClick={() => {
                        const newAnswers = [...answers];
                        newAnswers[qIdx] = optIdx;
                        setAnswers(newAnswers);
                      }}
                      className={`w-full text-left text-sm px-3 py-2 rounded border ${
                        answers[qIdx] === optIdx ? 'border-secondary-500 bg-secondary-50' : 'border-gray-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={submitQuiz}
              disabled={answers.some((a) => a === -1)}
              className="w-full bg-secondary-500 text-white py-2 rounded font-medium disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-medium text-sm">{quiz.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{quiz.description}</p>
          {quiz.category && (
            <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">{quiz.category}</span>
          )}
        </div>
        <button onClick={startQuiz} className="bg-secondary-500 text-white px-3 py-1.5 rounded text-sm">
          Take Quiz
        </button>
      </div>
    </div>
  );
}
