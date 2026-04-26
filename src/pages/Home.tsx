import HeroArticle from '../components/HeroArticle'
import ArticleCard from '../components/ArticleCard'
import SectionHeader from '../components/SectionHeader'
import VneGoRibbon from '../components/VneGoRibbon'
import { getAllArticles, getBySection, getHero, getTopStories } from '../lib/articles'
import { SECTION_LABELS, type Section } from '../types'

const SECTION_BLOCKS: Section[] = [
  'thoi-su',
  'the-gioi',
  'kinh-doanh',
  'so-hoa',
  'goc-nhin',
  'the-thao',
  'giai-tri',
  'doi-song',
  'du-lich',
]

// Sub-category accents per section, matching VnExpress's per-section secondary nav
const SECTION_SUBCATS: Partial<Record<Section, { label: string; href?: string }[]>> = {
  'thoi-su': [
    { label: 'Chính trị' },
    { label: 'Dân sinh' },
    { label: 'Giao thông' },
    { label: 'Việc làm' },
  ],
  'the-thao': [
    { label: 'Bóng đá' },
    { label: 'Tennis' },
    { label: 'Marathon' },
    { label: 'Các môn khác' },
  ],
  'giai-tri': [
    { label: 'Sao' },
    { label: 'Phim' },
    { label: 'Nhạc' },
    { label: 'Thời trang' },
  ],
  'the-gioi': [
    { label: 'Phân tích' },
    { label: 'Tư liệu' },
    { label: 'Quân sự' },
  ],
  'kinh-doanh': [
    { label: 'Doanh nghiệp' },
    { label: 'Chứng khoán' },
    { label: 'Quốc tế' },
  ],
}

export default function Home() {
  const hero = getHero()
  const top = getTopStories(7)
  const all = getAllArticles()

  // The 3 stories immediately after the hero become the "tin liên quan" strip
  const heroRelated = top.slice(0, 3)
  // Remaining go below as the 2x2 medium card grid
  const remainingTop = top.slice(3, 7)

  // Sidebar: take 7 latest that are not hero or in heroRelated
  const usedSlugs = new Set([hero?.slug, ...heroRelated.map(a => a.slug)])
  const rail = all.filter(a => !usedSlugs.has(a.slug)).slice(0, 7)
  const railLead = rail[0]
  const railRows = rail.slice(1, 7)

  // VnE-GO ribbon: pick lifestyle/du-lich/giai-tri articles as filler
  const vneGoSource = [
    ...getBySection('du-lich', 3),
    ...getBySection('giai-tri', 3),
    ...getBySection('doi-song', 3),
  ].filter(a => a.slug !== hero?.slug).slice(0, 6)

  if (!hero) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-10 text-center">
        <h1 className="text-2xl font-bold">VnExpress 2045</h1>
        <p className="text-vne-mute mt-2">Chưa có bài nào — phòng tin đang ngủ.</p>
        <p className="text-vne-mute text-[13px] mt-4">
          Thêm file MDX vào <code>content/articles/</code> để bắt đầu.
        </p>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-[1200px] px-3 sm:px-4 pt-4">
      {/* Top row: hero left (8/12) + side rail right (4/12) at lg+;
          single column below lg so the hero + sidebar stack like
          m.vnexpress.net's mobile layout. */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
        <div className="lg:col-span-8">
          <HeroArticle article={hero} related={heroRelated} />
          {/* Top stories grid — 1 col on phone, 2 on tablet, 4 on desktop */}
          {remainingTop.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5 mt-5">
              {remainingTop.map(a => (
                <ArticleCard
                  key={a.slug}
                  article={a}
                  variant="small"
                  showSection
                />
              ))}
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 lg:border-l lg:border-vne-line lg:pl-5 mt-5 lg:mt-0 pt-5 lg:pt-0 border-t lg:border-t-0 border-vne-line">
          {railLead && <ArticleCard article={railLead} variant="side-lead" />}
          {railRows.map(a => (
            <ArticleCard key={a.slug} article={a} variant="side-row" />
          ))}
        </aside>
      </section>

      {/* VnE-GO ribbon */}
      {vneGoSource.length > 0 && <VneGoRibbon items={vneGoSource} />}

      {/* Section blocks below */}
      <div className="mt-6 space-y-6">
        {SECTION_BLOCKS.map(sec => {
          const railSlugs = new Set(rail.map(r => r.slug))
          // Exclude the hero / heroRelated / sidebar items so each section
          // block has its own slate of stories
          const items = getBySection(sec, 8).filter(a => !usedSlugs.has(a.slug) && !railSlugs.has(a.slug))
          if (items.length === 0) return null
          const [lead, ...rest] = items
          // If section is sparse (1-2 stories), top up the right column with
          // related items from the same broad area so the grid doesn't yawn.
          if (rest.length < 2) {
            const fillers = all.filter(a =>
              !usedSlugs.has(a.slug) &&
              !railSlugs.has(a.slug) &&
              a.slug !== lead.slug &&
              !rest.find(r => r.slug === a.slug)
            ).slice(0, 4 - rest.length)
            rest.push(...fillers)
          }
          return (
            <section key={sec} id={sec}>
              <SectionHeader
                title={SECTION_LABELS[sec]}
                href={`#${sec}`}
                subcats={SECTION_SUBCATS[sec]}
              />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
                <div className="lg:col-span-6">
                  <ArticleCard article={lead} variant="medium" showSummary />
                </div>
                <div className="lg:col-span-6">
                  {rest.slice(0, 4).map(a => (
                    <ArticleCard key={a.slug} article={a} variant="side-row" />
                  ))}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
