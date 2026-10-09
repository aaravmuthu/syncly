/** An email sign-in code cannot also count as an independent second factor. */
export function hasIndependentPrimary(methods: unknown): boolean {
  if (!Array.isArray(methods)) return false;
  return methods.some((entry) => {
    const method =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object"
          ? entry.method
          : undefined;
    return method === "password" || method === "oauth";
  });
}
