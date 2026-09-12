'use client';

import { useEffect, useState } from 'react';
import { useCopy } from './StatsCard';

/**
 * Shareable link, embed code and social shortcuts for a quiz.
 * The public address is the short id, which is always stable; the custom slug
 * is offered as a friendlier alternative when one is set.
 */
export default function ShareBox({ id, title, slug }: { id: string; title: string; slug: string | null }) {
  const [origin, setOrigin] = useState('');
  const { copied, copy } = useCopy();

  // Read the origin after mount so server and client markup agree.
  useEffect(() => setOrigin(window.location.origin), []);

  const shortUrl = `${origin}/q/${id}`;
  const slugUrl = slug ? `${origin}/q/${slug}` : null;
  const embedCode = `<iframe src="${shortUrl}?embed=1" title="${title.replace(/"/g, '&quot;')}" style="width:100%;max-width:720px;height:640px;border:0" loading="lazy"></iframe>`;

  return (
    <section className="card">
      <h2>Share</h2>

      <label className="field">
        <span>Link</span>
        <input className="input" readOnly value={shortUrl} onFocus={(event) => event.target.select()} />
      </label>
      <button className="btn btn--ghost btn--block" onClick={() => void copy(shortUrl, 'link')}>
        {copied === 'link' ? 'Link copied' : 'Copy link'}
      </button>

      {slugUrl && (
        <>
          <label className="field">
            <span>Friendly link</span>
            <input className="input" readOnly value={slugUrl} onFocus={(event) => event.target.select()} />
          </label>
          <button className="btn btn--ghost btn--block" onClick={() => void copy(slugUrl, 'slug')}>
            {copied === 'slug' ? 'Link copied' : 'Copy friendly link'}
          </button>
        </>
      )}

      <h3 className="card__sub">Embed on a website</h3>
      <textarea className="input input--code" readOnly rows={3} value={embedCode} onFocus={(event) => event.target.select()} />
      <button className="btn btn--ghost btn--block" onClick={() => void copy(embedCode, 'embed')}>
        {copied === 'embed' ? 'Embed code copied' : 'Copy embed code'}
      </button>

      <h3 className="card__sub">Share</h3>
      <div className="share">
        <a
          className="btn btn--ghost"
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shortUrl)}&text=${encodeURIComponent(title)}`}
          target="_blank"
          rel="noreferrer"
        >
          X
        </a>
        <a
          className="btn btn--ghost"
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shortUrl)}`}
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn
        </a>
        <a
          className="btn btn--ghost"
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shortUrl)}`}
          target="_blank"
          rel="noreferrer"
        >
          Facebook
        </a>
        <a className="btn btn--ghost" href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shortUrl)}`}>
          Email
        </a>
      </div>
    </section>
  );
}
