import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import TopBar from './components/TopBar'
import Header from './components/Header'
import CategoryNav from './components/CategoryNav'
import Footer from './components/Footer'
import MobileMenu from './components/MobileMenu'
import { CATEGORIES } from './lib/categories'
import Home from './pages/Home'
import Article from './pages/Article'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-vne-ink">404 — Không tìm thấy</h1>
      <p className="text-vne-mute mt-3">
        Trang bạn đang tìm có thể đã bị bot kiểm duyệt rút khỏi hệ thống.
      </p>
      <a href="/" className="inline-block mt-6 text-vne-red font-bold">Về trang chủ</a>
    </main>
  )
}

export default function App() {
  // Hamburger drawer state lives at the top so the trigger (Header) and the
  // overlay (MobileMenu) can communicate without prop-drilling.
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="min-h-screen bg-white">
        <TopBar />
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <CategoryNav />
        <Routes>
          <Route path="/" element={<Home />} />
          {/* VnExpress URL convention: /:section/:slug.html */}
          <Route path="/:section/:slug.html" element={<Article />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
        <MobileMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          categories={CATEGORIES}
        />
      </div>
    </BrowserRouter>
  )
}
