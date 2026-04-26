import { Link } from 'react-router-dom'
import Wordmark from './Wordmark'
import { MenuIcon, SearchIcon, UserIcon } from './icons'

interface Props {
  onOpenMenu?: () => void
}

export default function Header({ onOpenMenu }: Props) {
  return (
    <header className="bg-white border-b border-vne-line">
      <div className="mx-auto max-w-[1200px] px-3 sm:px-4 h-[56px] lg:h-[80px] flex items-center justify-between gap-2">
        {/* Mobile: hamburger on the left, like m.vnexpress.net */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Mở menu"
          className="lg:hidden p-2 -ml-2 text-vne-ink hover:text-vne-red"
        >
          <MenuIcon size={22} />
        </button>

        {/* Wordmark — center on mobile, left on desktop. Tagline only on lg+. */}
        <Link
          to="/"
          className="flex items-end gap-3 lg:flex-none"
          aria-label="VnExpress 2045"
        >
          <Wordmark height={28} className="lg:h-[42px] h-[28px] w-auto" />
          <span className="hidden lg:inline text-[11px] text-vne-mute leading-tight pb-1 italic max-w-[230px]">
            Báo tiếng Việt nhiều người xem nhất, nhiều bot trích dẫn nhất
          </span>
        </Link>

        {/* Desktop nav cluster */}
        <div className="hidden lg:flex items-center gap-3 text-[13px]">
          <a className="text-vne-ink hover:text-vne-red">Mới nhất</a>
          <span className="text-vne-line">|</span>
          <a className="text-vne-ink hover:text-vne-red">Tin theo khu vực</a>
          <span className="text-vne-line">|</span>
          <a className="text-vne-ink hover:text-vne-red flex items-center gap-1">
            <span className="inline-block bg-vne-red text-white px-1.5 py-0.5 text-[10px] font-bold rounded-sm">EN</span>
            International
          </a>
          <span className="text-vne-line">|</span>
          <button
            aria-label="Tìm kiếm"
            className="text-vne-ink hover:text-vne-red p-1"
          >
            <SearchIcon size={18} />
          </button>
          <a className="text-vne-ink hover:text-vne-red flex items-center gap-1">
            <UserIcon size={16} />
            Đăng nhập
          </a>
        </div>

        {/* Mobile: search + login icons on the right */}
        <div className="flex items-center gap-1 lg:hidden">
          <button
            aria-label="Tìm kiếm"
            onClick={onOpenMenu}
            className="p-2 text-vne-ink hover:text-vne-red"
          >
            <SearchIcon size={18} />
          </button>
          <button
            aria-label="Tài khoản"
            onClick={onOpenMenu}
            className="p-2 -mr-1 text-vne-ink hover:text-vne-red"
          >
            <UserIcon size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
