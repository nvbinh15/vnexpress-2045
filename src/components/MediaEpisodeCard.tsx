import { Link } from 'react-router-dom'
import type { MediaEpisode } from '../lib/media'
import { formatDuration } from '../lib/media'
import { PlayIcon, RadioIcon, VideoIcon } from './icons'
import MediaAudioPlayer from './MediaAudioPlayer'

interface Props {
  episode: MediaEpisode
  showPlayer?: boolean
  showVideo?: boolean
}

function kindLabel(kind: MediaEpisode['kind']): string {
  if (kind === 'broadcast') return 'Broadcast'
  if (kind === 'fm') return '2045 FM'
  return 'Podcast'
}

function kindHref(kind: MediaEpisode['kind']): string {
  if (kind === 'broadcast') return '/broadcasts'
  if (kind === 'fm') return '/2045-fm'
  return '/podcasts'
}

export default function MediaEpisodeCard({ episode, showPlayer = false, showVideo = false }: Props) {
  const isBroadcast = episode.kind === 'broadcast'
  return (
    <article className="vne-media-card">
      {showVideo && isBroadcast && episode.videoSrc ? (
        <div className="media-thumb">
          <video
            controls
            preload="metadata"
            poster={episode.poster}
            src={episode.videoSrc}
          />
        </div>
      ) : (
        <Link to={kindHref(episode.kind)} className="media-thumb" aria-label={episode.title}>
          <>
            <img src={episode.poster} alt="" loading="lazy" decoding="async" />
            <span className="media-play" aria-hidden="true">
              {isBroadcast ? <VideoIcon size={16} /> : episode.kind === 'fm' ? <RadioIcon size={16} /> : <PlayIcon size={12} />}
            </span>
          </>
        </Link>
      )}
      <div className="pt-2">
        <div className="vne-media-meta">
          <span>{kindLabel(episode.kind)}</span>
          <span className="sep" />
          <span>{formatDuration(episode.durationSeconds)}</span>
        </div>
        <h3 className="vne-card-title">{episode.title}</h3>
        <p className="vne-desc mt-1.5">{episode.summary}</p>
      </div>
      {showPlayer && !showVideo && (
        <div className="mt-3">
          <MediaAudioPlayer
            title={episode.title}
            src={episode.src}
            durationSeconds={episode.durationSeconds}
            label={kindLabel(episode.kind)}
            compact
          />
        </div>
      )}
    </article>
  )
}
