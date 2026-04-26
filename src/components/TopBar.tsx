import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import WeatherWidget from './WeatherWidget'

const VN_WEEKDAY: Record<number, string> = {
  0: 'Chủ Nhật',
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
}

export default function TopBar() {
  // Pin to "today" in the 2045 universe
  const now = new Date()
  const fakeDate = new Date(now)
  fakeDate.setFullYear(2045)
  const wd = VN_WEEKDAY[fakeDate.getDay()]
  const dmy = format(fakeDate, 'd/M/yyyy', { locale: vi })
  const hm = format(fakeDate, 'HH:mm', { locale: vi })

  // m.vnexpress.net hides the desktop utility bar entirely on mobile —
  // we follow that pattern: shown from lg and up only.
  return (
    <div className="hidden lg:block border-b border-vne-line bg-white text-[12px] text-vne-mute">
      <div className="mx-auto flex h-[28px] max-w-[1200px] items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span>{wd}, {dmy}, {hm} (GMT+7)</span>
          <span className="text-vne-line">|</span>
          <a className="hover:text-vne-red">RSS</a>
        </div>
        <div className="flex items-center gap-3">
          <WeatherWidget />
          <span className="text-vne-line">|</span>
          <a className="hover:text-vne-red">Podcasts</a>
          <span className="text-vne-line">|</span>
          <a className="hover:text-vne-red">Đăng ký</a>
        </div>
      </div>
    </div>
  )
}
