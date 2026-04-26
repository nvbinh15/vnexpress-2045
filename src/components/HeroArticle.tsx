import { Link } from 'react-router-dom'
import type { Article } from '../types'
import { SECTION_LABELS } from '../types'
import CommentBadge from './CommentBadge'
import { ClockIcon } from './icons'
import { format } from 'date-fns'

interface Props {
  article: Article
  related?: Article[]
}

export default function HeroArticle({ article, related = [] }: Props) {
  let timeStr = ''
  try {
    const d = new Date(article.publishedAt)
    if (!isNaN(d.getTime())) {
      timeStr = format(d, 'd/M/yyyy, HH:mm') + ' (GMT+7)'
    }
  } catch {
    /* ignore */
  }

  return (
    <article className="vne-card">
      <Link to={article.url} className="block">
        <div className="overflow-hidden bg-vne-line aspect-[16/9]">
          <img
            src={article.heroImage}
            alt={article.title}
            className="w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </div>
        <div className="pt-3">
          <span className="vne-eyebrow">{SECTION_LABELS[article.section]}</span>
          <h2 className="vne-hero-title">
            {article.title}
            <CommentBadge count={article.commentCount} />
          </h2>
          <p className="vne-desc mt-2">{article.summary}</p>
          {timeStr && (
            <div className="vne-meta-line">
              <ClockIcon size={11} />
              <span>{timeStr}</span>
              <span className="sep" />
              <span>{article.author}</span>
            </div>
          )}
        </div>
      </Link>

      {related.length > 0 && (
        <div className="vne-related-strip">
          {related.slice(0, 3).map(r => (
            <Link key={r.slug} to={r.url} className="related-item">
              <div className="thumb">
                <img src={r.heroImage} alt="" loading="lazy" decoding="async" />
              </div>
              <h4>
                {r.title}
                <CommentBadge count={r.commentCount} />
              </h4>
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
