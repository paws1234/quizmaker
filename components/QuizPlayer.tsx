'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { GqlError, gql } from '@/lib/gql';
import { PUBLIC_QUIZ, START_QUIZ, SUBMIT_QUIZ } from '@/lib/queries';
import type { Quiz, QuizResult } from '@/lib/types';

/**
 * The player.
 *
 * Walks one person through a quiz: opt-in, question by question, then a score
 * with a review. Answers are sent to the server once, at the end, so the answer
 * key is never present in the page.
 */

type Stage = 'loading' | 'error' | 'missing' | 'expired' | 'empty' | 'consent' | 'playing' | 'result';

const DEFAULT_ACCENT = '#4f46e5';

/** Which screen a quiz should open on. */
function stageFor(quiz: Quiz): Stage {
  const expired = quiz.settings.expiresAt
    ? new Date(quiz.settings.expiresAt).getTime() < Date.now()
    : false;
  if (expired) return 'expired';
  if (quiz.questions.length === 0) return 'empty';
  return quiz.settings.requireOptIn ? 'consent' : 'playing';
}

function initialStage(initialQuiz: Quiz | null | undefined): Stage {
  if (initialQuiz === undefined) return 'loading';
  if (initialQuiz === null) return 'missing';
  return stageFor(initialQuiz);
}

