# Quiz Maker – Product Plan (Updated)

A headless, easily modifiable quiz maker built with **Next.js** (frontend) + **GraphQL** (backend).  
Quizzes are stored persistently in **MongoDB** so they survive Vercel redeployments and remain accessible via shareable links.

---

## 1. Goals

| Goal | Description |
|------|-------------|
| **Easy to create** | Non-technical users can build a quiz in minutes |
| **Easy to modify** | Edit questions, answers, branding, or settings without touching code |
| **Shareable links** | Every quiz gets a clean, unique URL that works instantly |
| **Headless** | Quiz data & API can be consumed by any frontend or embed |
| **Persistent** | Quizzes survive Vercel deployments, rebuilds, and domain changes |
| **Modern stack** | Next.js frontend + GraphQL API + MongoDB |

---

## 2. Core Features (MVP)

### Quiz Creation
- Add / edit / delete questions
- Multiple choice (single correct answer)
- Set correct answer + optional explanation
- Reorder questions (drag & drop)
- Quiz title, description, and optional cover image
- Branding: logo, primary color, custom thank-you message

### Opt-in / Consent (optional per quiz)
- Toggleable opt-in checkbox before starting
- Customizable consent text + privacy note

### Player Experience
- Clean, mobile-friendly interface
- Progress bar
- Final score + answer review
- “Retake” button

### Sharing
- Unique shareable link per quiz → `/q/{short-id}`
- Copy-link button + social share buttons
- Embed code (iframe) for websites
- Optional password protection & expiration

### Analytics (lightweight)
- Starts / completions
- Average score
- Most-missed questions

---

## 3. Architecture (Headless)

```
┌─────────────────────┐       GraphQL        ┌──────────────────────────┐
│   Next.js Frontend  │ ◄──────────────────► │  GraphQL API (Headless)  │
│  (Builder + Player) │                      │                          │
└─────────────────────┘                      │  - Queries / Mutations   │
                                             │  - Auth (optional)       │
         ▲                                   └────────────┬─────────────┘
         │ Embed / API                                    │
         │                                                ▼
         │                                   ┌──────────────────────────┐
         └───────────────────────────────────│  Persistent Database     │
                                             │  MongoDB Atlas           │
                                             └──────────────────────────┘
```

**Key principle:** The GraphQL API is the single source of truth.  
The Next.js frontend is just one client. Quizzes can also be consumed by:
- Other websites (via embed or direct GraphQL)
- Mobile apps
- Future frontends

---

## 4. Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Frontend** | **Next.js 15** (App Router) | Builder UI + Quiz Player |
| **API** | **GraphQL** | Apollo Server, GraphQL Yoga, or graphql-yoga |
| **Database** | **MongoDB** | **MongoDB Atlas** (persistent, free tier available) |
| **ODM** | **Mongoose** (recommended) | Clean schema + validation |
| **Hosting** | **Vercel** | Frontend + serverless GraphQL endpoint |
| **Auth** (optional) | NextAuth.js / Clerk / Auth.js | For quiz creators |
| **File storage** | Vercel Blob / Cloudinary / Uploadthing | Logos & cover images |
| **ID generation** | `nanoid` | Short, URL-friendly IDs |

### Why this stack works well
- **Next.js on Vercel** → excellent DX, fast deploys, edge support
- **GraphQL** → flexible queries, perfect for headless architecture
- **MongoDB Atlas** → fully managed, data lives outside Vercel → quizzes **never disappear** on redeploy
- Document model fits quiz data naturally (nested questions & options)
- Fully headless → player can be embedded anywhere

---

## 5. Data Model (MongoDB)

### Quiz Document Example

```json
{
  "_id": "ObjectId(...)",
  "id": "x7k9m2",                    // short public ID (nanoid)
  "slug": "marketing-basics",        // optional custom slug
  "title": "Marketing Basics Quiz",
  "description": "Test your knowledge of core marketing concepts",
  "createdAt": "2026-09-12T10:00:00Z",
  "updatedAt": "2026-09-12T10:00:00Z",
  "settings": {
    "requireOptIn": true,
    "optInText": "I agree to participate...",
    "showCorrectAnswers": true,
    "allowRetake": true,
    "primaryColor": "#4f46e5",
    "logoUrl": null,
    "password": null,
    "expiresAt": null
  },
  "questions": [
    {
      "id": "q1",
      "text": "What does SEO stand for?",
      "options": [
        { "id": "a", "text": "Search Engine Optimization" },
        { "id": "b", "text": "Social Engagement Optimization" },
        { "id": "c", "text": "Site Experience Optimization" },
        { "id": "d", "text": "Search Entry Order" }
      ],
      "correctOptionId": "a",
      "explanation": "SEO is Search Engine Optimization.",
      "order": 0
    }
  ],
  "stats": {
    "starts": 0,
    "completions": 0,
    "totalScore": 0
  }
}
```

### GraphQL Types (simplified)

```graphql
type Quiz {
  id: ID!                 # short nanoid
  slug: String
  title: String!
  description: String
  createdAt: DateTime!
  updatedAt: DateTime!
  settings: QuizSettings!
  questions: [Question!]!
  stats: QuizStats
}

type QuizSettings {
  requireOptIn: Boolean!
  optInText: String
  showCorrectAnswers: Boolean!
  allowRetake: Boolean!
  primaryColor: String
  logoUrl: String
  password: String
  expiresAt: DateTime
}

type Question {
  id: ID!
  text: String!
  options: [Option!]!
  correctOptionId: ID!     # hidden from public player queries
  explanation: String
  order: Int!
}

type Option {
  id: ID!
  text: String!
}
```

