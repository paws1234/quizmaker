'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from '@/lib/gql';

/** Unlocks the builder by exchanging the admin token for a session cookie. */
export default function AdminGate({
  configured,
  onSignedIn,
}: {
  configured: boolean;
  onSignedIn: () => void;
}) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(token.trim());
      onSignedIn();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <h1>Builder</h1>
      <p className="muted">
              Quizzes are created and edited here. Access is one shared admin token (<code>ADMIN_TOKEN</code>) —
              locally it is the value in <code>.env</code>, on a hosted deployment it is set in the project's
              environment variables. Enter it once: this browser then stays signed in for 30 days.
      </p>

      {!configured && (
        <div className="notice notice--bad" role="alert">
                  This deployment has no <code>ADMIN_TOKEN</code> configured, so the builder is locked. Set it in the
                  project's environment variables (or in <code>.env</code> when running locally) and redeploy. A
                  preview deployment that has no variables of its own shows this too — use the production URL.
        </div>
      )}

      <form className="gate__form" onSubmit={submit}>
        <label className="field">
          <span>Admin token</span>
          <input
            className="input"
            type="password"
            value={token}
            autoComplete="current-password"
            onChange={(event) => setToken(event.target.value)}
            placeholder="ADMIN_TOKEN"
          />
        </label>

        {error && <p className="error" role="alert">{error}</p>}

        <button className="btn btn--primary" type="submit" disabled={busy || token.trim() === ''}>
          {busy ? 'Checking…' : 'Unlock builder'}
        </button>
      </form>
    </div>
  );
}
