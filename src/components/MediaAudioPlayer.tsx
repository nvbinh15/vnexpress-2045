import { formatDuration } from '../lib/media'
import { HeadphonesIcon } from './icons'

interface Props {
  title: string
  src: string
  durationSeconds?: number | null
  label?: string
  compact?: boolean
}

export default function MediaAudioPlayer({
  title,
  src,
  durationSeconds = null,
  label = 'Audio',
  compact = false,
}: Props) {
  return (
    <div className={`vne-audio-player ${compact ? 'is-compact' : ''}`}>
      <div className="vne-audio-player-head">
        <span className="vne-audio-icon" aria-hidden="true">
          <HeadphonesIcon size={15} />
        </span>
        <div className="min-w-0">
          <p className="vne-audio-label">{label}</p>
          <h3>{title}</h3>
        </div>
        <span className="vne-audio-duration">{formatDuration(durationSeconds)}</span>
      </div>
      <audio controls preload="metadata" src={src}>
        Trình duyệt của bạn không hỗ trợ audio.
      </audio>
    </div>
  )
}
