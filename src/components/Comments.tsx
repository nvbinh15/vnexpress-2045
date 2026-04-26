import { useState } from 'react'
import { countComments, type Comment } from '../lib/comments'
import CommentItem from './CommentItem'

interface Props {
  comments: Comment[]
  /** Total comment count from the article frontmatter — used in the
   * "Ý kiến (N)" header. Falls back to the actual length of the data. */
  fallbackCount?: number
}

type SortMode = 'top' | 'new'

export default function Comments({ comments, fallbackCount }: Props) {
  const [sort, setSort] = useState<SortMode>('top')
  const [showAll, setShowAll] = useState(false)

  // Display the article's stated comment count (from frontmatter) so the
  // header reads as on real VnExpress where loaded comments are a subset of
  // total. Fall back to the actual loaded count if no fallback was passed.
  const loaded = countComments(comments)
  const total = Math.max(fallbackCount ?? 0, loaded)

  const sorted = [...comments].sort((a, b) => {
    if (sort === 'top') return b.likes - a.likes
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  const visible = showAll ? sorted : sorted.slice(0, 10)
  const hasMore = sorted.length > 10 && !showAll

  return (
    <section className="mt-8">
      {/* Title row "Ý kiến (N)" */}
      <div className="border-t-[3px] border-vne-red pt-2 pb-3">
        <h2 className="text-[18px] font-bold text-vne-ink m-0 inline">Ý kiến</h2>
        <span className="text-[18px] text-vne-mute ml-1"> ({total})</span>
      </div>

      {/* Input form (visual only) */}
      <form
        className="mb-4"
        onSubmit={e => e.preventDefault()}
      >
        <textarea
          placeholder="Chia sẻ ý kiến của bạn"
          className="w-full min-h-[70px] border border-vne-line p-3 text-[14px] outline-none focus:border-vne-red resize-y"
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            className="bg-vne-red text-white px-6 py-1.5 text-[13px] font-bold uppercase tracking-wide hover:opacity-90"
          >
            Gửi
          </button>
        </div>
      </form>

      {/* Sort tabs */}
      <div className="flex gap-5 border-b border-vne-line pb-2 mb-1 text-[13px]">
        <button
          type="button"
          onClick={() => setSort('top')}
          className={
            sort === 'top'
              ? 'text-vne-red font-bold'
              : 'text-vne-mute hover:text-vne-red'
          }
        >
          Quan tâm nhất
        </button>
        <button
          type="button"
          onClick={() => setSort('new')}
          className={
            sort === 'new'
              ? 'text-vne-red font-bold'
              : 'text-vne-mute hover:text-vne-red'
          }
        >
          Mới nhất
        </button>
      </div>

      {/* List */}
      {comments.length === 0 ? (
        <p className="text-vne-mute text-[14px] py-6 text-center">
          Chưa có ý kiến nào. Hãy là người đầu tiên chia sẻ.
        </p>
      ) : (
        <div>
          {visible.map(c => (
            <CommentItem key={c.id} comment={c} />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="block w-full text-center bg-[#fdeef2] text-vne-red font-bold py-3 mt-2 text-[14px] hover:bg-[#fadce4]"
        >
          Xem thêm ý kiến
        </button>
      )}
    </section>
  )
}
