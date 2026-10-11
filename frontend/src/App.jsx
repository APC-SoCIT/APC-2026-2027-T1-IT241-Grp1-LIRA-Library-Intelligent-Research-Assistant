import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import OpacPage from './pages/OpacPage'
import CatalogAccessPage from './pages/CatalogAccessPage'
import BookmarksPage from './pages/BookmarksPage'
import ReaderPage from './pages/ReaderPage'
import LibrarianCatalogPage from './pages/LibrarianCatalogPage'


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/catalog" element={<CatalogAccessPage />} />
        <Route path="/catalog/lists" element={<BookmarksPage />} />
        <Route path="/catalog/cart" element={<Navigate replace to="/catalog" />} />
        <Route path="/catalog/read/:bookId" element={<ReaderPage />} />
        <Route path="/catalog/librarian" element={<LibrarianCatalogPage />} />
      </Routes>
    </Router>
  )
}

export default App
