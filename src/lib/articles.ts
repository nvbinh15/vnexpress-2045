import type { Article, ArticleFrontmatter, Section } from '../types'

// Vite glob: load all MDX as raw strings, parse frontmatter ourselves.
// We don't render the MDX body on the homepage (front page only),
// so raw is fine - and we sidestep MDX-React rendering for v1.
const modules = import.meta.glob('../../content/articles/*.mdx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * Tiny browser-safe YAML-frontmatter parser.
 * Supports: scalars (string/number/bool), quoted strings, ISO dates,
 * inline arrays [a, b, c], and unquoted strings. NOT a full YAML impl -
 * just enough for the locked schema used by the content agent.
 */
function parseFrontmatter(raw: string): { data: Partial<ArticleFrontmatter>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { data: {}, body: raw }
  const fmText = m[1]
  const body = m[2] ?? ''
  const data: Record<string, unknown> = {}

  for (const line of fmText.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if (!val) { data[key] = ''; continue }

    // inline array  [a, b, c]
    if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1, -1).trim()
      if (!inner) { data[key] = []; continue }
      data[key] = inner.split(',').map(x => stripQuotes(x.trim()))
      continue
    }

    // boolean
    if (val === 'true' || val === 'false') { data[key] = val === 'true'; continue }

    // number (int or float, no leading zeros / dates)
    if (/^-?\d+(\.\d+)?$/.test(val)) { data[key] = Number(val); continue }

    // quoted string
    data[key] = stripQuotes(val)
  }
  return { data: data as Partial<ArticleFrontmatter>, body }
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

// Slug -> raw body cache, used by article detail page
const BODY_BY_SLUG: Record<string, string> = {}

function parseAll(): Article[] {
  const items: Article[] = []
  for (const [path, raw] of Object.entries(modules)) {
    try {
      const { data, body } = parseFrontmatter(raw)
      const fm = data as ArticleFrontmatter
      if (!fm.slug || !fm.title || !fm.section) {
        console.warn('Skipping MDX missing required frontmatter:', path)
        continue
      }
      // Hero image: prefer real /images/* on disk; fall back to a deterministic
      // picsum placeholder only when no path is set.
      let hero = fm.heroImage || ''
      if (!hero) {
        hero = `https://picsum.photos/seed/${fm.slug}/1200/675`
      }
      BODY_BY_SLUG[fm.slug] = body
      items.push({
        ...fm,
        heroImage: hero,
        tags: Array.isArray(fm.tags) ? fm.tags : [],
        featured: !!fm.featured,
        priority: typeof fm.priority === 'number' ? fm.priority : 1,
        commentCount: typeof fm.commentCount === 'number' ? fm.commentCount : 0,
        readMinutes: typeof fm.readMinutes === 'number' ? fm.readMinutes : 3,
        url: `/${fm.section}/${fm.slug}.html`,
      })
    } catch (e) {
      console.warn('Failed to parse MDX frontmatter', path, e)
    }
  }
  return items
}

const ALL = parseAll()

export function getAllArticles(): Article[] {
  return [...ALL].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    if (a.priority !== b.priority) return b.priority - a.priority
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })
}

export function getHero(): Article | null {
  const sorted = getAllArticles()
  return sorted[0] ?? null
}

export function getTopStories(count = 5): Article[] {
  return getAllArticles().slice(1, 1 + count)
}

export function getBySection(section: Section, limit = 5): Article[] {
  return getAllArticles()
    .filter(a => a.section === section)
    .slice(0, limit)
}

export function getLatest(limit = 8): Article[] {
  return [...ALL]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit)
}

/**
 * Look up an article by slug. Returns the article + raw MDX body (already
 * stripped of YAML frontmatter). The body is plain text with `**bold**`
 * markers and blank-line paragraph separation — see `formatBody` in the
 * Article page for rendering.
 */
export function getArticleBySlug(slug: string): { article: Article; body: string } | null {
  const article = ALL.find(a => a.slug === slug)
  if (!article) return null
  // Re-resolve hero through getAllArticles ordering pipeline (already done
  // at parse time) — just use the cached one.
  const sorted = getAllArticles().find(a => a.slug === slug)
  return { article: sorted || article, body: BODY_BY_SLUG[slug] || '' }
}

/**
 * Articles in the same section, excluding the given slug, sorted by the
 * standard featured/priority/date ordering.
 */
export function getRelated(slug: string, section: Section, limit = 4): Article[] {
  return getAllArticles()
    .filter(a => a.section === section && a.slug !== slug)
    .slice(0, limit)
}
