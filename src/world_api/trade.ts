import type { InvSlot, StrainView } from '../sim/types';

export interface TradeOffer {
  items: InvSlot[];
  copper: number;
  // A CUT: a copy of one of the offerer's library strains, staked alongside the items.
  // Genetics-for-genetics is the trade growers actually make, and it is the one thing
  // this economy has that a generic auction house does not. Expressed phenotype only,
  // like every other client-facing strain read; null when no cut is staked.
  cut: StrainView | null;
}

export interface TradeInfo {
  otherPid: number;
  otherName: string;
  myOffer: TradeOffer;
  theirOffer: TradeOffer;
  myAccepted: boolean;
  theirAccepted: boolean;
}

export interface IWorldTrade {
  tradeInfo: TradeInfo | null;
  tradeRequest(targetPid: number): void;
  tradeAccept(): void;
  // `strainId` stakes a cut of that library strain (null clears it). Taking a cut COPIES
  // the strain: the giver keeps their mother plant, which is what a cut is. The receiver's
  // MAX_STRAINS library slot is the throttle, and the copy carries the original's name,
  // lineage, and breeder credit, so a strain that spreads carries its breeder's name with
  // it. Server re-validates ownership and the receiver's room.
  tradeSetOffer(items: InvSlot[], copper: number, strainId?: string | null): void;
  tradeConfirm(): void;
  tradeCancel(): void;
}
