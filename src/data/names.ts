/** Compare names without case or extra spaces. " Soybean " and "soybean" are the same. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
}

export function displayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function findDuplicateName<T extends { id: string; name: string }>(
  items: readonly T[],
  name: string,
  excludeId?: string,
): T | undefined {
  const key = normalizeName(name);
  if (!key) return undefined;
  return items.find((item) => item.id !== excludeId && normalizeName(item.name) === key);
}
