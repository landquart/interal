// Retired replay scripts cannot become unguarded production mutation entry points.
// Replay a historical script only from its exact historical Git commit in an
// isolated restoration; new edits go through the guarded controlled-release API.
export function assertHistoricalRepairAllowed() {
  throw new Error('HISTORY_CONFLICT: retired repair entry point; use a finite reviewed plan with history checks in controlled release');
}
