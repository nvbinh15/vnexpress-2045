import Wordmark from './Wordmark'

export default function Footer() {
  return (
    <footer className="bg-white border-t-2 border-vne-red mt-10">
      <div className="mx-auto max-w-[1200px] px-4 py-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-6 text-[13px]">
        <div className="col-span-2 sm:col-span-3 lg:col-span-3">
          <Wordmark height={32} />
          <p className="text-[12px] text-vne-mute mt-3 leading-snug">
            Báo điện tử VnExpress 2045
          </p>
          <p className="text-[12px] text-vne-mute mt-1 leading-snug">
            Báo tiếng Việt nhiều người xem nhất, nhiều bot trích dẫn nhất.
          </p>
          <p className="text-[12px] text-vne-mute mt-2 leading-snug">
            Giấy phép số 71/GP-CBC, Cục Báo chí — Bộ Thông tin và Truyền thông.
          </p>
        </div>
        <div className="col-span-1 sm:col-span-1 lg:col-span-2">
          <h4 className="font-bold mb-2 uppercase text-[12px] tracking-wide">Chuyên mục</h4>
          <ul className="space-y-1 text-vne-mute">
            <li><a href="#thoi-su" className="hover:text-vne-red">Thời sự</a></li>
            <li><a href="#the-gioi" className="hover:text-vne-red">Thế giới</a></li>
            <li><a href="#kinh-doanh" className="hover:text-vne-red">Kinh doanh</a></li>
            <li><a href="#bat-dong-san" className="hover:text-vne-red">Bất động sản</a></li>
            <li><a href="#so-hoa" className="hover:text-vne-red">Khoa học công nghệ</a></li>
            <li><a href="#goc-nhin" className="hover:text-vne-red">Góc nhìn</a></li>
          </ul>
        </div>
        <div className="col-span-1 sm:col-span-1 lg:col-span-2">
          <h4 className="font-bold mb-2 uppercase text-[12px] tracking-wide">Tiện ích</h4>
          <ul className="space-y-1 text-vne-mute">
            <li><a className="hover:text-vne-red">RSS</a></li>
            <li><a className="hover:text-vne-red">Podcasts</a></li>
            <li><a className="hover:text-vne-red">Shorts</a></li>
            <li><a className="hover:text-vne-red">VnE-GO</a></li>
            <li><a className="hover:text-vne-red">Mở dữ liệu (CC BY 4.0)</a></li>
          </ul>
        </div>
        <div className="col-span-1 sm:col-span-1 lg:col-span-2">
          <h4 className="font-bold mb-2 uppercase text-[12px] tracking-wide">Lưu trữ</h4>
          <ul className="space-y-1 text-vne-mute">
            <li>VnExpress 2025</li>
            <li>VnExpress 2030</li>
            <li>VnExpress 2040</li>
            <li>Bot diary 2042</li>
          </ul>
        </div>
        <div className="col-span-2 sm:col-span-3 lg:col-span-3">
          <h4 className="font-bold mb-2 uppercase text-[12px] tracking-wide">Liên hệ</h4>
          <ul className="space-y-1 text-vne-mute">
            <li>Tổng đài: 1900 6033 (24/7)</li>
            <li>Email: contact@vnexpress2045.fake</li>
            <li>Quảng cáo: ads@vnexpress2045.fake</li>
            <li>Lab: bot-relations@vnexpress2045.fake</li>
          </ul>
          <div className="mt-3 inline-flex items-center gap-2">
            <span className="inline-block w-12 h-12 bg-vne-chip border border-vne-line text-[8px] flex items-center justify-center text-vne-mute leading-tight text-center">
              QR<br />App
            </span>
            <span className="text-[11px] text-vne-mute leading-tight">
              Tải app VnExpress 2045<br />trên iOS / Android / Neuralink
            </span>
          </div>
        </div>
      </div>
      <div className="border-t border-vne-line bg-[#fafafa]">
        <div className="mx-auto max-w-[1200px] px-4 py-3 text-[11px] text-vne-mute">
          <p className="leading-snug">
            <strong className="text-vne-ink">Trang web hư cấu (satire)</strong>
            {' '}— Nội dung và hình ảnh tạo bằng AI cho mục đích sáng tạo phi
            thương mại. Không phải sản phẩm chính thức của Báo VnExpress.
          </p>
          <div className="flex flex-col sm:flex-row justify-between gap-1 mt-1">
            <span>© 2045 VnExpress 2045 (fan-fork). Một dự án châm biếm phi thương mại.</span>
            <span>Phiên bản 2045.04 — Cập nhật lúc 06:30 GMT+7</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
