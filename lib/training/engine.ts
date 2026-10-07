import content from './content.json';

export type DrillKey = 'promo' | 'pitch';
export type Question = { id: number; topic: string; q: string; a: string; wrong: string[]; why: string };
export type RoundQuestion = Question & { options: string[] };
export type Study = Record<string, { h: string; b: string }[]>;
export const ROUND_SIZE = 12;
export const drills: Record<DrillKey, { title: string; description: string; bank: Question[]; study: Study }> = {
  promo: { title: 'Costco Promotions', description: 'Trade-in credits, no-trade prices, bundles, member perks, and Next Up Anytime. Get the details right.', bank: content.promo, study: content.study.promo },
  pitch: { title: 'Pitch, Rebuttals & Compliance', description: 'Open with confidence. Handle objections honestly. Close with care—and know when to let a member go.', bank: content.pitch, study: content.study.pitch },
};

export function shuffle<T>(values: readonly T[], random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function drawRound(bank: Question[], seen: number[], previous: number[] = [], random = Math.random) {
  const unseen = shuffle(bank.filter(q => !seen.includes(q.id)), random);
  const fresh = unseen.slice(0, ROUND_SIZE);
  const needed = ROUND_SIZE - fresh.length;
  const freshIds = new Set(fresh.map(q => q.id));
  const eligible = bank.filter(q => !freshIds.has(q.id));
  const recycled = needed > 0 ? [...shuffle(eligible.filter(q => !previous.includes(q.id)), random), ...shuffle(eligible.filter(q => previous.includes(q.id)), random)].slice(0, needed) : [];
  const chosen = shuffle([...fresh, ...recycled], random);
  return {
    round: chosen.map(q => ({ ...q, options: shuffle([q.a, ...q.wrong], random) })),
    seen: needed > 0 ? chosen.map(q => q.id) : [...new Set([...seen, ...chosen.map(q => q.id)])],
  };
}

export type Screen = 'ready' | 'question' | 'study' | 'done';
export type PracticeState = {
  screen: Screen; returnTo: Exclude<Screen, 'study'>; topic: string;
  round: RoundQuestion[]; seen: number[]; picks: string[]; index: number; best: number; rounds: number;
};
export function initialState(drill: DrillKey, study: boolean): PracticeState {
  return { screen: study ? 'study' : 'ready', returnTo: 'ready', topic: Object.keys(drills[drill].study)[0], round: [], seen: [], picks: [], index: 0, best: 0, rounds: 0 };
}
export function scoreRound(state: PracticeState) {
  return state.round.filter((q, i) => state.picks[i] === q.a).length;
}
export type PracticeAction =
  | { type: 'start'; round: RoundQuestion[]; seen: number[] }
  | { type: 'pick'; answer: string }
  | { type: 'next' }
  | { type: 'study'; topic: string }
  | { type: 'topic'; topic: string }
  | { type: 'resume' };

export function practiceReducer(state: PracticeState, action: PracticeAction): PracticeState {
  switch (action.type) {
    case 'start': return { ...state, screen: 'question', round: action.round, seen: action.seen, picks: [], index: 0 };
    case 'pick': {
      if (state.screen !== 'question' || state.picks[state.index] !== undefined || !state.round[state.index]?.options.includes(action.answer)) return state;
      const picks = [...state.picks];
      picks[state.index] = action.answer;
      return { ...state, picks };
    }
    case 'next': {
      if (state.screen !== 'question' || state.picks[state.index] === undefined) return state;
      if (state.index < state.round.length - 1) return { ...state, index: state.index + 1 };
      return { ...state, screen: 'done', best: Math.max(state.best, scoreRound(state)), rounds: state.rounds + 1 };
    }
    case 'study': return { ...state, screen: 'study', returnTo: state.screen === 'study' ? state.returnTo : state.screen, topic: action.topic };
    case 'topic': return { ...state, topic: action.topic };
    case 'resume': return { ...state, screen: state.returnTo };
  }
}