export default function QuizPlayer({
  id,
  embed = false,
  initialQuiz,
}: {
  id: string;
  embed?: boolean;
  /** Server-rendered quiz: `null` means not found, `undefined` means fetch it. */
  initialQuiz?: Quiz | null;
}) {
  const [quiz, setQuiz] = useState<Quiz | null>(initialQuiz ?? null);
  const [stage, setStage] = useState<Stage>(() => initialStage(initialQuiz));
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const recordStart = useCallback(async (quizId: string) => {
    try {
      await gql(START_QUIZ, { id: quizId });
    } catch (failure) {
      // Analytics must never block a player.
      console.warn('[quiz] could not record the start', failure);
    }
  }, []);

  useEffect(() => {
    // The server already rendered the quiz, so only analytics are left to do.
    if (initialQuiz !== undefined) {
      if (initialQuiz && stageFor(initialQuiz) === 'playing') void recordStart(initialQuiz.id);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await gql<{ quiz: Quiz | null }>(PUBLIC_QUIZ, { id });
        if (cancelled) return;

        const found = data.quiz;
        if (!found) {
          setStage('missing');
          return;
        }

        setQuiz(found);
        const next = stageFor(found);
        setStage(next);
        if (next === 'playing') void recordStart(found.id);
      } catch (failure) {
        if (cancelled) return;
        setError(failure instanceof GqlError ? failure.message : 'Could not load this quiz.');
        setStage('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, initialQuiz, recordStart]);

  function acceptConsent() {
    if (!quiz) return;
    setStage('playing');
    void recordStart(quiz.id);
  }

  async function submit() {
    if (!quiz || submitting) return;

    setSubmitting(true);
    try {
      const payload = {
        id: quiz.id,
        answers: quiz.questions.map((question) => ({
          questionId: question.id,
          optionId: answers[question.id] ?? null,
        })),
      };
      const data = await gql<{ submitQuiz: QuizResult }>(SUBMIT_QUIZ, { input: payload });
      setResult(data.submitQuiz);
      setStage('result');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not submit your answers.');
      setStage('error');
    } finally {
      setSubmitting(false);
    }
  }

  function retake() {
    if (!quiz) return;
    setAnswers({});
    setResult(null);
    setIndex(0);
    if (quiz.settings.requireOptIn) {
      setStage('consent');
    } else {
      setStage('playing');
      void recordStart(quiz.id);
    }
  }

  const accent = quiz?.settings.primaryColor || DEFAULT_ACCENT;
  const wrapperClass = embed ? 'player player--embed' : 'player';

  return (
    <div className={wrapperClass} style={{ '--accent': accent } as CSSProperties}>
      <div className="player__card">{renderStage()}</div>
      {!embed && (
        <p className="player__footer">
          Built with <a href="/">Quiz Maker</a> · <a href="/builder">create your own</a>
        </p>
      )}
    </div>
  );

  function renderStage() {
    if (stage === 'loading') {
      return <p className="muted">Loading quiz…</p>;
    }

    if (stage === 'error') {
      return (
        <div className="notice notice--bad" role="alert">
          <strong>Something went wrong.</strong>
          <p>{error}</p>
          <button className="btn btn--ghost" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      );
    }

    if (stage === 'missing') {
      return (
        <div className="notice">
          <h1>Quiz not found</h1>
          <p className="muted">This link may be wrong, or the quiz may have been deleted.</p>
        </div>
      );
    }

    if (stage === 'expired') {
      return (
        <div className="notice">
          <h1>{quiz?.title}</h1>
          <p className="muted">This quiz is no longer accepting answers.</p>
        </div>
      );
    }

    if (stage === 'empty') {
      return (
        <div className="notice">
          <h1>{quiz?.title}</h1>
          <p className="muted">This quiz does not have any questions yet.</p>
        </div>
      );
    }

    if (!quiz) return null;

    if (stage === 'consent') {
      return (
        <div className="player__intro">
          <Header quiz={quiz} />
          <label className="consent">
            <input type="checkbox" onChange={(event) => (event.target.checked ? acceptConsent() : undefined)} />{' '}
            <span>{quiz.settings.optInText ?? 'I agree to take part in this quiz.'}</span>
          </label>
          <p className="muted small">
            {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'}. Your answers are only used to
            score this quiz.
          </p>
        </div>
      );
    }

    if (stage === 'result' && result) {
      return <Result quiz={quiz} result={result} onRetake={retake} />;
    }

    const question = quiz.questions[index];
    const chosen = answers[question.id];
    const isLast = index === quiz.questions.length - 1;
    const progress = Math.round(((index + 1) / quiz.questions.length) * 100);

    return (
      <div className="player__quiz">
        <Header quiz={quiz} />

        <div className="progress" aria-hidden="true">
          <div className="progress__bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="muted small">
          Question {index + 1} of {quiz.questions.length}
        </p>

        <fieldset className="question">
          <legend className="question__text">{question.text}</legend>
          <div className="options" role="radiogroup">
            {question.options.map((option) => (
              <label
                key={option.id}
                className={chosen === option.id ? 'option option--selected' : 'option'}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.id}
                  checked={chosen === option.id}
                  onChange={() => setAnswers((previous) => ({ ...previous, [question.id]: option.id }))}
                />
                <span>{option.text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="player__actions">
          <button className="btn btn--ghost" onClick={() => setIndex(index - 1)} disabled={index === 0}>
            Back
          </button>
          <button
            className="btn btn--primary"
            onClick={() => (isLast ? void submit() : setIndex(index + 1))}
            disabled={!chosen || submitting}
          >
            {isLast ? (submitting ? 'Scoring…' : 'See my score') : 'Next'}
          </button>
        </div>
      </div>
    );
  }
}

function Header({ quiz }: { quiz: Quiz }) {
  return (
    <header className="player__header">
      {quiz.settings.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="player__logo" src={quiz.settings.logoUrl} alt="" />
      )}
      <div>
        <h1>{quiz.title}</h1>
        {quiz.description && <p className="muted">{quiz.description}</p>}
      </div>
    </header>
  );
}

function Result({ quiz, result, onRetake }: { quiz: Quiz; result: QuizResult; onRetake: () => void }) {
  const praise =
    result.percent === 100
      ? 'Perfect score.'
      : result.percent >= 70
        ? 'Nicely done.'
        : result.percent >= 40
          ? 'Not bad.'
          : 'Worth another look.';

  return (
    <div className="result">
      <p className="muted small">{praise}</p>
      <p className="result__score">
        {result.score} <span className="muted">/ {result.total}</span>
      </p>
      <div className="progress" aria-hidden="true">
        <div className="progress__bar" style={{ width: `${result.percent}%` }} />
      </div>
      <p className="muted small">{Math.round(result.percent)}% correct</p>

      <ol className="review">
        {result.results.map((entry) => {
          const question = quiz.questions.find((candidate) => candidate.id === entry.questionId);
          const chosenText = question?.options.find((option) => option.id === entry.chosenOptionId)?.text;
          const correctText = question?.options.find((option) => option.id === entry.correctOptionId)?.text;

          return (
            <li key={entry.questionId} className={entry.correct ? 'review__item review__item--ok' : 'review__item'}>
              <p className="review__question">
                <span aria-hidden="true">{entry.correct ? '✓' : '✗'}</span> {question?.text ?? 'Question'}
              </p>
              <p className="muted small">
                Your answer: {chosenText ?? <em>not answered</em>}
              </p>
              {!entry.correct && correctText && <p className="muted small">Correct answer: {correctText}</p>}
              {entry.explanation && <p className="review__explanation">{entry.explanation}</p>}
            </li>
          );
        })}
      </ol>

      <div className="player__actions">
        {quiz.settings.allowRetake && (
          <button className="btn btn--primary" onClick={onRetake}>
            Retake quiz
          </button>
        )}
        <a className="btn btn--ghost" href="/builder">
          Build your own
        </a>
      </div>
    </div>
  );
}
