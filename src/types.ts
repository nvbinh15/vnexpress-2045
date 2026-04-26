export type Section =
  | 'thoi-su'
  | 'the-gioi'
  | 'kinh-doanh'
  | 'bat-dong-san'
  | 'suc-khoe'
  | 'the-thao'
  | 'giai-tri'
  | 'phap-luat'
  | 'giao-duc'
  | 'doi-song'
  | 'xe'
  | 'du-lich'
  | 'so-hoa'
  | 'y-kien'
  | 'tam-su'
  | 'goc-nhin'
  | 'thu-gian'

export interface ArticleFrontmatter {
  slug: string
  title: string
  section: Section
  subsection?: string
  author: string
  authorRole?: string
  publishedAt: string
  summary: string
  heroImage: string
  heroImageCaption?: string
  heroImageCredit?: string
  tags: string[]
  featured: boolean
  priority: number
  commentCount: number
  readMinutes: number
}

export interface Article extends ArticleFrontmatter {
  // Computed / runtime fields
  url: string
}

export const SECTION_LABELS: Record<Section, string> = {
  'thoi-su': 'Thời sự',
  'the-gioi': 'Thế giới',
  'kinh-doanh': 'Kinh doanh',
  'bat-dong-san': 'Bất động sản',
  'suc-khoe': 'Sức khỏe',
  'the-thao': 'Thể thao',
  'giai-tri': 'Giải trí',
  'phap-luat': 'Pháp luật',
  'giao-duc': 'Giáo dục',
  'doi-song': 'Đời sống',
  'xe': 'Xe',
  'du-lich': 'Du lịch',
  'so-hoa': 'Số hóa',
  'y-kien': 'Ý kiến',
  'tam-su': 'Tâm sự',
  'goc-nhin': 'Góc nhìn',
  'thu-gian': 'Thư giãn',
}
