// Pure, host-agnostic core for the in-game quest tracker (the persistent
// #quest-tracker overlay). It decides WHAT the tracker shows given the active
// quests and the player's collapse preference, so the collapse + per-objective
// "done" logic is unit-testable without the DOM or a locale loaded.
//
// The thin consumer (hud.ts#updateQuestTracker) resolves quest/objective text
// through t(), formats the count through formatNumber, and renders this view
// model to HTML. Keeping this module fully string/DOM-free mirrors unit_portrait's
// pure-core split (the consumer owns all t()/formatNumber, the way xp_bar's does),
// so the collapse + done logic is testable without a locale loaded.

export interface TrackedObjective {
  /** Already-localized objective label. */
  label: string;
  current: number;
  total: number;
}

export interface TrackedQuest {
  id: string;
  /** Already-localized quest title. */
  title: string;
  /** True when the quest is ready to turn in (the "(Complete)" state). */
  complete: boolean;
  objectives: readonly TrackedObjective[];
  /**
   * Seconds left on a timed quest, straight from IWorldQuests.questSecondsLeft:
   * null (or absent) for a quest with no deadline, which is the common case.
   */
  secondsLeft?: number | null;
}

/**
 * A deadline inside this many seconds reads as urgent. One minute is the classic
 * "you are about to lose this" window: long enough to still run somewhere, short
 * enough that the highlight means something.
 */
export const QUEST_TRACKER_URGENT_SECONDS = 60;

export interface QuestTrackerTimer {
  /** Whole seconds remaining, floored at zero. The consumer formats it. */
  seconds: number;
  urgent: boolean;
}

export interface QuestTrackerObjectiveRow extends TrackedObjective {
  done: boolean;
}

export interface QuestTrackerQuestRow {
  id: string;
  title: string;
  complete: boolean;
  objectives: QuestTrackerObjectiveRow[];
  /** The countdown to render, or null when the quest has no deadline. */
  timer: QuestTrackerTimer | null;
}

export interface QuestTrackerView {
  /** Whether to render anything at all (false when no quests are tracked). */
  visible: boolean;
  collapsed: boolean;
  /** Number of tracked quests; shown beside the header while collapsed. */
  count: number;
  /** The quest rows to render; empty when collapsed (header only). */
  quests: QuestTrackerQuestRow[];
}

/** Resolve a quest's countdown row. A quest that is already ready to turn in keeps
 *  no timer: the deadline stopped mattering the moment the objectives were met, and
 *  a ticking clock next to "(Complete)" would read as a threat that is not real. */
function questTrackerTimer(quest: TrackedQuest): QuestTrackerTimer | null {
  const left = quest.secondsLeft;
  if (left === undefined || left === null || quest.complete) return null;
  const seconds = Math.max(0, Math.floor(left));
  return { seconds, urgent: seconds <= QUEST_TRACKER_URGENT_SECONDS };
}

/** Build the tracker view from the tracked quests + the collapse preference.
 *  Collapsed renders the header only (with the quest count); expanded renders
 *  every quest and objective, with each objective's done state computed. */
export function questTrackerView(
  quests: readonly TrackedQuest[],
  collapsed: boolean,
): QuestTrackerView {
  const count = quests.length;
  if (count === 0) return { visible: false, collapsed, count: 0, quests: [] };
  if (collapsed) return { visible: true, collapsed: true, count, quests: [] };
  const questRows = quests.map((q) => ({
    id: q.id,
    title: q.title,
    complete: q.complete,
    objectives: q.objectives.map((o) => ({ ...o, done: o.current >= o.total })),
    timer: questTrackerTimer(q),
  }));
  return { visible: true, collapsed: false, count, quests: questRows };
}
