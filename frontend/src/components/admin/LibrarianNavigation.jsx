import { NavLink } from 'react-router-dom'
import { FiBookOpen, FiMessageCircle } from 'react-icons/fi'
import './librarianNavigation.css'

export default function LibrarianNavigation({ onNavigate }) {
  return (
    <nav className="librarian-workspace-nav" aria-label="Librarian workspace">
      <NavLink end to="/catalog/librarian" onClick={onNavigate}><FiBookOpen aria-hidden="true" /> Catalog management</NavLink>
      <NavLink to="/catalog/librarian/knowledge" onClick={onNavigate}><FiMessageCircle aria-hidden="true" /> FAQs & policies</NavLink>
    </nav>
  )
}
