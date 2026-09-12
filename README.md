# Quiz Maker

A headless quiz app: **Next.js** frontend, **GraphQL** API, **MongoDB** for storage — and
everything, including the database and the dev server, runs in Docker.

Create a quiz, share the link, watch how people do. Quizzes live in a database volume rather
than inside the app, so they survive rebuilds, redeploys and code changes.

```
┌──────────────────────┐   GraphQL over HTTP   ┌─────────────────────────┐
│  Next.js             │ ◄───────────────────► │  GraphQL API (Yoga)     │
│  player + builder    │                       │  /api/graphql           │
└──────────────────────┘                       └───────────┬─────────────┘
                                                           │ Mongoose
                                                           ▼
                                               ┌─────────────────────────┐
                                               │  MongoDB 7              │
                                               │  volume: mongo-data     │
                                               └─────────────────────────┘
```

---

## Quick start

```bash
cp .env.example .env                 # then edit .env
# generate the two secrets:
#   openssl rand -hex 24   -> ADMIN_TOKEN
#   openssl rand -hex 16   -> MONGO_ROOT_PASSWORD
# and set HOST_UID / HOST_GID to your user (`id -u`, `id -g`)

docker compose up --build            # first run takes a minute or two
open http://localhost:3000           # or just visit it
```

Compose prints nothing useful about readiness, so wait for the healthcheck:

```bash
docker compose ps                    # both services should say "healthy"
```

Then:

| URL | What it is |
|-----|------------|
| http://localhost:3000 | Landing page |
| http://localhost:3000/builder | Quiz builder (asks for `ADMIN_TOKEN`) |
| http://localhost:3000/q/<id> | A quiz, e.g. `/q/marketing-basics` |
| http://localhost:3000/api/graphql | The API. GraphiQL is served here in dev mode |

There is a demo quiz seeded with:

```bash
ADMIN_TOKEN=$(grep '^ADMIN_TOKEN=' .env | cut -d= -f2) node scripts/seed.mjs
```

## What runs where

| Service | Image / build | Port | Notes |
|---------|---------------|------|-------|
| `web` | `Dockerfile` target `dev` | `127.0.0.1:3000` | Next.js dev server; source is bind-mounted, so edits hot-reload |
| `mongo` | `mongo:7` | `127.0.0.1:27017` | Not exposed on the network by default |

Named volumes: `mongo-data` (the quizzes), `web_node_modules` and `web_next` (dependencies and
build output, kept out of your working tree).

Docker creates empty `node_modules/` and `.next/` directories as mount points the first time you
start the stack. They stay empty — the installed packages and the build output live in the volumes
— and both are git-ignored, so leave them alone rather than running `npm install` on the host.

