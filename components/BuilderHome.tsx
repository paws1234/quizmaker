'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GqlError, gql, readSession, signOut } from '@/lib/gql';
import { ADMIN_QUIZ_LIST, CREATE_QUIZ } from '@/lib/queries';
import type { AdminQuiz, QuizSummary } from '@/lib/types';
import AdminGate from './AdminGate';

type Status = 'checking' | 'locked' | 'ready' | 'error';

export default function BuilderHome() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');
  const [configured, setConfigured] = useState(true);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const session = await readSession();
      setConfigured(session.configured);
      if (!session.authenticated) {
        setStatus('locked');
        return;
      }

      const data = await gql<{ quizzes: QuizSummary[] }>(ADMIN_QUIZ_LIST);
      setQuizzes(data.quizzes);
      setStatus('ready');
    } catch (failure) {
      if (failure instanceof GqlError && failure.isAuthError) {
        setStatus('locked');
        return;
      }
      setError(failure instanceof Error ? failure.message : 'Could not load your quizzes.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createQuiz() {
    setCreating(true);
    setError('');
    try {
      // Start empty: the editor is the place to add questions.
      const data = await gql<{ adminCreateQuiz: AdminQuiz }>(CREATE_QUIZ, {
        input: { title: 'Untitled quiz' },
      });
      router.push(`/builder/${data.adminCreateQuiz.id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not create the quiz.');
      setCreating(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setQuizzes([]);
    setStatus('locked');
  }

  if (status === 'checking') {
    return <p className="shell muted">Checking your session…</p>;
  }

  if (status === 'locked') {
    return (
      <div className="shell">
        <AdminGate configured={configured} onSignedIn={() => void load()} />
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="bar">
        <a className="bar__brand" href="/">
          Quiz Maker
        </a>
        <div className="bar__actions">
          <button className="btn btn--ghost" onClick={() => void handleSignOut()}>
            Sign out
          </button>
          <button className="btn btn--primary" onClick={() => void createQuiz()} disabled={creating}>
            {creating ? 'Creating…' : 'New quiz'}
          </button>
        </div>
      </header>

      {error && (
        <div className="notice notice--bad" role="alert">
          {error}
        </div>
      )}

      <h1>Your quizzes</h1>

      {quizzes.length === 0 ? (
        <div className="card">
          <p className="muted">
            No quizzes yet. Create one, add a few questions and share the link — it takes a couple of minutes.
          </p>
        </div>
      ) : (
        <ul className="quiz-list">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="quiz-list__item">
              <div>
                <a className="quiz-list__title" href={`/builder/${quiz.id}`}>
                  {quiz.title}
                </a>
                <p className="muted small">
                  {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'} · {quiz.stats.starts} start
                  {quiz.stats.starts === 1 ? '' : 's'} · {quiz.stats.completions} completion
                  {quiz.stats.completions === 1 ? '' : 's'} · updated{' '}
                  {new Date(quiz.updatedAt).toLocaleString()}
                </p>
                {quiz.slug && <p className="muted small">/q/{quiz.slug}</p>}
              </div>
              <div className="quiz-list__actions">
                <a className="btn btn--ghost" href={`/q/${quiz.id}`} target="_blank" rel="noreferrer">
                  Open
                </a>
                <a className="btn btn--ghost" href={`/builder/${quiz.id}`}>
                  Edit
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
