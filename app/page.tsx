export default function HomePage() {
  return (
    <div className="shell">
      <header className="bar">
        <span className="bar__brand">Quiz Maker</span>
        <div className="bar__actions">
          <a className="btn btn--primary" href="/builder">
            Create a quiz
          </a>
        </div>
      </header>

      <main className="hero">
        <h1>Build a quiz, share a link, see how people did.</h1>
        <p className="muted">
          Create questions, pick the correct answers, add your own colours and logo, then send the link. Every quiz
          lives in MongoDB behind a GraphQL API, so it survives redeploys and can be embedded anywhere.
        </p>
        <div className="hero__actions">
          <a className="btn btn--primary" href="/builder">
            Open the builder
          </a>
        </div>

        <ul className="features">
          <li>
            <h2>Minutes to build</h2>
            <p className="muted">Add, edit and reorder questions; set the answer key and an explanation.</p>
          </li>
          <li>
            <h2>Scored on the server</h2>
            <p className="muted">Answers never reach the browser, so the quiz cannot be cheated by reading the page.</p>
          </li>
          <li>
            <h2>Share or embed</h2>
            <p className="muted">Short links, friendly slugs and an iframe snippet for any website.</p>
          </li>
          <li>
            <h2>Light analytics</h2>
            <p className="muted">Starts, completions, average score and the questions people miss most.</p>
          </li>
        </ul>
      </main>
    </div>
  );
}
