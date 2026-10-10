import { useCallback, useMemo, useState } from "react";

export type CategoryVisibility = Record<string, boolean>;

export const allShown = (categoryIds: readonly string[]): CategoryVisibility =>
  Object.fromEntries(categoryIds.map((categoryId) => [categoryId, true]));

export const hiddenCategories = (categoryIds: readonly string[], shown: CategoryVisibility) =>
  categoryIds.filter((categoryId) => !shown[categoryId]);

export const withCategoryShown = (
  shown: CategoryVisibility,
  categoryId: string,
  isShown: boolean,
): CategoryVisibility => ({ ...shown, [categoryId]: isShown });

/** Which of a taxonomy's categories the legend shows, starting with all of them. */
export function useCategoryFilter(categoryIds: readonly string[]) {
  const [shown, setShown] = useState(() => allShown(categoryIds));
  const hidden = useMemo(() => hiddenCategories(categoryIds, shown), [categoryIds, shown]);
  const setCategoryShown = useCallback((categoryId: string, isShown: boolean) => {
    setShown((previous) => withCategoryShown(previous, categoryId, isShown));
  }, []);
  return { shown, hidden, setCategoryShown };
}
