import { Link } from 'react-router-dom'
import MediaEpisodeCard from '../components/MediaEpisodeCard'
import SectionHeader from '../components/SectionHeader'
import { getEpisodesByKind } from '../lib/media'

export default function Podcasts() {
  const episodes = getEpisodesByKind('podcast')

  return (
    <main className="mx-auto max-w-[1200px] px-3 sm:px-4 pt-4 pb-10">
      <nav className="text-[12px] text-vne-mute pb-3 border-b border-vne-line">
        <Link to="/" className="hover:text-vne-red">Trang chủ</Link>
        <span className="mx-1.5">›</span>
        <span>Podcasts</span>
      </nav>

      <section className="mt-5">
        <SectionHeader
          title="Podcasts"
          href="/broadcasts"
          subcats={[
            { label: 'Broadcasts', href: '/broadcasts' },
            { label: '2045 FM', href: '/2045-fm' },
          ]}
        />
        <div className="max-w-[760px]">
          <h1 className="font-serif font-bold text-[26px] leading-[34px] lg:text-[34px] lg:leading-[44px] text-vne-ink">
            Nghe VnExpress 2045
          </h1>
          <p className="vne-desc mt-2">
            Các tập hội thoại do ElevenLabs tạo từ những cụm tin nổi bật của phiên bản 2045.
          </p>
        </div>
      </section>

      {episodes.length === 0 ? (
        <div className="vne-empty-media mt-6">
          <p className="font-bold text-vne-ink">Chưa có podcast.</p>
          <p className="text-vne-mute mt-1">Chạy script ElevenLabs để tạo tập đầu tiên.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 mt-6">
          {episodes.map(episode => (
            <MediaEpisodeCard key={episode.id} episode={episode} showPlayer />
          ))}
        </section>
      )}
    </main>
  )
}
