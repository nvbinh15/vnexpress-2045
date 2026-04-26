import { Link } from 'react-router-dom'
import { HomeIcon, MenuIcon } from './icons'
import { CATEGORIES } from '../lib/categories'

export default function CategoryNav() {
  return (
    <nav className="sticky top-0 z-30 bg-white border-b border-vne-line shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="mx-auto max-w-[1200px] px-2 sm:px-4 flex items-center">
        <Link
          to="/"
          className="vne-nav-link shrink-0 border-r border-vne-line/70 lg:border-0 pr-2 lg:pr-2"
          aria-label="Trang chủ"
        >
          <HomeIcon size={16} />
        </Link>
        <div className="vne-scroll-x flex flex-1">
          {CATEGORIES.map(c => (
            <a
              key={c.label}
              href={c.href}
              className={`vne-nav-link ${c.accent ? 'vne-nav-accent' : ''}`}
            >
              {c.label}
            </a>
          ))}
        </div>
        {/* "Tất cả" shortcut only at desktop — on mobile the hamburger
            in the header already opens the full-list drawer.
            Wrapped in a span because .vne-nav-link's `display: inline-flex`
            otherwise wins over the `hidden` utility. */}
        <span className="hidden lg:inline-flex">
          <a className="vne-nav-link text-vne-mute items-center gap-1">
            <MenuIcon size={14} />
            Tất cả
          </a>
        </span>
      </div>
    </nav>
  )
}