### Example GraphQL Operations

```graphql
# Public – Get quiz for player (hides correct answers)
query GetQuiz($id: ID!) {
  quiz(id: $id) {
    id
    title
    description
    settings {
      requireOptIn
      optInText
      primaryColor
      showCorrectAnswers
      allowRetake
    }
    questions {
      id
      text
      options { id text }
      order
    }
  }
}

# Authenticated – Create quiz
mutation CreateQuiz($input: CreateQuizInput!) {
  createQuiz(input: $input) {
    id
    title
  }
}
```

---

## 6. Shareable Links & Persistence

- URL format: `https://yourdomain.com/q/x7k9m2`
- The page calls the GraphQL API → `quiz(id: "x7k9m2")`
- Data lives in **MongoDB Atlas** (not inside the Vercel deployment)

**Result:** Quizzes remain available even if you:
- Redeploy the Next.js app
- Delete and recreate the Vercel project
- Change domains (just point the new frontend to the same GraphQL API + MongoDB)

**Recommended setup:**
- MongoDB Atlas → free/shared cluster
- GraphQL API → GraphQL Yoga or Apollo Server running on Vercel serverless (or a separate small service)
- Next.js frontend → Vercel

---

## 7. Implementation Phases

### Phase 1 – Foundation
- [ ] Set up Next.js project (App Router)
- [ ] Create MongoDB Atlas cluster + database
- [ ] Add Mongoose models for Quiz
- [ ] Set up GraphQL API (GraphQL Yoga or Apollo Server)
- [ ] Build the public Quiz Player page (`/q/[id]`)
- [ ] Load quiz data via GraphQL and render the player UI

### Phase 2 – Quiz Builder
- [ ] Create protected Builder UI (`/builder` or `/dashboard`)
- [ ] Forms to add/edit/delete questions
- [ ] Live preview
- [ ] Save quiz via GraphQL mutation
- [ ] Generate and display shareable link

### Phase 3 – Polish & Sharing
- [ ] Opt-in support
- [ ] Branding (color, logo)
- [ ] Copy link + social share buttons
- [ ] Basic embed code
- [ ] Simple analytics (starts, completions, average score)

### Phase 4 – Nice-to-haves
- [ ] Password protection
- [ ] Expiration dates
- [ ] Drag-and-drop question reordering
- [ ] Multiple question types
- [ ] Custom domains / white-labeling

---

## 8. Easy Modification Strategy

1. **Headless by design**  
   All quiz logic and data live behind GraphQL. The Next.js UI can be completely replaced later without touching the data.

2. **Single source of truth**  
   MongoDB + GraphQL schema. Frontend never stores quiz content permanently.

3. **Configuration over code**  
   Colors, texts, feature flags live in `settings`.

4. **Schema versioning**  
   Add a `version` field to quizzes so future changes stay backward-compatible.

5. **Clear separation**
   - `/app/q/[id]/page.tsx` → Player only
   - `/app/builder/*` → Creator UI only
   - GraphQL layer + Mongoose models → all business logic & persistence

---

## 9. Example User Flows

**Creator**
1. Log in → open Builder
2. Create title + questions
3. Configure opt-in / branding
4. Click Publish
5. Copy shareable link (`/q/x7k9m2`)

**Player**
1. Open the link
2. (Optional) Accept opt-in
3. Answer questions
4. See score + review
5. Retake if allowed

---

## 10. Success Metrics

- Time to create first quiz < 5 minutes
- Shareable links work immediately and permanently
- Quizzes remain accessible after Vercel redeploys
- Mobile-friendly completion experience
- Easy to swap or rebuild the frontend later (true headless)

---

## 11. Next Immediate Steps

1. Initialize Next.js project
2. Create MongoDB Atlas cluster and `quizzes` collection
3. Set up Mongoose + GraphQL API (Yoga or Apollo)
4. Port the existing sample player into `/q/[id]` and connect it to GraphQL
5. Build a minimal builder that can create and save a quiz

---

**This updated plan fully supports:**
- Next.js frontend
- GraphQL-only backend
- MongoDB as the persistent database
- Headless architecture
- Quizzes that survive any Vercel deployment changes

---

## 12. Hosting revision (implemented)

The plan above assumed **Vercel + MongoDB Atlas**. What was actually built keeps every
architectural decision (headless GraphQL, MongoDB, Next.js) but runs the whole stack in Docker:

| Planned | Built |
|---------|-------|
| Vercel (frontend + serverless GraphQL) | One Next.js container serving both the UI and `/api/graphql` |
| MongoDB Atlas | `mongo:7` container with the `mongo-data` volume |
| Vercel Blob / Cloudinary | A logo **URL** field — hosting images stays outside the app |

Persistence is unaffected: quizzes live in a Docker volume, not in the image, so they survive
rebuilds, redeploys and code changes — the same guarantee Atlas gave. `MONGODB_URI` is the only
thing that has to change to point this app back at Atlas (see the README).

Also settled during implementation:

- Scoring moved **server side** (`submitQuiz`). The public schema has no `correctOptionId` field,
  so the answer key never reaches the browser — the plan's "hidden from public player queries"
  is enforced by the schema rather than by convention.
- The builder is protected by a single `ADMIN_TOKEN` (exchanged for an httpOnly cookie). NextAuth
  stays optional and unbuilt; one shared token is the whole of "authenticated" today.
- Phases 1–3 are implemented. Phase 4 is not, except quiz expiry.
