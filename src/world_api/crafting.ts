// ---------------------------------------------------------------------------
// Crafting: the Grow Station and Upgrade Bench. The recipe table is static
// data-as-code (sim/content/crafting.ts, exposed via sim/data as CRAFT_RECIPES),
// so the HUD reads it directly like ITEMS; the only world action is submitting a
// craft. It is server-authoritative: the server re-validates station proximity,
// copper, and reagents regardless of what the client shows.
// ---------------------------------------------------------------------------

export interface IWorldCrafting {
  // Craft the recipe with this id at the station the player is standing next to.
  // Consumes the recipe's reagents + copper and awards its output; a failure
  // (too far, cannot afford, missing reagents) surfaces as an error event.
  craft(recipeId: string): void;
}