Both published ports bind to `127.0.0.1` only. Change `WEB_BIND` / `MONGO_BIND` if you need
them reachable from elsewhere — but read [Security](#security) first.

---

## Using it

1. **Open the builder** at `/builder` and sign in with the `ADMIN_TOKEN` from `.env`. The token
   is exchanged for an httpOnly cookie, so it is not kept in page script.
2. **Create a quiz**, add questions, mark one option per question as correct (the radio button on
   the left), and optionally write an explanation.
3. **Set up branding and rules**: brand colour, logo, consent step, whether correct answers are
   shown afterwards, retakes, and an optional expiry.
4. **Save**, then share the link. The Share panel also gives you an iframe snippet for embedding
   the quiz on any website, plus social shortcuts.
5. **Watch the analytics**: starts, completions, average score and the questions people miss most.

### Adding a question over the API

The builder is only one client — anything can talk to the same endpoint:

```bash
ADMIN_TOKEN=$(grep '^ADMIN_TOKEN=' .env | cut -d= -f2)

curl -s http://localhost:3000/api/graphql \
  -H 'content-type: application/json' \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{"query":"mutation { adminCreateQuiz(input: { title: \"Geography\", questions: [{ text: \"Capital of France?\", options: [{id:\"a\",text:\"Paris\"},{id:\"b\",text:\"Lyon\"}], correctOptionId: \"a\" }] }) { id } }"}'
```

The public game endpoint needs no token:

```bash
curl -s http://localhost:3000/api/graphql -H 'content-type: application/json' \
  -d '{"query":"{ quiz(id: \"marketing-basics\") { title questions { text options { text } } } }"}'
```

---

## How the data is shaped

One MongoDB document per quiz, with questions embedded (a quiz is always read and written as a
whole). See `lib/models/quiz.ts`.

```jsonc
{
  "id": "6165xpq",                  // 7-char public id, used in /q/<id>
  "slug": "marketing-basics",       // optional friendly URL
  "version": 1,
  "title": "Marketing Basics Quiz",
  "description": "...",
  "settings": {
    "requireOptIn": true,
    "optInText": "I agree to take part...",
    "showCorrectAnswers": true,
    "allowRetake": true,
    "primaryColor": "#4f46e5",
    "logoUrl": null,
    "expiresAt": null
  },
  "questions": [
    {
      "id": "qfzdtkv0sk",
      "text": "What does SEO stand for?",
      "options": [{ "id": "a", "text": "Search Engine Optimization" }],
      "correctOptionId": "a",
      "explanation": "...",
      "order": 0
    }
  ],
  "stats": {
    "starts": 12, "completions": 9, "totalScore": 31,
    "questionStats": { "qfzdtkv0sk": { "misses": 2, "correct": 7 } }
  }
}
```

Two rules keep this sane:

- **The answer key never reaches the player.** The public `quiz` query has no `correctOptionId`
  field at all (asking for it is a schema error), and scoring happens on the server in
  `submitQuiz`. Opening the player page and reading the HTML shows no answers.
- **Anything a client sends is validated.** `lib/graphql/normalise.ts` caps sizes, checks that
  each question has a correct option that actually exists, validates the brand colour and logo
  URL, and rejects duplicate slugs. Bad input comes back as `BAD_USER_INPUT`, not a 500.

---

## Repository layout

```
app/
  api/graphql/route.ts        GraphQL Yoga endpoint (the whole API surface)
  api/admin/session/route.ts  builder sign-in / sign-out
  api/health/route.ts         liveness + database probe (used by the healthcheck)
  q/[id]/page.tsx             public player: reads the quiz on the server, then hydrates
  builder/                    quiz list and editor
  globals.css                 all styling (plain CSS, tokens at the top)
components/                   player, builder, share box, analytics card
lib/
  graphql/                    schema, resolvers, validation, auth, server-side execution
  models/quiz.ts              Mongoose model
  db.ts                       cached connection
scripts/smoke.mjs             end-to-end API test
scripts/seed.mjs              demo quiz
Dockerfile                    dev / build / runner targets
docker-compose.yml            dev stack (default)
docker-compose.prod.yml       production overlay
docker-compose.external-db.yml  use a hosted MongoDB instead of the container
```

## Development workflow

The dev container mounts the source tree, so **edit files on the host and the browser updates**:

```bash
docker compose up -d          # start (or start again after a reboot)
docker compose logs -f web    # follow the dev server
docker compose restart web    # after changing .env or next.config.ts
docker compose down           # stop; quizzes stay in the volume
docker compose down -v        # stop and delete the database too
```

After changing `package.json` (or pulling a change that did), rebuild the image:

```bash
docker compose up -d --build
```

Checks:

```bash
docker compose run --rm --no-deps -T web npm run typecheck        # types
docker compose run --rm --no-deps -T web npm run build            # production build
ADMIN_TOKEN=$(grep '^ADMIN_TOKEN=' .env | cut -d= -f2) node scripts/smoke.mjs
```

`npm run typecheck` alone does **not** catch route-handler signature problems that only appear in
a production build, so run `npm run build` (or the prod stack) before shipping.

## Production mode

`docker-compose.prod.yml` is an overlay: same services, same database volume, but the app is
served from a compiled standalone build with no bind mounts.

```bash
docker compose down                                       # stop the dev server first
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

| | dev | production overlay |
|---|---|---|
| Build target | `dev` | `runner` (`.next/standalone`, no `node_modules`) |
| Source | bind-mounted, hot reload | baked into the image |
| GraphiQL | enabled | disabled |
| `ADMIN_TOKEN` | defaults to a placeholder | must be set, compose refuses to start without it |

Both share `mongo-data`, so anything you built while developing is already there.

The two modes build different image tags (`quize-web:dev` and `quize-web:prod`). That matters:
with a single shared tag the last build wins, and `docker compose up` would quietly serve the
production image as the dev service — which then fails because the production image runs as a
different uid than the dependency volume it is handed.

### Backups

Scope the dump to the application database. A plain `mongodump` also captures `admin.system.users`,
and restoring that into a hosted cluster replaces its user accounts with your local ones — you are
locked out of the cluster you were moving to, mid-restore.

```bash
# dump (application database only)
docker compose exec -T mongo sh -c 'mongodump --db "$MONGO_INITDB_DATABASE" --archive --gzip --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' > quizzes-$(date +%F).archive.gz

# restore into the local container
docker compose exec -T mongo sh -c 'mongorestore --archive --gzip --drop --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' < quizzes-2026-09-12.archive.gz

# restore into a hosted cluster (the mongo image has the tools; it needs a route to the cluster)
docker run --rm -i mongo:7 mongorestore \
  --uri "mongodb+srv://user:password@cluster0.abcde.mongodb.net/quiz" \
  --archive --gzip --drop < quizzes-2026-09-12.archive.gz
```

`$MONGO_INITDB_DATABASE` is set inside the mongo container and names the application database
(`quiz` unless you changed `MONGO_DB`).

### Using a hosted MongoDB

The database does not have to live in Docker: Atlas, another managed provider or a server of your
own all work, as long as the app can reach it over the network.

1. **Create the cluster and a database user.** On Atlas that is a free cluster plus
   *Database Access → Add New Database User*. Copy the password now; Atlas will not show it again.

2. **Allow the connection.** Atlas → *Network Access* → add the public IP of the machine running
   Docker (`curl -s ifconfig.me`). `0.0.0.0/0` means “anyone”, so use it only while testing.

3. **Copy the connection string** (Atlas → *Connect* → *Drivers*):

   ```
   mongodb+srv://quizuser:<password>@cluster0.abcde.mongodb.net/quiz?retryWrites=true&w=majority
   ```

   Keep the `/quiz` part — that is the database name. Without it everything lands in a database
   called `test`. If the password contains `@ : / ? # %`, percent-encode it (`@` → `%40`,
   `:` → `%3A`); Atlas-generated passwords usually need this.

