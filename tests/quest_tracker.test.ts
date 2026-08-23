import { describe, expect, it } from 'vitest';
import {
  QUEST_TRACKER_URGENT_SECONDS,
  questTrackerView,
  type TrackedQuest,
} from '../src/ui/quest_tracker';

// Titles/labels are already resolved before the tracker receives them.
const QUESTS: TrackedQuest[] = [
  {
    id: 'wolves',
    title: 'Wolves at the Door',
    complete: false,
    objectives: [{ label: 'Forest Wolf slain', current: 0, total: 8 }],
  },
  {
    id: 'webwood',
    title: 'Webwood Menace',
    complete: true,
    objectives: [
      { label: 'Webwood Lurker slain', current: 6, total: 6 },
      { label: 'Webwood Silk Gland', current: 4, total: 4 },
    ],
  },
];

describe('questTrackerView', () => {
  it('is hidden when no quests are tracked', () => {
    const v = questTrackerView([], false);
    expect(v.visible).toBe(false);
    expect(v.count).toBe(0);
    expect(v.quests).toEqual([]);
  });

  it('stays hidden when collapsed with no quests (nothing to show)', () => {
    expect(questTrackerView([], true).visible).toBe(false);
  });

  it('expanded: emits every quest + objective with done computed', () => {
    const v = questTrackerView(QUESTS, false);
    expect(v.visible).toBe(true);
    expect(v.collapsed).toBe(false);
    expect(v.count).toBe(2);
    expect(v.quests).toHaveLength(2);
    expect(v.quests[0].objectives[0].done).toBe(false); // 0/8
    expect(v.quests[1].complete).toBe(true);
    expect(v.quests[1].objectives.map((o) => o.done)).toEqual([true, true]); // 6/6, 4/4
  });

  it('collapsed: header only, but keeps the quest count', () => {
    const v = questTrackerView(QUESTS, true);
    expect(v.visible).toBe(true);
    expect(v.collapsed).toBe(true);
    expect(v.count).toBe(2);
    expect(v.quests).toEqual([]);
  });

  it('marks an objective done when current meets or exceeds total', () => {
    const over = questTrackerView(
      [
        {
          id: 'x',
          title: 'X',
          complete: false,
          objectives: [{ label: 'o', current: 9, total: 8 }],
        },
      ],
      false,
    );
    expect(over.quests[0].objectives[0].done).toBe(true);
  });

  it('treats an objective with a zero total as done (0 >= 0)', () => {
    const v = questTrackerView(
      [
        {
          id: 'x',
          title: 'X',
          complete: false,
          objectives: [{ label: 'o', current: 0, total: 0 }],
        },
      ],
      false,
    );
    expect(v.quests[0].objectives[0].done).toBe(true);
  });

  it('does not mutate the caller input and returns distinct copies', () => {
    const input: TrackedQuest[] = [
      { id: 'a', title: 'A', complete: false, objectives: [{ label: 'o', current: 1, total: 2 }] },
    ];
    const snapshot = JSON.stringify(input);
    const v = questTrackerView(input, false);
    expect(JSON.stringify(input)).toBe(snapshot);
    // The consumer relies on getting its own quest/objective objects (never
    // references back into the caller's records), so a future refactor that
    // returned shared references would be a bug; assert the copy is distinct.
    expect(v.quests[0]).not.toBe(input[0]);
    expect(v.quests[0].objectives[0]).not.toBe(input[0].objectives[0]);
  });
});

// The timed-quest countdown. The core only decides WHETHER a countdown shows and
// whether it reads as urgent; the m:ss formatting is the consumer's job (it needs
// t() and formatNumber), so nothing here asserts on text.
describe('questTrackerView: the timed-quest countdown', () => {
  const timed = (secondsLeft: number | null | undefined, complete = false): TrackedQuest => ({
    id: 'timed',
    title: 'Beat the Clock',
    complete,
    objectives: [{ label: 'o', current: 0, total: 1 }],
    secondsLeft,
  });

  it('carries no timer for an untimed quest, so nothing renders a countdown', () => {
    expect(questTrackerView([timed(null)], false).quests[0].timer).toBeNull();
    expect(questTrackerView([timed(undefined)], false).quests[0].timer).toBeNull();
    // A quest record that never mentions a deadline at all is the common case.
    const untimed: TrackedQuest = {
      id: 'plain',
      title: 'Plain',
      complete: false,
      objectives: [{ label: 'o', current: 0, total: 1 }],
    };
    expect(questTrackerView([untimed], false).quests[0].timer).toBeNull();
  });

  it('floors the remaining seconds so the countdown never shows a fraction', () => {
    expect(questTrackerView([timed(91.8)], false).quests[0].timer).toEqual({
      seconds: 91,
      urgent: false,
    });
  });

  it('clamps a passed deadline to zero rather than a negative countdown', () => {
    expect(questTrackerView([timed(-5)], false).quests[0].timer).toEqual({
      seconds: 0,
      urgent: true,
    });
  });

  it('flips to urgent at the threshold, not past it', () => {
    const at = questTrackerView([timed(QUEST_TRACKER_URGENT_SECONDS)], false).quests[0].timer;
    const justOver = questTrackerView([timed(QUEST_TRACKER_URGENT_SECONDS + 1)], false).quests[0]
      .timer;
    expect(at?.urgent).toBe(true);
    expect(justOver?.urgent).toBe(false);
  });

  it('drops the countdown once the quest is ready to turn in', () => {
    // The deadline stopped mattering when the objectives were met; a ticking clock
    // beside "(Complete)" would read as a threat that is not real.
    expect(questTrackerView([timed(30, true)], false).quests[0].timer).toBeNull();
  });

  it('renders no quest rows at all while collapsed, timers included', () => {
    expect(questTrackerView([timed(30)], true).quests).toEqual([]);
  });
});
