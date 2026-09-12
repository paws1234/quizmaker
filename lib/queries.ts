/**
 * GraphQL documents used by the UI, kept in one place so the API surface is
 * easy to review. Field selections mirror `lib/types.ts`.
 */

const QUIZ_SETTINGS = `
  settings {
    requireOptIn
    optInText
    showCorrectAnswers
    allowRetake
    primaryColor
    logoUrl
    expiresAt
  }
`;

const QUIZ_STATS = `
  stats {
    starts
    completions
    averageScore
    mostMissed { questionId text misses correct }
  }
`;

export const PUBLIC_QUIZ = /* GraphQL */ `
  query PublicQuiz($id: ID!) {
    quiz(id: $id) {
      id
      slug
      title
      description
      ${QUIZ_SETTINGS}
      questions { id text order options { id text } }
    }
  }
`;

export const START_QUIZ = /* GraphQL */ `
  mutation StartQuiz($id: ID!) {
    startQuiz(id: $id) { id started totalQuestions }
  }
`;

export const SUBMIT_QUIZ = /* GraphQL */ `
  mutation SubmitQuiz($input: SubmitQuizInput!) {
    submitQuiz(input: $input) {
      id
      score
      total
      percent
      results { questionId chosenOptionId correctOptionId correct explanation }
    }
  }
`;

export const ADMIN_QUIZ_LIST = /* GraphQL */ `
  query QuizList {
    quizzes {
      id
      slug
      title
      description
      updatedAt
      questionCount
      ${QUIZ_STATS}
    }
  }
`;

const ADMIN_QUIZ_FIELDS = /* GraphQL */ `
  id
  slug
  title
  description
  createdAt
  updatedAt
  ${QUIZ_SETTINGS}
  ${QUIZ_STATS}
  questions {
    id
    text
    order
    options { id text }
    correctOptionId
    explanation
  }
`;

export const ADMIN_QUIZ = /* GraphQL */ `
  query AdminQuiz($id: ID!) {
    adminQuiz(id: $id) { ${ADMIN_QUIZ_FIELDS} }
  }
`;

export const CREATE_QUIZ = /* GraphQL */ `
  mutation CreateQuiz($input: CreateQuizInput!) {
    adminCreateQuiz(input: $input) { ${ADMIN_QUIZ_FIELDS} }
  }
`;

export const UPDATE_QUIZ = /* GraphQL */ `
  mutation UpdateQuiz($id: ID!, $input: UpdateQuizInput!) {
    adminUpdateQuiz(id: $id, input: $input) { ${ADMIN_QUIZ_FIELDS} }
  }
`;

export const DELETE_QUIZ = /* GraphQL */ `
  mutation DeleteQuiz($id: ID!) {
    adminDeleteQuiz(id: $id)
  }
`;