4. **Put it in `.env`** (git-ignored, never committed):

   ```
   MONGODB_URI=mongodb+srv://quizuser:p%40ss%3Aw0rd@cluster0.abcde.mongodb.net/quiz?retryWrites=true&w=majority
   ```

   `MONGODB_URI` takes priority over the locally built URI in every mode. Leave it unset and the
   stack keeps using its own container.

5. **Start the app without the local database:**

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.external-db.yml up -d --build web
   ```

   Only `web` is named, so the `mongo` service is never created. Stopping is just
   `docker compose down` — the plain file is enough, whichever mode you started in.

6. **Check which database you are actually on:**

   ```bash
   curl -s localhost:3000/api/health
   # {"ok":true,"database":"up","host":"cluster0-shard-00-02.abcde.mongodb.net","db":"quiz"}
   ```

   `host` and `db` are reported outside production, so a stale line in `.env` is obvious at a
   glance. If it says `database: down`, the response carries the driver's error — a wrong password,
   an IP missing from the allowlist, or a DNS failure are the usual causes.

7. **Move existing quizzes across** with the backup commands above, restoring into the cluster.

Production with a hosted database is the same plus the production overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.external-db.yml up -d --build web
```

Worth knowing:

- `mongodb+srv://` needs SRV DNS lookups. Those work from inside the container on this machine
  (checked against a public SRV record), but if your resolver blocks them the driver fails with
  `querySrv ENOTFOUND`; Atlas also offers a standard `mongodb://host1,host2,host3/...` string that
  avoids SRV entirely.
- `+srv` is for clusters, not for anything local. It is a DNS *seed list*, so the host has to
  publish `_mongodb._tcp.<host>` SRV records — and a single-node container on the compose network
  publishes none, which is why `mongodb+srv://…@mongo/…` fails immediately with
  `querySrv ENOTFOUND _mongodb._tcp.mongo`. Keep the built-in `mongodb://…@mongo:27017/…` for local
  work and use the `+srv` form only where a provider hands you one (or where you publish the
  records yourself for a self-hosted replica set).
- With the local container out of the picture, `MONGO_ROOT_*` in `.env` are unused, and
  `MONGODB_URI` plus `ADMIN_TOKEN` are the only secrets that matter.
- Switching back is nothing more than clearing `MONGODB_URI` and running `docker compose up -d
  --build` again; the `mongo-data` volume is untouched in the meantime.

---

## Security

What is in place:

- The builder and every `admin*` operation require `ADMIN_TOKEN`, compared in constant time.
  If the variable is unset the builder fails **closed** rather than opening up.
- The admin token is stored in an httpOnly, `SameSite=strict` cookie; the browser cannot read it
  and another site cannot replay it.
- Answer keys are absent from the public schema, from the rendered HTML and from the API.
- MongoDB is not reachable from the network: it is published on loopback only, with auth on.
- Quizzes are addressable by a random 7-character id, not by a guessable sequential number.
- The player is embeddable in an iframe (no `X-Frame-Options`), by design.

What is *not* in place — read this before putting it on the internet:

- **No per-user accounts.** One shared admin token. Anyone with it can edit every quiz.
- **No HTTPS.** Put it behind a TLS-terminating reverse proxy (Caddy, nginx, Traefik) and then
  add `secure: true` to the cookie in `app/api/admin/session/route.ts`. Without HTTPS that cookie
  is sent in clear text on the local network.
- **No rate limiting.** The public `startQuiz` / `submitQuiz` mutations can be called by anyone
  who has a quiz link, which is also how the analytics counters can be inflated.
- **No password-protected quizzes and no per-quiz access control.** Expiry is supported; password
  protection is not (see below).

## Not built yet

Deliberately out of scope for the current cut, in rough priority order:

- Password-protected quizzes (the model has `expiresAt`, but no password field).
- Question types beyond single-answer multiple choice.
- Drag-and-drop reordering (up/down buttons work today).
- Custom domains / white-labelling, quiz duplication, CSV import.

## Notes on this machine

- The image appends `precedence ::ffff:0:0/96 100` to `/etc/gai.conf`: containers here receive
  AAAA answers but have no IPv6 route, which otherwise makes `npm` and `curl` hang until timeout.
- `.next` is a named volume, so the image creates `/app/.next` owned by the runtime user. Without
  that, a fresh volume is root-owned and the dev server dies with `EACCES`.
- The dev container runs as your uid/gid (`HOST_UID`/`HOST_GID`), so files written through the
  bind mount stay yours.
