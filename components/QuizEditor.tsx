'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GqlError, gql, readSession, signOut } from '@/lib/gql';
import { ADMIN_QUIZ, DELETE_QUIZ, UPDATE_QUIZ } from '@/lib/queries';
import type { AdminQuiz, AdminQuestion, QuizSettings, UpdateQuizInput } from '@/lib/types';
import AdminGate from './AdminGate';
import ConfirmDialog from './ConfirmDialog';
import ShareBox from './ShareBox';
import StatsCard from './StatsCard';

type Status = 'loading' | 'locked' | 'ready' | 'missing' | 'error';

/**
 * Quiz editor.
 *
 * The draft lives in local state so typing never waits on the network; the
 * server response replaces the draft after a save, which is also how generated
 * question/option ids reach the editor.
 */
export default function QuizEditor({ id }: { id: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [configured, setConfigured] = useState(true);
  const [quiz, setQuiz] = useState<AdminQuiz | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const session = await readSession();
      setConfigured(session.configured);
      if (!session.authenticated) {
        setStatus('locked');
        return;
      }

      const data = await gql<{ adminQuiz: AdminQuiz | null }>(ADMIN_QUIZ, { id });
      if (!data.adminQuiz) {
        setStatus('missing');
        return;
      }

      setQuiz(data.adminQuiz);
      setStatus('ready');
    } catch (failure) {
      if (failure instanceof GqlError && failure.isAuthError) {
        setStatus('locked');
        return;
      }
      setError(failure instanceof Error ? failure.message : 'Could not load this quiz.');
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Applies a change to the draft without mutating the previous state. */
  function edit(changes: (draft: AdminQuiz) => void) {
    setMessage('');
    setError('');
    setQuiz((previous) => {
      if (!previous) return previous;
      const draft = structuredClone(previous);
      changes(draft);
      return draft;
    });
  }

  function patchSettings(changes: Partial<QuizSettings>) {
    edit((draft) => {
      draft.settings = { ...draft.settings, ...changes };
    });
  }

  async function save() {
    if (!quiz || saving) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const input: UpdateQuizInput = {
        title: quiz.title,
        description: quiz.description ?? '',
        slug: quiz.slug ?? '',
        settings: quiz.settings,
        questions: quiz.questions.map((question) => ({
          id: question.id,
          text: question.text,
          options: question.options.map((option) => ({ id: option.id, text: option.text })),
          correctOptionId: question.correctOptionId,
          explanation: question.explanation ?? '',
        })),
      };

      const data = await gql<{ adminUpdateQuiz: AdminQuiz }>(UPDATE_QUIZ, { id: quiz.id, input });
      setQuiz(data.adminUpdateQuiz);
      setMessage('Saved');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the quiz.');
    } finally {
      setSaving(false);
    }
  }

    /** Only ever called from the confirmation dialog, not from a browser popup. */
  async function remove() {
      if (!quiz || deleting) return;
      setDeleting(true);

    try {
      await gql<{ adminDeleteQuiz: boolean }>(DELETE_QUIZ, { id: quiz.id });
      router.push('/builder');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not delete the quiz.');
        setDeleting(false);
        setConfirmingDelete(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setQuiz(null);
    setStatus('locked');
  }

  if (status === 'loading') return <p className="shell muted">Loading…</p>;

  if (status === 'locked') {
    return (
      <div className="shell">
        <AdminGate configured={configured} onSignedIn={() => void load()} />
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="shell">
        <div className="card">
          <h1>Quiz not found</h1>
          <p className="muted">It may have been deleted.</p>
          <a className="btn btn--ghost" href="/builder">
            Back to your quizzes
          </a>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="shell">
        <div className="notice notice--bad" role="alert">
          {error || 'Could not load this quiz.'}
        </div>
      </div>
    );
  }

  const settings = quiz.settings;

  return (
    <div className="shell">
      <header className="bar">
        <a className="bar__brand" href="/builder">
          Quiz Maker
        </a>
        <div className="bar__actions">
          {message && <span className="pill pill--ok">{message}</span>}
          {error && <span className="pill pill--bad">{error}</span>}
          <a className="btn btn--ghost" href={`/q/${quiz.id}`} target="_blank" rel="noreferrer">
            View
          </a>
          <button className="btn btn--ghost" onClick={() => void handleSignOut()}>
            Sign out
          </button>
          <button className="btn btn--primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <div className="editor">
        <main className="editor__main">
          <section className="card">
            <label className="field">
              <span>Title</span>
              <input
                className="input"
                value={quiz.title}
                onChange={(event) => edit((draft) => void (draft.title = event.target.value))}
                placeholder="Marketing Basics Quiz"
              />
            </label>

            <label className="field">
              <span>Description</span>
              <textarea
                className="input"
                rows={2}
                value={quiz.description ?? ''}
                onChange={(event) => edit((draft) => void (draft.description = event.target.value))}
                placeholder="Test your knowledge of core marketing concepts"
              />
            </label>

            <label className="field">
              <span>Custom slug (optional)</span>
              <input
                className="input"
                value={quiz.slug ?? ''}
                onChange={(event) => edit((draft) => void (draft.slug = event.target.value))}
                placeholder="marketing-basics"
              />
              <small className="muted">
                Public link: /q/{quiz.slug || quiz.id} — lowercase letters, numbers and hyphens.
              </small>
            </label>
          </section>

          <section className="card">
            <div className="card__head">
              <h2>Questions ({quiz.questions.length})</h2>
              <button className="btn btn--ghost" onClick={() => edit((draft) => void draft.questions.push(blankQuestion(draft.questions.length)))}>
                Add question
              </button>
            </div>

            {quiz.questions.length === 0 && (
              <p className="muted">Add your first question to get started.</p>
            )}

            {quiz.questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                total={quiz.questions.length}
                onUpdate={(next) => edit((draft) => void (draft.questions[index] = next))}
                onMove={(delta) =>
                  edit((draft) => {
                    const target = index + delta;
                    if (target < 0 || target >= draft.questions.length) return;
                    const [moved] = draft.questions.splice(index, 1);
                    draft.questions.splice(target, 0, moved);
                  })
                }
                onRemove={() => edit((draft) => void draft.questions.splice(index, 1))}
              />
            ))}
          </section>

          <section className="card">
            <h2>Danger zone</h2>
            <p className="muted small">Deleting a quiz removes its questions, share link and analytics.</p>
                      <button
                          className="btn btn--danger"
                          onClick={() => setConfirmingDelete(true)}
                          disabled={deleting}
                      >
              Delete this quiz
            </button>
          </section>

                  <ConfirmDialog
                      open={confirmingDelete}
                      title="Delete this quiz?"
                      confirmLabel="Delete quiz"
                      danger
                      busy={deleting}
                      onCancel={() => setConfirmingDelete(false)}
                      onConfirm={() => void remove()}
                  >
                      <p>
                          &ldquo;{quiz.title}&rdquo; and its questions, share link and analytics will be removed. This
                          cannot be undone.
                      </p>
                  </ConfirmDialog>
        </main>

        <aside className="editor__side">
          <section className="card">
            <h2>Settings</h2>

            <label className="check">
              <input
                type="checkbox"
                checked={settings.requireOptIn}
                onChange={(event) => patchSettings({ requireOptIn: event.target.checked })}
              />
              <span>Ask for consent before starting</span>
            </label>

            {settings.requireOptIn && (
              <label className="field">
                <span>Consent text</span>
                <textarea
                  className="input"
                  rows={2}
                  value={settings.optInText ?? ''}
                  onChange={(event) => patchSettings({ optInText: event.target.value })}
                  placeholder="I agree to take part in this quiz."
                />
              </label>
            )}

            <label className="check">
              <input
                type="checkbox"
                checked={settings.showCorrectAnswers}
                onChange={(event) => patchSettings({ showCorrectAnswers: event.target.checked })}
              />
              <span>Show the correct answers after submitting</span>
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={settings.allowRetake}
                onChange={(event) => patchSettings({ allowRetake: event.target.checked })}
              />
              <span>Allow retakes</span>
            </label>

            <label className="field">
              <span>Brand colour</span>
              <span className="colour">
                <input
                  type="color"
                  value={settings.primaryColor ?? '#4f46e5'}
                  onChange={(event) => patchSettings({ primaryColor: event.target.value })}
                />
                <input
                  className="input"
                  value={settings.primaryColor ?? ''}
                  onChange={(event) => patchSettings({ primaryColor: event.target.value })}
                  placeholder="#4f46e5"
                />
              </span>
            </label>

            <label className="field">
              <span>Logo URL</span>
              <input
                className="input"
                value={settings.logoUrl ?? ''}
                onChange={(event) => patchSettings({ logoUrl: event.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </label>

            <label className="field">
              <span>Stops accepting answers</span>
              <input
                className="input"
                type="datetime-local"
                value={toLocalInput(settings.expiresAt)}
                onChange={(event) => patchSettings({ expiresAt: fromLocalInput(event.target.value) })}
              />
              {settings.expiresAt && (
                <small className="muted">
                  Expires {new Date(settings.expiresAt).toLocaleString()}{' '}
                  <button className="link" onClick={() => patchSettings({ expiresAt: null })}>
                    clear
                  </button>
                </small>
              )}
            </label>
          </section>

          <StatsCard stats={quiz.stats} />

          <ShareBox id={quiz.id} title={quiz.title} slug={quiz.slug} />
        </aside>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  total,
  onUpdate,
  onMove,
  onRemove,
}: {
  question: AdminQuestion;
  index: number;
  total: number;
  onUpdate: (next: AdminQuestion) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  function patch(changes: Partial<AdminQuestion>) {
    onUpdate({ ...question, ...changes });
  }

  return (
    <article className="question-card">
      <header className="question-card__head">
        <span className="pill">Question {index + 1}</span>
        <div className="question-card__tools">
          <button className="btn btn--icon" onClick={() => onMove(-1)} disabled={index === 0} title="Move up">
            ↑
          </button>
          <button
            className="btn btn--icon"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Move down"
          >
            ↓
          </button>
          <button className="btn btn--icon" onClick={onRemove} title="Remove question">
            ✕
          </button>
        </div>
      </header>

      <label className="field">
        <span>Question</span>
        <input
          className="input"
          value={question.text}
          onChange={(event) => patch({ text: event.target.value })}
          placeholder="What does SEO stand for?"
        />
      </label>

      <fieldset className="options-edit">
        <legend className="muted small">Options — pick the correct one</legend>
        {question.options.map((option, optionIndex) => (
          <div className="option-row" key={option.id}>
            <label className="option-row__correct" title="Mark as the correct answer">
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={question.correctOptionId === option.id}
                onChange={() => patch({ correctOptionId: option.id })}
              />
            </label>
            <input
              className="input"
              value={option.text}
              onChange={(event) =>
                patch({
                  options: question.options.map((candidate, candidateIndex) =>
                    candidateIndex === optionIndex ? { ...candidate, text: event.target.value } : candidate,
                  ),
                })
              }
              placeholder={`Option ${optionIndex + 1}`}
            />
            <button
              className="btn btn--icon"
              onClick={() =>
                patch({
                  options: question.options.filter((_, candidateIndex) => candidateIndex !== optionIndex),
                  // The answer key cannot point at an option that no longer exists.
                  correctOptionId:
                    question.correctOptionId === option.id ? '' : question.correctOptionId,
                })
              }
              disabled={question.options.length <= 2}
              title="Remove option"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="btn btn--ghost"
          onClick={() => patch({ options: [...question.options, { id: localId('o'), text: '' }] })}
          disabled={question.options.length >= 10}
        >
          Add option
        </button>
      </fieldset>

      <label className="field">
        <span>Explanation shown after answering (optional)</span>
        <input
          className="input"
          value={question.explanation ?? ''}
          onChange={(event) => patch({ explanation: event.target.value })}
          placeholder="SEO stands for Search Engine Optimization."
        />
      </label>
    </article>
  );
}

/* ------------------------------------------------------------------ helpers */

function blankQuestion(order: number): AdminQuestion {
  const first = localId('o');
  return {
    id: localId('q'),
    text: '',
    options: [
      { id: first, text: '' },
      { id: localId('o'), text: '' },
    ],
    correctOptionId: first,
    explanation: null,
    order,
  };
}

/** Mirrors the server's id format so ids survive a save unchanged. */
function localId(prefix: 'q' | 'o'): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2).padEnd(9, '0');
  return `${prefix}${random.slice(0, 9)}`;
}

/** ISO string -> value for <input type="datetime-local"> (local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> value -> ISO string the API accepts. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
