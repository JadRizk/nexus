/** One `[key, value]` pair of `T`, with the key and value types kept together. */
export type Entry<T> = { [K in keyof T & string]-?: [K, Required<T>[K]] }[keyof T & string];

/**
 * `Object.entries` that keeps the key type, for `as const` data tables.
 * `Object.entries` widens keys to `string` because an object may carry keys
 * beyond its type; a literal table cannot, so the cast holds there.
 */
export function entriesOf<T extends object>(table: T): Entry<T>[] {
  return Object.entries(table) as Entry<T>[];
}
