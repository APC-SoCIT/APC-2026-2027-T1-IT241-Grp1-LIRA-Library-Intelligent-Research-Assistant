import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CatalogAccessPage from './pages/CatalogAccessPage'
import BookmarksPage from './pages/BookmarksPage'
import ReaderPage from './pages/ReaderPage'
import LibrarianCatalogPage from './pages/LibrarianCatalogPage'
import LibrarianKnowledgePage from './pages/LibrarianKnowledgePage'
import LibrarianBookSummariesPage from './pages/LibrarianBookSummariesPage'


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
        <Route path="/catalog/librarian/knowledge" element={<LibrarianKnowledgePage />} />
        <Route path="/catalog/librarian/summaries" element={<LibrarianBookSummariesPage />} />
      </Routes>
    </Router>
  )
}

export default App
