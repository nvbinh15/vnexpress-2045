import { Link } from 'react-router-dom'
import type { Article } from '../types'
import { SECTION_LABELS } from '../types'
import CommentBadge from './CommentBadge'

type Variant = 'medium' | 'small' | 'list' | 'list-text' | 'side-lead' | 'side-row'

interface Props {
  article: Article
  variant?: Variant
  showSection?: boolean
  showSummary?: boolean
}

export default function ArticleCard({
  article,
  variant = 'medium',
  showSection = false,
  showSummary = false,
}: Props) {
  if (variant === 'side-lead') {
    // Big sidebar lead: 16:9 image + title + short summary
    return (
      <article className="vne-card vne-side-lead">
        <Link to={article.url} className="block">
          <div className="thumb">
            <img src={article.heroImage} alt="" />
          </div>
          <h3 className="vne-card-title">
            {article.title}
            <CommentBadge count={article.commentCount} />
          </h3>
          {article.summary && (
            <p className="vne-desc mt-1.5 text-[13px] leading-[18px]">{article.summary}</p>
          )}
        </Link>
      </article>
    )
  }

  if (variant === 'side-row') {
    // Compact sidebar row: 90x56 thumb on left, title on right
    return (
      <article className="vne-card vne-side-row">
        <Link to={article.url} className="thumb">
          <img src={article.heroImage} alt="" />
        </Link>
        <Link to={article.url} className="flex-1 min-w-0">
          <h3 className="vne-card-title-xs">
            {article.title}
            <CommentBadge count={article.commentCount} />
          </h3>
        </Link>
      </article>
    )
  }

  if (variant === 'list-text') {
    // Pure-text dot row, no thumb
    return (
      <article className="vne-card vne-side-row-sm flex gap-2 items-start">
        <span className="text-vne-red mt-[7px] text-[8px] leading-none">●</span>
        <Link to={article.url} className="flex-1 min-w-0">
          <h3 className="vne-card-title-xs">
            {article.title}
            <CommentBadge count={article.commentCount} />
          </h3>
        </Link>
      </article>
    )
  }

  if (variant === 'list') {
    return (
      <article className="vne-card flex gap-3 py-2 border-b border-vne-line last:border-b-0">
        <Link to={article.url} className="shrink-0">
          <div className="w-[100px] h-[60px] bg-vne-line overflow-hidden">
            <img src={article.heroImage} alt="" className="w-full h-full object-cover" />
          </div>
        </Link>
        <Link to={article.url} className="flex-1 min-w-0">
          <h3 className="vne-card-title-sm">
            {article.title}
            <CommentBadge count={article.commentCount} />
          </h3>
        </Link>
      </article>
    )
  }

  if (variant === 'small') {
    return (
      <article className="vne-card">
        <Link to={article.url}>
          <div className="aspect-[16/9] bg-vne-line overflow-hidden">
            <img src={article.heroImage} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="pt-2">
            {showSection && (
              <span className="vne-eyebrow">{SECTION_LABELS[article.section]}</span>
            )}
            <h3 className="vne-card-title-sm">
              {article.title}
              <CommentBadge count={article.commentCount} />
            </h3>
          </div>
        </Link>
      </article>
    )
  }

  // medium
  return (
    <article className="vne-card">
      <Link to={article.url}>
        <div className="aspect-[16/9] bg-vne-line overflow-hidden max-h-[300px]">
          <img src={article.heroImage} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="pt-2">
          {showSection && (
            <span className="vne-eyebrow">{SECTION_LABELS[article.section]}</span>
          )}
          <h3 className="vne-card-title">
            {article.title}
            <CommentBadge count={article.commentCount} />
          </h3>
          {showSummary && article.summary && (
            <p className="vne-desc mt-1.5">{article.summary}</p>
          )}
        </div>
      </Link>
    </article>
  )
}
