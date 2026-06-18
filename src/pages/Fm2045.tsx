import { Link } from 'react-router-dom'
import MediaAudioPlayer from '../components/MediaAudioPlayer'
import MediaEpisodeCard from '../components/MediaEpisodeCard'
import SectionHeader from '../components/SectionHeader'
import { getCurrentFmEpisode, getEpisodesByKind, getJingles, getSfx } from '../lib/media'

export default function Fm2045() {
  const current = getCurrentFmEpisode()
  const episodes = getEpisodesByKind('fm')
  const jingles = getJingles()
  const sfx = getSfx()

  return (
    <main className="mx-auto max-w-[1200px] px-3 sm:px-4 pt-4 pb-10">
      <nav className="text-[12px] text-vne-mute pb-3 border-b border-vne-line">
        <Link to="/" className="hover:text-vne-red">Trang chủ</Link>
        <span className="mx-1.5">›</span>
        <span>2045 FM</span>
      </nav>

      <section className="mt-5">
        <SectionHeader
          title="2045 FM"
          href="/podcasts"
          subcats={[
            { label: 'Podcasts', href: '/podcasts' },
            { label: 'Broadcasts', href: '/broadcasts' },
          ]}
        />
        <div className="vne-fm-hero">
          <div>
            <p className="vne-fm-kicker">ON AIR</p>
            <h1>VnExpress 2045 FM</h1>
            <p>
              Một bàn phát thanh giả lập: bản tin đầu giờ, jingle, hiệu ứng âm thanh và các cụm tin
              được dựng từ thế giới 2045.
            </p>
          </div>
          {current && (
            <MediaAudioPlayer
              title={current.title}
              src={current.src}
              durationSeconds={current.durationSeconds}
              label="Đang phát"
            />
          )}
        </div>
      </section>

      {episodes.length === 0 ? (
        <div className="vne-empty-media mt-6">
          <p className="font-bold text-vne-ink">2045 FM chưa có sóng.</p>
          <p className="text-vne-mute mt-1">Chạy script ElevenLabs để tạo các cụm phát thanh.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
          {episodes.map(episode => (
            <MediaEpisodeCard key={episode.id} episode={episode} showPlayer />
          ))}
        </section>
      )}

      {(jingles.length > 0 || sfx.length > 0) && (
        <section className="mt-8">
          <SectionHeader title="Âm hiệu 2045 FM" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...jingles, ...sfx].map(asset => (
              <MediaAudioPlayer
                key={asset.id}
                title={asset.title}
                src={asset.src}
                durationSeconds={asset.durationSeconds}
                label={asset.loop ? 'Loop' : 'Âm hiệu'}
                compact
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
