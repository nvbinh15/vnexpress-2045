import { Link } from 'react-router-dom'
import { getCurrentFmEpisode, getEpisodesByKind } from '../lib/media'
import SectionHeader from './SectionHeader'
import MediaEpisodeCard from './MediaEpisodeCard'
import MediaAudioPlayer from './MediaAudioPlayer'

export default function MediaHub() {
  const podcasts = getEpisodesByKind('podcast', 3)
  const broadcasts = getEpisodesByKind('broadcast', 2)
  const fmNow = getCurrentFmEpisode()
  const hasMedia = podcasts.length > 0 || broadcasts.length > 0 || fmNow

  if (!hasMedia) {
    return (
      <section className="mt-6" id="podcasts">
        <SectionHeader title="Podcasts & Broadcasts" href="/podcasts" />
        <div className="vne-empty-media">
          <p className="font-bold text-vne-ink">Phòng audio đang dựng sóng.</p>
          <p className="text-vne-mute mt-1">
            Chạy script ElevenLabs để tạo podcast, broadcast và 2045 FM.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-6" id="podcasts">
      <SectionHeader
        title="Podcasts & Broadcasts"
        href="/podcasts"
        subcats={[
          { label: 'Podcasts', href: '/podcasts' },
          { label: 'Broadcasts', href: '/broadcasts' },
          { label: '2045 FM', href: '/2045-fm' },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
        <div className="lg:col-span-7">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {podcasts.map(episode => (
              <MediaEpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        </div>
        <aside className="lg:col-span-5 lg:border-l lg:border-vne-line lg:pl-5">
          {fmNow && (
            <div className="vne-fm-live">
              <div className="vne-fm-live-head">
                <span>ON AIR</span>
                <Link to="/2045-fm">2045 FM</Link>
              </div>
              <h3>{fmNow.title}</h3>
              <p>{fmNow.summary}</p>
              <MediaAudioPlayer
                title={fmNow.title}
                src={fmNow.src}
                durationSeconds={fmNow.durationSeconds}
                label="Đang phát"
                compact
              />
            </div>
          )}
          <div className="mt-4 space-y-3">
            {broadcasts.map(episode => (
              <MediaEpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        </aside>
      </div>
    </section>
  )
}
