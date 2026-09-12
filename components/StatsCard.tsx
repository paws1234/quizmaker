'use client';

import { useEffect, useState } from 'react';
import type { QuizStats } from '@/lib/types';

export default function StatsCard({ stats }: { stats: QuizStats }) {
  const percent = Math.round(stats.averageScore * 10) / 10;

  return (
    <section className="card">
      <h2>Analytics</h2>
      <dl className="stats">
        <div>
          <dt>Starts</dt>
          <dd>{stats.starts}</dd>
        </div>
        <div>
          <dt>Completions</dt>
          <dd>{stats.completions}</dd>
        </div>
        <div>
          <dt>Average score</dt>
          <dd>{percent}</dd>
        </div>
      </dl>

      {stats.mostMissed.length > 0 && (
        <>
          <h3 className="card__sub">Most missed</h3>
          <ul className="missed">
            {stats.mostMissed.map((entry) => (
              <li key={entry.questionId}>
                <span>{entry.text}</span>
                <span className="muted small">
                  {entry.misses} missed · {entry.correct} correct
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {stats.completions === 0 && <p className="muted small">No one has finished this quiz yet.</p>}
    </section>
  );
}

/** Copies text with a graceful fallback for browsers without the clipboard API. */
export function useCopy() {
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(''), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Ignore: the value is visible in a selectable input either way.
    }
    setCopied(label);
  }

  return { copied, copy };
}
