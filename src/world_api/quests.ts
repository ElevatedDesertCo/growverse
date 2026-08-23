import type { QuestProgress, QuestState } from '../sim/types';

export interface IWorldQuests {
  questLog: Map<string, QuestProgress>;
  questsDone: Set<string>;
  questState(questId: string): QuestState;
  acceptQuest(questId: string): void;
  turnInQuest(questId: string): void;
  abandonQuest(questId: string): void;
  acceptLinkedQuest(questId: string, fromPid: number): void;
  /**
   * Seconds remaining on a timed quest, or null when it has no deadline / is unknown.
   * The offline Sim answers exactly from its own clock; ClientWorld interpolates from
   * the last bucketed value the server sent, re-anchoring on every update.
   */
  questSecondsLeft(questId: string): number | null;
}
