import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Wordmark from './Wordmark'
import WeatherWidget from './WeatherWidget'
import { CloseIcon, SearchIcon, UserIcon } from './icons'

interface Category {
  label: string
  href: string
  accent?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  categories: Category[]
}

/**
 * Slide-in drawer modeled on m.vnexpress.net's hamburger sheet:
 * - Full-height right-side overlay
 * - Header row with brand mark and close X
 * - Search input at the top
 * - Login + utility row (weather, RSS, Podcasts)
 * - Vertical list of all categories
 *
 * No external library — just state-driven Tailwind classes and a backdrop.
 */
export default function MobileMenu({ open, onClose, categories }: Props) {
  // Lock body scroll while open so the drawer feels like a sheet.
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/45 transition-opacity duration-200 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Drawer */}
      <aside
        aria-hidden={!open}
        aria-label="Menu chính"
        className={`fixed inset-y-0 right-0 z-50 flex w-[85vw] max-w-[360px] flex-col bg-white shadow-2xl transition-transform duration-250 ease-out lg:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between border-b border-vne-line px-4 h-[56px]">
          <Link to="/" onClick={onClose} aria-label="VnExpress 2045">
            <Wordmark height={28} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="p-2 -mr-2 text-vne-ink hover:text-vne-red"
          >
            <CloseIcon size={22} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Search */}
          <div className="px-4 pt-4">
            <label className="flex items-center gap-2 border border-vne-line px-3 h-10 focus-within:border-vne-red">
              <SearchIcon size={16} className="text-vne-mute" />
              <input
                type="search"
                placeholder="Tìm kiếm trên VnExpress 2045"
                className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-vne-mute"
              />
            </label>
          </div>

          {/* Account + utility row */}
          <div className="px-4 pt-4 pb-3 flex items-center gap-4 text-[13px] text-vne-ink">
            <button className="flex items-center gap-1.5 hover:text-vne-red">
              <UserIcon size={16} />
              Đăng nhập
            </button>
            <span className="text-vne-line">|</span>
            <a className="hover:text-vne-red">RSS</a>
            <span className="text-vne-line">|</span>
            <a className="hover:text-vne-red">Podcasts</a>
          </div>

          {/* Weather */}
          <div className="px-4 pb-3 text-[12px]">
            <WeatherWidget />
          </div>

          <div className="border-t border-vne-line" />

          {/* Categories list */}
          <nav aria-label="Chuyên mục" className="px-2 py-2">
            <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-vne-mute">
              Chuyên mục
            </p>
            <ul>
              {categories.map(c => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    onClick={onClose}
                    className={`flex items-center px-3 py-2.5 text-[15px] border-b border-vne-line/60 ${
                      c.accent ? 'text-vne-red font-bold' : 'text-vne-ink'
                    } hover:text-vne-red`}
                  >
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="px-4 py-4 text-[11px] text-vne-mute leading-snug">
            <p>
              <strong className="text-vne-ink">Trang web hư cấu (satire)</strong>
              {' '}— phiên bản 2045 do fan tạo.
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
