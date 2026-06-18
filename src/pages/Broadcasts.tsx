import { Link } from 'react-router-dom'
import MediaEpisodeCard from '../components/MediaEpisodeCard'
import SectionHeader from '../components/SectionHeader'
import { getEpisodesByKind } from '../lib/media'

export default function Broadcasts() {
  const broadcasts = getEpisodesByKind('broadcast')

  return (
    <main className="mx-auto max-w-[1200px] px-3 sm:px-4 pt-4 pb-10">
      <nav className="text-[12px] text-vne-mute pb-3 border-b border-vne-line">
        <Link to="/" className="hover:text-vne-red">Trang chủ</Link>
        <span className="mx-1.5">›</span>
        <span>Broadcasts</span>
      </nav>

      <section className="mt-5">
        <SectionHeader
          title="Broadcasts"
          href="/podcasts"
          subcats={[
            { label: 'Podcasts', href: '/podcasts' },
            { label: '2045 FM', href: '/2045-fm' },
          ]}
        />
        <div className="max-w-[760px]">
          <h1 className="font-serif font-bold text-[26px] leading-[34px] lg:text-[34px] lg:leading-[44px] text-vne-ink">
            Truyền hình báo điện tử 2045
          </h1>
          <p className="vne-desc mt-2">
            Những bản tin video tĩnh, ghép từ poster bài viết, giọng dẫn và phụ đề transcript.
          </p>
        </div>
      </section>

      {broadcasts.length === 0 ? (
        <div className="vne-empty-media mt-6">
          <p className="font-bold text-vne-ink">Chưa có broadcast.</p>
          <p className="text-vne-mute mt-1">Chạy script ElevenLabs để tạo video MP4.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {broadcasts.map(episode => (
            <div key={episode.id}>
              <MediaEpisodeCard episode={episode} showVideo />
              <details className="vne-transcript mt-3">
                <summary>Transcript</summary>
                <p>{episode.transcript}</p>
              </details>
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
