import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import OpacPage from './pages/OpacPage'
import CatalogAccessPage from './pages/CatalogAccessPage'
import BookmarksPage from './pages/BookmarksPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/catalog" element={<CatalogAccessPage />} />
        <Route path="/catalog/lists" element={<BookmarksPage />} />
      </Routes>
    </Router>
  )
}

export default App
