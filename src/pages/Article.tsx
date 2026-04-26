import { Link, useParams } from 'react-router-dom'
import { getArticleBySlug, getRelated } from '../lib/articles'
import { SECTION_LABELS } from '../types'
import { getCommentsForSlug } from '../lib/comments'
import Comments from '../components/Comments'
import SectionHeader from '../components/SectionHeader'
import ArticleCard from '../components/ArticleCard'
import { ClockIcon } from '../components/icons'

const VN_WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

function formatVnDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const wd = VN_WEEKDAYS[d.getDay()]
  const day = d.getDate()
  const month = d.getMonth() + 1
  const year = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${wd}, ${day}/${month}/${year}, ${hh}:${mm} (GMT+7)`
}

/**
 * Lightweight markdown-ish renderer for the MDX body. Real MDX would be
 * nicer, but the content uses a small subset (paragraphs, **bold**, inline
 * *italics*) and configuring @mdx-js/rollup for content/* would force us
 * into per-file imports that don't play well with `useParams()`.
 *
 * The content team sometimes formats subheads as a single-line bold
 * paragraph (e.g. `**Phụ huynh: ...**`) — we render those as h3.
 */
function renderBody(raw: string): React.ReactNode {
  // Split on blank lines into block units.
  const blocks = raw.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)

  return blocks.map((block, idx) => {
    // Subhead: a paragraph that is entirely **bold text**
    const subMatch = block.match(/^\*\*([^*][\s\S]*?[^*])\*\*$/)
    if (subMatch) {
      return (
        <h3
          key={idx}
          className="font-serif font-bold text-[19px] leading-[28px] text-vne-ink mt-6 mb-3"
        >
          {subMatch[1]}
        </h3>
      )
    }

    // Italic-only block (often the disclaimer at the end)
    const italMatch = block.match(/^\*([^*][\s\S]*[^*])\*$/)
    if (italMatch) {
      return (
        <p key={idx} className="text-[14px] italic text-vne-mute mt-6 mb-2">
          {italMatch[1]}
        </p>
      )
    }

    // List items - simple `- ` lines collected into a <ul>
    if (/^- /.test(block)) {
      const items = block.split(/\n/).map(l => l.replace(/^- /, '').trim())
      return (
        <ul key={idx} className="list-disc pl-5 mb-4 text-[16px] leading-[26px]">
          {items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}
        </ul>
      )
    }

    return (
      <p key={idx} className="text-[16px] leading-[26px] text-vne-ink mb-5">
        {renderInline(block)}
      </p>
    )
  })
}

/**
 * Inline rendering: `**bold**`, `*italic*`. We do a single left-to-right
 * pass that emits text + spans so the function is pure and synchronous.
 */
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let i = 0
  let key = 0
  let buf = ''
  const flush = () => {
    if (buf) { out.push(buf); buf = '' }
  }
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2)
      if (end > -1) {
        flush()
        out.push(<strong key={`b${key++}`} className="font-bold">{text.slice(i + 2, end)}</strong>)
        i = end + 2
        continue
      }
    } else if (text[i] === '*') {
      const end = text.indexOf('*', i + 1)
      if (end > -1) {
        flush()
        out.push(<em key={`i${key++}`} className="italic">{text.slice(i + 1, end)}</em>)
        i = end + 1
        continue
      }
    }
    buf += text[i]
    i++
  }
  flush()
  return out
}

export default function Article() {
  const { slug } = useParams<{ slug: string }>()
  const result = slug ? getArticleBySlug(slug) : null

  if (!result) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-vne-ink">404 — Bài viết không tồn tại</h1>
        <p className="text-vne-mute mt-3">
          Có thể bài đã được rút khỏi hệ thống, hoặc bot kiểm duyệt vừa lên cơn cẩn trọng.
        </p>
        <Link to="/" className="inline-block mt-6 text-vne-red font-bold">
          Về trang chủ
        </Link>
      </main>
    )
  }

  const { article, body } = result
  const related = getRelated(article.slug, article.section, 4)
  const comments = getCommentsForSlug(article.slug)
  const sectionLabel = SECTION_LABELS[article.section]
  const dateStr = formatVnDate(article.publishedAt)

  return (
    <main className="mx-auto max-w-[1200px] px-3 sm:px-4 pt-3 pb-10">
      {/* Breadcrumb */}
      <nav className="text-[12px] text-vne-mute pb-3 border-b border-vne-line">
        <Link to="/" className="hover:text-vne-red">Trang chủ</Link>
        <span className="mx-1.5">›</span>
        <Link to={`/#${article.section}`} className="hover:text-vne-red">{sectionLabel}</Link>
        {article.subsection && (
          <>
            <span className="mx-1.5">›</span>
            <span className="capitalize">{article.subsection.replace(/-/g, ' ')}</span>
          </>
        )}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mt-5">
        {/* Article column */}
        <article className="lg:col-span-8 lg:max-w-[720px] min-w-0">
          {/* Section eyebrow */}
          <div className="vne-eyebrow">{sectionLabel}</div>

          {/* h1 — Merriweather serif. Smaller on mobile per real VnE. */}
          <h1 className="font-serif font-bold text-[24px] leading-[32px] lg:text-[30px] lg:leading-[42px] text-vne-ink mt-1 mb-4">
            {article.title}
          </h1>

          {/* Sapo / lead */}
          <p className="font-serif font-bold text-[16px] leading-[24px] lg:text-[17px] lg:leading-[27px] text-vne-ink mb-4">
            {article.summary}
          </p>

          {/* Byline + date — wraps to 2 lines on small phones */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[12px] text-vne-mute pb-4 border-b border-vne-line">
            <ClockIcon size={11} />
            <span>{dateStr}</span>
            <span className="hidden sm:inline-block w-[3px] h-[3px] rounded-full bg-[#c4c4c4]" />
            <span className="font-bold text-vne-ink">{article.author}</span>
            {article.authorRole && (
              <span className="italic text-vne-mute"> — {article.authorRole}</span>
            )}
          </div>

          {/* Hero image */}
          <figure className="my-5">
            <div className="aspect-[16/9] bg-vne-line overflow-hidden">
              <img
                src={article.heroImage}
                alt={article.heroImageCaption || article.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
            {(article.heroImageCaption || article.heroImageCredit) && (
              <figcaption className="text-[13px] italic text-vne-mute mt-2 leading-snug">
                {article.heroImageCaption}
                {article.heroImageCredit && !article.heroImageCaption?.includes(article.heroImageCredit) && (
                  <span className="not-italic"> Ảnh: {article.heroImageCredit}</span>
                )}
              </figcaption>
            )}
          </figure>

          {/* Body */}
          <div className="article-body">
            {renderBody(body)}
          </div>

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="border-t border-vne-line mt-6 pt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[12px] uppercase font-bold text-vne-mute">Tags:</span>
              {article.tags.map(tag => (
                <a
                  key={tag}
                  href={`#tag-${tag}`}
                  className="vne-subcat-chip"
                >
                  {tag.replace(/-/g, ' ')}
                </a>
              ))}
            </div>
          )}

          {/* Share row (visual only) — wraps and tightens on mobile */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 mt-5 pt-4 border-t border-vne-line">
            <span className="text-[12px] uppercase font-bold text-vne-mute w-full sm:w-auto">Chia sẻ:</span>
            {['Zalo', 'Facebook', 'X', 'Email', 'Sao chép'].map(label => (
              <button
                key={label}
                type="button"
                className="text-[12px] px-3 py-1 border border-vne-line text-vne-ink hover:border-vne-red hover:text-vne-red"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-8">
              <SectionHeader title="Bài viết liên quan" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {related.map(r => (
                  <ArticleCard key={r.slug} article={r} variant="small" showSection />
                ))}
              </div>
            </section>
          )}

          {/* Comments */}
          <Comments comments={comments} fallbackCount={article.commentCount} />
        </article>

        {/* Right rail — moves below the article on mobile and gets a top
            divider; the left border + padding only show at lg+. */}
        <aside className="lg:col-span-4 lg:border-l lg:border-vne-line lg:pl-5 mt-6 lg:mt-0 pt-6 lg:pt-0 border-t lg:border-t-0 border-vne-line">
          <SectionHeader title="Tin nóng" />
          {getRelated(article.slug, article.section, 5).map(r => (
            <ArticleCard key={r.slug} article={r} variant="list" />
          ))}
          <div className="mt-6">
            <SectionHeader title="Đọc nhiều" />
            {related.slice(0, 4).map(r => (
              <ArticleCard key={r.slug + '-read'} article={r} variant="list" />
            ))}
          </div>
        </aside>
      </div>
    </main>
  )
}
