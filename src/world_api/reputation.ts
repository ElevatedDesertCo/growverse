import type { ProfessionView, ReputationView } from '../sim/types';

// Reputation + gathering professions: the read-only per-character standings shown on the
// character sheet. Both are earned server-side (commune standing through cultivation/
// breeding; profession skills by working world nodes), never a direct client command:
// `reputation` is one ReputationView per faction (points, tier, progress); `professions`
// is one ProfessionView per gathering skill (Mining/Herbalism/Logging). Mirrored from the
// self-snapshot online, computed live offline.
export interface IWorldReputation {
  reputation: ReputationView[];
  professions: ProfessionView[];
}
