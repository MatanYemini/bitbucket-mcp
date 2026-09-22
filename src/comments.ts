/**
 * Helpers for Bitbucket pull request comment collections.
 */

type MaybeComment = {
  id?: number | string;
  deleted?: boolean;
  parent?: { id?: number | string };
};

const identifier = (value: unknown): string | null =>
  typeof value === "number" || typeof value === "string" ? String(value) : null;

const parentIdentifier = (comment: MaybeComment): string | null =>
  comment && comment.parent ? identifier(comment.parent.id) : null;

const isDeletedRoot = (comment: MaybeComment): boolean =>
  comment.deleted === true && parentIdentifier(comment) === null;

/**
 * Bitbucket keeps deleted comments in the comments collection with their content blanked
 * out, so an unfiltered list presents withdrawn feedback as if it were still live. Remove
 * deleted comments and every reply below a deleted thread root.
 *
 * Comments with unknown or cyclic ancestry are kept: only a proven deleted root drops a
 * thread, so a partial page can never hide live feedback.
 */
export function withoutDeletedThreads<T>(comments: T[]): T[] {
  if (!Array.isArray(comments)) return comments;

  const byIdentifier = new Map<string, MaybeComment>();
  for (const comment of comments as MaybeComment[]) {
    const id = comment ? identifier(comment.id) : null;
    if (id !== null) byIdentifier.set(id, comment);
  }

  const descendsFromDeletedRoot = (comment: MaybeComment): boolean => {
    const visited = new Set<string>();
    let current: MaybeComment | null = comment;
    while (current) {
      if (isDeletedRoot(current)) return true;
      const parent = parentIdentifier(current);
      if (parent === null || visited.has(parent)) return false;
      visited.add(parent);
      current = byIdentifier.get(parent) || null;
    }
    return false;
  };

  return (comments as MaybeComment[]).filter(
    (comment) =>
      comment && comment.deleted !== true && !descendsFromDeletedRoot(comment)
  ) as T[];
}
