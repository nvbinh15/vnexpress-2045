import { CommentBubbleIcon } from './icons'

export default function CommentBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="vne-comment whitespace-nowrap" aria-label={`${count} ý kiến`}>
      <CommentBubbleIcon size={12} />
      <span className="leading-none">{count}</span>
    </span>
  )
}
