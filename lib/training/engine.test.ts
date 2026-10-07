import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drills, drawRound, initialState, practiceReducer, scoreRound } from './engine';
import { careerSteps, onboardingSteps, fieldLinks } from './roadmap';

test('roadmap has exactly the four approved career stages and complete onboarding resources', () => {
  assert.deepEqual(careerSteps.map(step => step.title), ['Sales Rep', 'Leader', 'Assistant Director/Manager', 'Owner']);
  assert.equal(onboardingSteps.length, 5);
  assert.equal(fieldLinks.length, 7);
  for (const link of fieldLinks) assert.equal(new URL(link.href).protocol, 'https:');
});

for (const key of ['promo', 'pitch'] as const) {
  test(`${key}: imported content is complete and every answer has a study topic`, () => {
    assert.equal(drills[key].bank.length, key === 'promo' ? 69 : 52);
    for (const q of drills[key].bank) {
      assert.ok(drills[key].study[q.topic]?.length);
      assert.ok(q.q && q.a && q.why);
      assert.equal(q.wrong.length, 3);
      assert.equal(new Set([q.a, ...q.wrong]).size, 4);
    }
  });
  test(`${key}: rounds are unique, use all unseen questions, and avoid the last round`, () => {
    let seen: number[] = [];
    let previous: number[] = [];
    const visited = new Set<number>();
    for (let i = 0; i < 12; i++) {
      const pending = drills[key].bank.filter(q => !seen.includes(q.id));
      const next = drawRound(drills[key].bank, seen, previous);
      const ids = next.round.map(q => q.id);
      assert.equal(ids.length, 12);
      assert.equal(new Set(ids).size, 12);
      assert.equal(ids.filter(id => previous.includes(id)).length, 0);
      if (pending.length < 12) assert.ok(pending.every(q => ids.includes(q.id)));
      for (const q of next.round) {
        assert.equal(q.options.length, 4);
        assert.ok(q.options.includes(q.a));
        visited.add(q.id);
      }
      seen = next.seen;
      previous = ids;
    }
    assert.equal(visited.size, drills[key].bank.length);
  });
}

test('answers lock, brush-up preserves state, scores and reviews survive navigation', () => {
  let state = initialState('promo', false);
  state = practiceReducer(state, { type: 'start', ...drawRound(drills.promo.bank, []) });
  assert.equal(practiceReducer(state, { type: 'next' }), state);
  state = practiceReducer(state, { type: 'pick', answer: state.round[0].wrong[0] });
  assert.equal(practiceReducer(state, { type: 'pick', answer: state.round[0].a }), state);
  const picks = state.picks;
  state = practiceReducer(state, { type: 'study', topic: state.round[0].topic });
  state = practiceReducer(state, { type: 'resume' });
  assert.equal(state.screen, 'question');
  assert.equal(state.picks, picks);
  state = practiceReducer(state, { type: 'next' });
  for (let i = 1; i < 12; i++) {
    state = practiceReducer(state, { type: 'pick', answer: state.round[i].a });
    state = practiceReducer(state, { type: 'next' });
  }
  assert.equal(state.screen, 'done');
  assert.equal(scoreRound(state), 11);
  assert.equal(state.best, 11);
  assert.equal(state.rounds, 1);
  assert.equal(practiceReducer(state, { type: 'next' }), state);
  state = practiceReducer(state, { type: 'study', topic: state.round[0].topic });
  state = practiceReducer(state, { type: 'resume' });
  assert.equal(state.screen, 'done');
  state = practiceReducer(state, { type: 'start', ...drawRound(drills.promo.bank, state.seen) });
  assert.equal(state.picks.length, 0);
  assert.equal(state.best, 11);
});
