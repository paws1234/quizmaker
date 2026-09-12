/**
 * GraphQL schema.
 *
 * Two audiences, two surfaces:
 *   - the player: `quiz`, `startQuiz`, `submitQuiz` - answer keys never appear
 *   - the builder: `quizzes`, `adminQuiz`, `admin*` mutations - admin session only
 *
 * Scoring happens on the server, so the correct answers are not shipped to the
 * browser before a submission.
 */
export const typeDefs = /* GraphQL */ `
  scalar DateTime

  type Option {
    id: ID!
    text: String!
  }

  "A question as the player sees it: no answer key."
  type Question {
    id: ID!
    text: String!
    options: [Option!]!
    order: Int!
  }

  "A question as the builder sees it, including the answer key."
  type AdminQuestion {
    id: ID!
    text: String!
    options: [Option!]!
    correctOptionId: ID!
    explanation: String
    order: Int!
  }

  type QuizSettings {
    requireOptIn: Boolean!
    optInText: String
    showCorrectAnswers: Boolean!
    allowRetake: Boolean!
    primaryColor: String
    logoUrl: String
    expiresAt: DateTime
  }

  type MissedQuestion {
    questionId: ID!
    text: String!
    misses: Int!
    correct: Int!
  }

  type QuizStats {
    starts: Int!
    completions: Int!
    averageScore: Float!
    mostMissed: [MissedQuestion!]!
  }

  type Quiz {
    id: ID!
    slug: String
    title: String!
    description: String
    createdAt: DateTime!
    updatedAt: DateTime!
    settings: QuizSettings!
    questions: [Question!]!
    stats: QuizStats!
  }

  type AdminQuiz {
    id: ID!
    slug: String
    title: String!
    description: String
    createdAt: DateTime!
    updatedAt: DateTime!
    settings: QuizSettings!
    questions: [AdminQuestion!]!
    stats: QuizStats!
  }

  type QuizSummary {
    id: ID!
    slug: String
    title: String!
    description: String
    updatedAt: DateTime!
    questionCount: Int!
    stats: QuizStats!
  }

  type StartResult {
    id: ID!
    started: Boolean!
    totalQuestions: Int!
  }

  type AnswerResult {
    questionId: ID!
    chosenOptionId: ID
    correctOptionId: ID
    correct: Boolean!
    explanation: String
  }

  type QuizResult {
    id: ID!
    score: Int!
    total: Int!
    percent: Float!
    results: [AnswerResult!]!
  }

  input OptionInput {
    id: ID
    text: String!
  }

  input QuestionInput {
    id: ID
    text: String!
    options: [OptionInput!]!
    correctOptionId: ID
    explanation: String
  }

  input QuizSettingsInput {
    requireOptIn: Boolean
    optInText: String
    showCorrectAnswers: Boolean
    allowRetake: Boolean
    primaryColor: String
    logoUrl: String
    expiresAt: DateTime
  }

  input CreateQuizInput {
    title: String!
    description: String
    slug: String
    settings: QuizSettingsInput
    questions: [QuestionInput!]
  }

  input UpdateQuizInput {
    title: String
    description: String
    slug: String
    settings: QuizSettingsInput
    "Replaces the whole question list when provided."
    questions: [QuestionInput!]
  }

  input AnswerInput {
    questionId: ID!
    optionId: ID
  }

  input SubmitQuizInput {
    id: ID!
    answers: [AnswerInput!]!
  }

  type Query {
    "Public quiz for the player. Accepts a quiz id or a custom slug."
    quiz(id: ID!): Quiz
    "Builder: every quiz, most recently updated first."
    quizzes: [QuizSummary!]!
    "Builder: one quiz including answer keys."
    adminQuiz(id: ID!): AdminQuiz
  }

  type Mutation {
    "Records a quiz start for analytics."
    startQuiz(id: ID!): StartResult!
    "Scores a submission on the server and records it for analytics."
    submitQuiz(input: SubmitQuizInput!): QuizResult!
    adminCreateQuiz(input: CreateQuizInput!): AdminQuiz!
    adminUpdateQuiz(id: ID!, input: UpdateQuizInput!): AdminQuiz!
    adminDeleteQuiz(id: ID!): Boolean!
  }
`;
