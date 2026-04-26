interface SubCat {
  label: string
  href?: string
}

interface Props {
  title: string
  href?: string
  subcats?: SubCat[]
}

export default function SectionHeader({ title, href = '#', subcats }: Props) {
  return (
    <div className="vne-section-title">
      <h2>{title}</h2>
      {subcats && subcats.length > 0 && (
        <div className="vne-section-subcats flex-1 ml-3">
          {subcats.map(s => (
            <a key={s.label} href={s.href ?? '#'}>{s.label}</a>
          ))}
        </div>
      )}
      <a href={href} className="vne-section-more">Xem thêm</a>
    </div>
  )
}
