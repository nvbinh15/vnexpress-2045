// Loads /content/comments/<slug>.json files.
// Schema (matches CONTENT_NOTES.md):
//   [{ id, username, location, timestamp, body, likes, replies?: [...] }, ...]
//
// We use Vite's `import.meta.glob` with eager loading so the JSON ends up
// inlined in the bundle — there's no runtime fetch.

export interface CommentReply {
  id: string
  username: string
  location: string
  timestamp: string
  body: string
  likes: number
}

export interface Comment extends CommentReply {
  replies?: CommentReply[]
}

const modules = import.meta.glob('../../content/comments/*.json', {
  eager: true,
}) as Record<string, { default: Comment[] }>

const BY_SLUG: Record<string, Comment[]> = {}
for (const [path, mod] of Object.entries(modules)) {
  // path looks like '../../content/comments/foo.json'
  const m = path.match(/comments\/([^/]+)\.json$/)
  if (!m) continue
  const slug = m[1]
  BY_SLUG[slug] = (mod.default || []) as Comment[]
}

/**
 * Look up the comment thread for a given article slug. Tries exact match
 * first, then strips the leading numeric prefix the content team uses
 * (e.g. `01-foo` => `foo`) so file naming can be a bit looser.
 */
export function getCommentsForSlug(slug: string): Comment[] {
  if (BY_SLUG[slug]) return BY_SLUG[slug]
  const stripped = slug.replace(/^\d+-/, '')
  if (BY_SLUG[stripped]) return BY_SLUG[stripped]
  return []
}

export function countComments(comments: Comment[]): number {
  let n = comments.length
  for (const c of comments) n += c.replies?.length ?? 0
  return n
}
