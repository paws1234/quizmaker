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
        Quizzes are created and edited here. Enter the admin token that is set in <code>.env</code> as{' '}
        <code>ADMIN_TOKEN</code>.
      </p>

      {!configured && (
        <div className="notice notice--bad" role="alert">
          The server has no <code>ADMIN_TOKEN</code> configured, so the builder stays locked. Add one to{' '}
          <code>.env</code> and restart the stack.
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
