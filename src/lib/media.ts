export type MediaKind = 'podcast' | 'broadcast' | 'fm'

export interface ArticleNarration {
  src: string
  title: string
  durationSeconds: number | null
  transcript: string
  modelId: string
  voiceName?: string
}

export interface MediaEpisode {
  id: string
  kind: MediaKind
  title: string
  summary: string
  src: string
  videoSrc?: string
  poster: string
  publishedAt: string
  durationSeconds: number | null
  articleSlugs: string[]
  transcript: string
  modelId: string
}

export interface MediaAsset {
  id: string
  title: string
  src: string
  durationSeconds: number | null
  modelId: string
  loop?: boolean
}

export interface MediaCatalog {
  generatedAt: string | null
  articles: Record<string, ArticleNarration>
  episodes: MediaEpisode[]
  assets: {
    jingles: MediaAsset[]
    sfx: MediaAsset[]
  }
}

const modules = import.meta.glob('../../content/audio/catalog.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const EMPTY_CATALOG: MediaCatalog = {
  generatedAt: null,
  articles: {},
  episodes: [],
  assets: { jingles: [], sfx: [] },
}

function parseCatalog(): MediaCatalog {
  const raw = Object.values(modules)[0]
  if (!raw) return EMPTY_CATALOG
  try {
    const parsed = JSON.parse(raw) as Partial<MediaCatalog>
    return {
      generatedAt: parsed.generatedAt ?? null,
      articles: parsed.articles ?? {},
      episodes: parsed.episodes ?? [],
      assets: {
        jingles: parsed.assets?.jingles ?? [],
        sfx: parsed.assets?.sfx ?? [],
      },
    }
  } catch {
    return EMPTY_CATALOG
  }
}

export const MEDIA_CATALOG = parseCatalog()

export function getArticleNarration(slug: string): ArticleNarration | null {
  return MEDIA_CATALOG.articles[slug] ?? null
}

export function getEpisodesByKind(kind: MediaKind, limit?: number): MediaEpisode[] {
  const episodes = MEDIA_CATALOG.episodes
    .filter(episode => episode.kind === kind)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  return typeof limit === 'number' ? episodes.slice(0, limit) : episodes
}

export function getAllMediaEpisodes(limit?: number): MediaEpisode[] {
  const episodes = [...MEDIA_CATALOG.episodes]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  return typeof limit === 'number' ? episodes.slice(0, limit) : episodes
}

export function getCurrentFmEpisode(now = new Date()): MediaEpisode | null {
  const fm = getEpisodesByKind('fm')
  if (fm.length === 0) return null
  const hour = now.getHours()
  const index = hour < 10 ? 0 : hour < 15 ? 1 : hour < 21 ? 2 : 3
  return fm[index % fm.length] ?? fm[0]
}

export function getJingles(limit?: number): MediaAsset[] {
  return typeof limit === 'number'
    ? MEDIA_CATALOG.assets.jingles.slice(0, limit)
    : MEDIA_CATALOG.assets.jingles
}

export function getSfx(limit?: number): MediaAsset[] {
  return typeof limit === 'number'
    ? MEDIA_CATALOG.assets.sfx.slice(0, limit)
    : MEDIA_CATALOG.assets.sfx
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 1) return 'Đang cập nhật'
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}
