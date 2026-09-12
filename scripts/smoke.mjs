#!/usr/bin/env node
/**
 * End-to-end smoke test for the GraphQL API.
 *
 *   docker compose up -d --build
 *   ADMIN_TOKEN=$(grep '^ADMIN_TOKEN=' .env | cut -d= -f2) node scripts/smoke.mjs
 *
 * It creates a throwaway quiz, plays it, checks the analytics it produced and
 * deletes it again, so it is safe to run against the dev stack.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

let failures = 0;

function check(name, passed, detail = '') {
  const label = passed ? 'PASS' : 'FAIL';
  if (!passed) failures += 1;
  console.log(`${label}  ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function gql(query, variables, { admin = false } = {}) {
  const response = await fetch(`${BASE}/api/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(admin && ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json().catch(() => ({}));
  return { status: response.status, data: payload.data ?? null, errors: payload.errors ?? [] };
}

const codeOf = (result) => result.errors[0]?.extensions?.code;

const CREATE = `
  mutation Create($input: CreateQuizInput!) {
    adminCreateQuiz(input: $input) {
      id slug title questions { id correctOptionId options { id text } }
      settings { requireOptIn optInText primaryColor showCorrectAnswers }
    }
  }
`;

const PUBLIC = `
  query Public($id: ID!) {
    quiz(id: $id) { id title questions { id text options { id text } } }
  }
`;

const ADMIN_QUIZ = `
  query Admin($id: ID!) {
    adminQuiz(id: $id) {
      id title slug stats { starts completions averageScore mostMissed { questionId misses correct } }
    }
  }
`;

const SUBMIT = `
  mutation Submit($input: SubmitQuizInput!) {
    submitQuiz(input: $input) {
      score total percent
      results { questionId correct correctOptionId explanation }
    }
  }
`;

const input = {
  title: 'Smoke test quiz',
  description: 'Created by scripts/smoke.mjs',
  slug: 'smoke-test-quiz',
  settings: { requireOptIn: true, optInText: 'I agree to take part.', primaryColor: '#0ea5e9' },
  questions: [
    {
      text: 'What does SEO stand for?',
      options: [
        { id: 'a', text: 'Search Engine Optimization' },
        { id: 'b', text: 'Social Engagement Optimization' },
      ],
      correctOptionId: 'a',
      explanation: 'SEO is Search Engine Optimization.',
    },
    {
      text: 'Which metric tracks cost per click?',
      options: [
        { id: 'a', text: 'CPC' },
        { id: 'b', text: 'LTV' },
      ],
      correctOptionId: 'a',
    },
  ],
};

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  // --- health -------------------------------------------------------------
  const health = await fetch(`${BASE}/api/health`).then((response) => response.json()).catch(() => null);
  check('web + database healthy', health?.ok === true, JSON.stringify(health));

  // --- authorisation ------------------------------------------------------
  const anonymous = await gql(CREATE, { input: { title: 'nope' } });
  check('create without a token is refused', codeOf(anonymous) === 'UNAUTHENTICATED', codeOf(anonymous) ?? '');

  if (!ADMIN_TOKEN) {
    console.log('\nADMIN_TOKEN not set in the environment; stopping after auth checks.');
    return;
  }

  // --- create -------------------------------------------------------------
  const created = await gql(CREATE, { input }, { admin: true });
  const quiz = created.data?.adminCreateQuiz;
  check('create returns a quiz', Boolean(quiz?.id), JSON.stringify(created.errors));
  if (!quiz) return;

  check('short id is url friendly', /^[a-z0-9]{7}$/.test(quiz.id), quiz.id);
  check('slug is stored', quiz.slug === 'smoke-test-quiz', String(quiz.slug));
  check('answer key is stored for the builder', quiz.questions?.[0]?.correctOptionId === 'a');

  // --- public surface -----------------------------------------------------
  const publicQuiz = await gql(PUBLIC, { id: quiz.id });
  check('public query returns the quiz', publicQuiz.data?.quiz?.title === 'Smoke test quiz');
  check(
    'public query does not expose the option list ordering key',
    JSON.stringify(publicQuiz.data?.quiz?.questions?.[0] ?? {}).includes('correctOptionId') === false,
  );

  const leak = await gql(
    `query Leak($id: ID!) { quiz(id: $id) { questions { correctOptionId } } }`,
    { id: quiz.id },
  );
  check('asking the public API for the answer key is a schema error', leak.errors.length > 0, codeOf(leak));

  // --- play ---------------------------------------------------------------
  const started = await gql(`mutation S($id: ID!) { startQuiz(id: $id) { started totalQuestions } }`, {
    id: quiz.id,
  });
  check('startQuiz reports the question count', started.data?.startQuiz?.totalQuestions === 2, JSON.stringify(started.errors));

  const questionIds = quiz.questions.map((question) => question.id);
  const first = await gql(SUBMIT, {
    input: {
      id: quiz.id,
      answers: [
        { questionId: questionIds[0], optionId: 'a' }, // correct
        { questionId: questionIds[1], optionId: 'b' }, // wrong
      ],
    },
  });
  check('scoring is server side', first.data?.submitQuiz?.score === 1 && first.data?.submitQuiz?.total === 2, JSON.stringify(first.data?.submitQuiz));
  check('percentage is reported', first.data?.submitQuiz?.percent === 50, String(first.data?.submitQuiz?.percent));
  check(
    'answer key is revealed after submitting when the quiz allows it',
    first.data?.submitQuiz?.results?.[1]?.correctOptionId === 'a' &&
      first.data?.submitQuiz?.results?.[0]?.explanation === 'SEO is Search Engine Optimization.',
  );

  const second = await gql(SUBMIT, {
    input: { id: quiz.id, answers: questionIds.map((questionId) => ({ questionId, optionId: 'b' })) },
  });
  check('a second attempt scores independently', second.data?.submitQuiz?.score === 0);

  // --- analytics ----------------------------------------------------------
  const stats = (await gql(ADMIN_QUIZ, { id: quiz.id }, { admin: true })).data?.adminQuiz?.stats;
  check('starts are counted', stats?.starts === 1, `starts=${stats?.starts}`);
  check('completions are counted', stats?.completions === 2, `completions=${stats?.completions}`);
  check('average score is computed', stats?.averageScore === 0.5, `average=${stats?.averageScore}`);
  check('most missed questions are tracked', (stats?.mostMissed?.length ?? 0) === 2, JSON.stringify(stats?.mostMissed));

  // Attempt 1 answered Q1 correctly and Q2 wrongly; attempt 2 got both wrong.
  const byQuestion = new Map((stats?.mostMissed ?? []).map((entry) => [entry.questionId, entry]));
  check(
    'misses and correct answers are tracked per question',
    byQuestion.get(questionIds[0])?.correct === 1 &&
      byQuestion.get(questionIds[0])?.misses === 1 &&
      byQuestion.get(questionIds[1])?.correct === 0 &&
      byQuestion.get(questionIds[1])?.misses === 2,
    JSON.stringify(stats?.mostMissed),
  );

  // --- validation ---------------------------------------------------------
  const duplicateSlug = await gql(CREATE, { input: { title: 'Clash', slug: 'smoke-test-quiz' } }, { admin: true });
  check('duplicate slugs are rejected', codeOf(duplicateSlug) === 'BAD_USER_INPUT', codeOf(duplicateSlug) ?? '');

  const noAnswer = await gql(
    CREATE,
    {
      input: {
        title: 'No answer',
        questions: [{ text: 'Q', options: [{ text: 'one' }, { text: 'two' }] }],
      },
    },
    { admin: true },
  );
  check('a question without a correct answer is rejected', codeOf(noAnswer) === 'BAD_USER_INPUT', codeOf(noAnswer) ?? '');

  const badColour = await gql(
    CREATE,
    { input: { title: 'Bad colour', settings: { primaryColor: 'red; background: url(x)' } } },
    { admin: true },
  );
  check('a non-hex brand colour is rejected', codeOf(badColour) === 'BAD_USER_INPUT', codeOf(badColour) ?? '');

  const missing = await gql(`query M { quiz(id: "doesnotexist") { id } }`);
  check('an unknown quiz resolves to null', missing.data?.quiz === null);

  const submitMissing = await gql(SUBMIT, { input: { id: 'doesnotexist', answers: [] } });
  check('submitting to an unknown quiz is NOT_FOUND', codeOf(submitMissing) === 'NOT_FOUND', codeOf(submitMissing) ?? '');

  // --- lookup by slug -----------------------------------------------------
  const bySlug = await gql(PUBLIC, { id: 'smoke-test-quiz' });
  check('custom slug resolves to the same quiz', bySlug.data?.quiz?.id === quiz.id);

  // --- cleanup ------------------------------------------------------------
  const deleted = await gql(`mutation D($id: ID!) { adminDeleteQuiz(id: $id) }`, { id: quiz.id }, { admin: true });
  check('delete removes the quiz', deleted.data?.adminDeleteQuiz === true);

  const gone = await gql(PUBLIC, { id: quiz.id });
  check('the deleted quiz is gone', gone.data?.quiz === null);

  // the validation probes may have created stray quizzes; remove them too
  const list = await gql(`query L { quizzes { id title } }`, {}, { admin: true });
  for (const stray of list.data?.quizzes ?? []) {
    if (stray.title === 'Clash' || stray.title === 'No answer' || stray.title === 'Bad colour') {
      await gql(`mutation D($id: ID!) { adminDeleteQuiz(id: $id) }`, { id: stray.id }, { admin: true });
    }
  }
}

main()
  .catch((error) => {
    failures += 1;
    console.error('FAIL  unexpected error', error);
  })
  .finally(() => {
    console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
