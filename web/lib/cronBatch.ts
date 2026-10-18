// Shared by the hourly reminder routes: a SQL selector is asked for one row
// more than the batch, so the route can report a backlog without a second
// query. Pure, so it is unit-tested without a database.

export function cronBatchSummary<T>(
  rows: readonly T[],
  max: number,
): { batch: T[]; more: boolean } {
  return { batch: rows.slice(0, max), more: rows.length > max };
}
