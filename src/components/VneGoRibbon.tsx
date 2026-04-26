import { Link } from 'react-router-dom'
import type { Article } from '../types'

interface Props {
  items: Article[]
}

/**
 * VnE-GO ribbon — VnExpress's lifestyle/shopping micro-section displayed as
 * a horizontal accent strip with a red branded badge on the left and a
 * scrollable list of titles + thumbs on the right.
 */
export default function VneGoRibbon({ items }: Props) {
  if (items.length === 0) return null
  return (
    <div className="vne-go-ribbon" id="vne-go">
      <div className="badge">
        VnE<span className="small">·GO</span>
      </div>
      <div className="strip-list">
        {items.slice(0, 6).map(it => (
          <Link key={it.slug} to={it.url} className="strip-item">
            <div className="thumb">
              <img src={it.heroImage} alt="" />
            </div>
            <h4>{it.title}</h4>
          </Link>
        ))}
      </div>
    </div>
  )
}
