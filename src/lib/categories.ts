// Shared category list used by CategoryNav (desktop strip) and MobileMenu
// (drawer). Kept here so both stay in lockstep.

export interface Category {
  label: string
  href: string
  accent?: boolean
}

export const CATEGORIES: Category[] = [
  { label: 'Mới nhất', href: '#' },
  { label: 'VnE-GO', href: '#vne-go', accent: true },
  { label: 'Thời sự', href: '#thoi-su' },
  { label: 'Thế giới', href: '#the-gioi' },
  { label: 'Kinh doanh', href: '#kinh-doanh' },
  { label: 'Khoa học', href: '#so-hoa' },
  { label: 'Góc nhìn', href: '#goc-nhin' },
  { label: 'Spotlight', href: '#' },
  { label: 'Bất động sản', href: '#bat-dong-san' },
  { label: 'Sức khỏe', href: '#suc-khoe' },
  { label: 'Giải trí', href: '#giai-tri' },
  { label: 'Thể thao', href: '#the-thao' },
  { label: 'Pháp luật', href: '#phap-luat' },
  { label: 'Giáo dục', href: '#giao-duc' },
  { label: 'Đời sống', href: '#doi-song' },
  { label: 'Xe', href: '#xe' },
  { label: 'Du lịch', href: '#du-lich' },
  { label: 'Ảnh', href: '#' },
  { label: 'Infographic', href: '#' },
  { label: 'Ý kiến', href: '#y-kien' },
  { label: 'Tâm sự', href: '#tam-su' },
  { label: 'Thư giãn', href: '#thu-gian' },
]
