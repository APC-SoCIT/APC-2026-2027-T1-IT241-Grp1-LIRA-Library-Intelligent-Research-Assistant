import { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiExternalLink, FiGlobe, FiMenu, FiX } from 'react-icons/fi';

const navLinks = [
  { label: 'Home', href: '#', active: true },
  {
    label: 'About', href: '#',
    children: [
      { label: 'VMGO', href: 'https://library.apc.edu.ph/about/vmgo' },
      { label: 'Organizational Structure', href: 'https://library.apc.edu.ph/about/organizational-structure' },
      { label: 'Library Hours', href: 'https://library.apc.edu.ph/about/library-hours' },
      { label: 'Facilities', href: 'https://library.apc.edu.ph/about/facilities' },
      { label: 'Affiliations / Partnership', href: 'https://library.apc.edu.ph/about/affiliations' },
      { label: 'Library Virtual Tour', href: 'https://library.apc.edu.ph/about/virtual-tour' },
      { label: 'Utilization Statistical Report', href: 'https://library.apc.edu.ph/about/utilization-report' },
      { label: 'Contact Information', href: 'https://library.apc.edu.ph/about/contact' },
    ]
  },
  {
    label: 'Resources', href: '#',
    children: [
      { label: 'New Arrivals', href: 'https://library.apc.edu.ph/resources/new-arrivals' },
      { label: 'Virtual Bookshelf', href: 'https://library.apc.edu.ph/resources/virtual-bookshelf' },
      { label: 'AV Materials', href: 'https://library.apc.edu.ph/resources/av-materials' },
      { label: 'Faculty Research and Publications', href: '#' },
      { label: 'Open Access Databases', href: 'https://library.apc.edu.ph/resources/open-access-databases' },
      { label: 'Open Access e-Book Databases', href: 'https://library.apc.edu.ph/resources/open-access-ebooks' },
      { label: 'Open Access e-Journals', href: 'https://library.apc.edu.ph/resources/open-access-ejournals' },
      { label: 'Online News', href: 'https://library.apc.edu.ph/resources/online-news' },
      { label: 'Open Educational Resources (OER)', href: 'https://library.apc.edu.ph/resources/oer' },
      { label: 'Open Access Theses and Dissertations', href: 'https://library.apc.edu.ph/resources/theses-dissertations' },
      { label: 'Theses / Feasibility Studies', href: 'https://library.apc.edu.ph/resources/feasibility-studies' },
      { label: 'Online Filipiniana Resources', href: 'https://library.apc.edu.ph/resources/filipiniana' },
    ]
  },
  {
    label: 'Services', href: '#',
    children: [
      { label: 'Referral Service', href: 'https://library.apc.edu.ph/services/referral' },
      { label: 'Scanning Service', href: 'https://library.apc.edu.ph/services/scanning' },
      { label: 'Online Courses (Skills Development)', href: 'https://library.apc.edu.ph/services/online-courses' },
      { label: 'Library Activities', href: 'https://library.apc.edu.ph/services/library-activities' },
      { label: 'Library Orientation / Instruction', href: 'https://library.apc.edu.ph/services/orientation' },
      { label: 'Community Extension Programs', href: 'https://library.apc.edu.ph/services/community-extension' },
      { label: 'Literacy Program', href: 'https://library.apc.edu.ph/services/literacy-program' },
    ]
  },
  { label: 'Repository', href: 'https://elibrary.apc.edu.ph', external: true },
  {
    label: 'Research', href: '#',
    children: [
      { label: 'Research Guides', href: '#' },
      { label: 'Citation Guides', href: '#' },
      { label: 'Research Tools', href: '#' },
    ]
  },
  {
    label: 'Forms', href: '#',
    children: [
      { label: 'Book Requisition', href: 'https://library.apc.edu.ph/forms/book-requisition' },
      { label: 'Feedback Form', href: '#' },
      { label: 'Kindle Reservation', href: '#' },
    ]
  },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-navy-500/95 backdrop-blur-md shadow-lg' : 'bg-navy-500'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center border-2 border-gold-300 shadow-md">
              <div className="w-6 h-6 rounded-full bg-navy-500 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-gold-400"></div>
              </div>
            </div>
          </a>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <div key={link.label} className="nav-item relative">
                <a
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors ${
                    link.active
                      ? 'text-white border-b-2 border-gold-500'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {link.label}
                  {link.external && <FiExternalLink className="w-3 h-3" />}
                  {link.children && <FiChevronDown className="w-3 h-3" />}
                </a>
                {link.children && (
                  <div className="nav-dropdown absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50">
                    {link.children.map((child) => (
                      <a
                        key={child.label}
                        href={child.href}
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gold-50 hover:text-gold-700 transition-colors"
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden lg:flex items-center gap-3">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white border border-white/30 rounded-full hover:bg-white/10 transition-colors">
              <FiGlobe className="w-4 h-4" />
              English
              <FiChevronDown className="w-3 h-3" />
            </button>
            <a href="https://library.apc.edu.ph/faqs" className="text-sm text-gray-300 hover:text-white transition-colors">FAQs</a>
            <a href="https://www.apc.edu.ph" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors">
              APC Website <FiExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://bookings.cloud.microsoft/book/BookALibrarian@apc.edu.ph/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-4 py-2 bg-gold-500 hover:bg-gold-600 text-white text-sm font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-gold-500/25"
            >
              Book a Librarian <FiExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-white p-2"
          >
            {mobileOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-navy-600 border-t border-white/10 max-h-[80vh] overflow-y-auto">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <MobileNavItem key={link.label} link={link} />
            ))}
            <div className="pt-4 border-t border-white/10 mt-4 space-y-3">
              <a href="https://library.apc.edu.ph/faqs" className="block text-sm text-gray-300 hover:text-white py-2">FAQs</a>
              <a href="https://www.apc.edu.ph" className="block text-sm text-gray-300 hover:text-white py-2">APC Website</a>
              <a
                href="https://bookings.cloud.microsoft/book/BookALibrarian@apc.edu.ph/"
                className="block w-full text-center px-4 py-2.5 bg-gold-500 text-white text-sm font-semibold rounded-lg"
              >
                Book a Librarian
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function MobileNavItem({ link }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => link.children ? setOpen(!open) : null}
        className="flex items-center justify-between w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
      >
        <span className={link.active ? 'text-gold-400 font-semibold' : ''}>{link.label}</span>
        {link.children && (
          <FiChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {link.children && open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-3">
          {link.children.map((child) => (
            <a
              key={child.label}
              href={child.href}
              className="block px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              {child.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
