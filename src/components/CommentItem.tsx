import type { Comment, CommentReply } from '../lib/comments'

// Deterministic colour for an avatar background based on the username.
// Picks from a soft palette so the avatar circles look like the real
// VnExpress comment widget (where letter-avatars rotate through colours).
const AVATAR_COLORS = [
  '#a4123f', // brand red
  '#1f6feb', // blue
  '#0a7c3e', // green
  '#b35400', // orange
  '#5e3aa1', // violet
  '#0e7490', // teal
  '#92400e', // amber
  '#374151', // slate
]

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initial(name: string): string {
  const parts = name.trim().split(/\s+/)
  const last = parts[parts.length - 1] || name
  return (last[0] || '?').toUpperCase()
}

/**
 * "5h trước", "2 ngày trước", "1 tuần trước". Calculated against a fixed
 * "now" of 2045-04-25T18:00 — the satirical edition's publish moment —
 * so the relative strings are stable on every load.
 */
const NOW_2045 = new Date('2045-04-25T18:00:00+07:00').getTime()

function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, NOW_2045 - t)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} ngày trước`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w} tuần trước`
  const mo = Math.floor(d / 30)
  return `${mo} tháng trước`
}

function fmtLikes(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'k'
  return String(n)
}

interface CommentBodyProps {
  comment: Comment | CommentReply
  nested?: boolean
}

function CommentBody({ comment, nested = false }: CommentBodyProps) {
  const bg = avatarColor(comment.username)
  return (
    <div
      className={`flex gap-2 sm:gap-3 ${
        nested ? 'pl-6 sm:pl-12 pt-3' : 'py-3'
      }`}
    >
      <div
        className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white text-[13px] sm:text-[14px] font-bold select-none"
        style={{ background: bg }}
        aria-hidden
      >
        {initial(comment.username)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] leading-[20px] text-vne-ink m-0 break-words">
          <span className="font-bold mr-1.5">{comment.username}</span>
          {comment.location && (
            <span className="text-[12px] text-vne-mute mr-1.5">({comment.location})</span>
          )}
          <span>{comment.body}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 mt-2 text-[12px] text-[#888]">
          <button className="flex items-center gap-1 hover:text-vne-red" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 11v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1Z" />
              <path d="M7 11l4-7c.6-1 2-1 2.6 0a3 3 0 0 1 .4 1.5V9h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" />
            </svg>
            <span>Thích</span>
          </button>
          {comment.likes > 0 && (
            <span className="text-vne-red font-bold">{fmtLikes(comment.likes)}</span>
          )}
          <button className="hover:text-vne-red" type="button">Trả lời</button>
          <button className="hover:text-vne-red flex items-center gap-1" type="button" title="Báo vi phạm">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 9V3H12.0284L10.0931 5.70938C9.96896 5.88323 9.96896 6.11677 10.0931 6.29062L12.0284 9H4ZM4 10H13C13.4067 10 13.6432 9.54032 13.4069 9.20938L11.1145 6L13.4069 2.79062C13.6432 2.45968 13.4067 2 13 2H3.5C3.22386 2 3 2.22386 3 2.5V13.5C3 13.7761 3.22386 14 3.5 14C3.77614 14 4 13.7761 4 13.5V10Z" />
            </svg>
          </button>
          <span className="ml-auto">{relTime(comment.timestamp)}</span>
        </div>
      </div>
    </div>
  )
}

export default function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="border-b border-vne-line last:border-b-0">
      <CommentBody comment={comment} />
      {comment.replies && comment.replies.length > 0 && (
        <div className="bg-[#fafafa] border-t border-vne-line">
          {comment.replies.map(r => (
            <div key={r.id} className="border-b border-vne-line last:border-b-0">
              <CommentBody comment={r} nested />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
