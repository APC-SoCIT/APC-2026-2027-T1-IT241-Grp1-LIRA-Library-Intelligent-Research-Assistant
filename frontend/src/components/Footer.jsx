import { FiMapPin, FiPhone, FiMail, FiExternalLink } from 'react-icons/fi';

const aboutLinks = [
  { label: 'VMGO', href: 'https://library.apc.edu.ph/about/vmgo' },
  { label: 'Organizational Structure', href: 'https://library.apc.edu.ph/about/organizational-structure' },
  { label: 'Library Hours', href: 'https://library.apc.edu.ph/about/library-hours' },
  { label: 'Facilities', href: 'https://library.apc.edu.ph/about/facilities' },
  { label: 'Affiliations / Partnership', href: 'https://library.apc.edu.ph/about/affiliations' },
  { label: 'Library Virtual Tour', href: 'https://library.apc.edu.ph/about/virtual-tour' },
  { label: 'Utilization Statistical Report', href: 'https://library.apc.edu.ph/about/utilization-report' },
  { label: 'Contact Information', href: 'https://library.apc.edu.ph/about/contact' },
];

const resourceLinks = [
  { label: 'New Arrivals', href: 'https://library.apc.edu.ph/resources/new-arrivals' },
  { label: 'Virtual Bookshelf', href: 'https://library.apc.edu.ph/resources/virtual-bookshelf' },
  { label: 'AV Materials', href: 'https://library.apc.edu.ph/resources/av-materials' },
  { label: 'Faculty Research and Publications', href: '#' },
  { label: 'Open Access Databases', href: 'https://library.apc.edu.ph/resources/open-access-databases' },
  { label: 'Open Access e-Book Databases', href: 'https://library.apc.edu.ph/resources/open-access-ebooks' },
  { label: 'Open Access e-Journals', href: 'https://library.apc.edu.ph/resources/open-access-ejournals' },
  { label: 'Online News', href: 'https://library.apc.edu.ph/resources/online-news' },
  { label: 'Open Educational Resources (OER)', href: 'https://library.apc.edu.ph/resources/oer' },
  { label: 'Theses and Dissertations', href: 'https://library.apc.edu.ph/resources/theses-dissertations' },
  { label: 'Theses / Feasibility Studies', href: 'https://library.apc.edu.ph/resources/feasibility-studies' },
  { label: 'Online Filipiniana Resources', href: 'https://library.apc.edu.ph/resources/filipiniana' },
];

const serviceLinks = [
  { label: 'Referral Service', href: 'https://library.apc.edu.ph/services/referral' },
  { label: 'Scanning Service', href: 'https://library.apc.edu.ph/services/scanning' },
  { label: 'Online Courses (Skills Development)', href: 'https://library.apc.edu.ph/services/online-courses' },
  { label: 'Library Activities', href: 'https://library.apc.edu.ph/services/library-activities' },
  { label: 'Library Orientation / Instruction', href: 'https://library.apc.edu.ph/services/orientation' },
  { label: 'Community Extension Programs', href: 'https://library.apc.edu.ph/services/community-extension' },
  { label: 'Literacy Program', href: 'https://library.apc.edu.ph/services/literacy-program' },
];

const quickLinks = [
  { label: 'Book a Librarian', href: 'https://bookings.cloud.microsoft/book/BookALibrarian@apc.edu.ph/', external: true },
  { label: 'FAQs', href: 'https://library.apc.edu.ph/faqs' },
  { label: 'APC Repository Project', href: 'https://elibrary.apc.edu.ph', external: true },
  { label: 'Forms', href: 'https://library.apc.edu.ph/forms/book-requisition' },
];

export default function Footer() {
  return (
    <footer className="bg-navy-500 text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Branding & Contact */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center border-2 border-gold-300">
                <div className="w-6 h-6 rounded-full bg-navy-500 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-gold-400"></div>
                </div>
              </div>
              <div>
                <div className="font-bold text-lg leading-tight">APC Library</div>
                <div className="text-xs text-gray-400">Asia Pacific College</div>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              Empowering the APC community with world-class library resources, research support, and academic services.
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm text-gray-400">
                <FiMapPin className="w-4 h-4 mt-0.5 shrink-0 text-gold-400" />
                <span>7th Floor Building, 3 Humabon Place, Magallanes, Makati City</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <FiPhone className="w-4 h-4 shrink-0 text-gold-400" />
                <span>+63 (2) 8852-9000</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <FiMail className="w-4 h-4 shrink-0 text-gold-400" />
                <a href="mailto:library@apc.edu.ph" className="hover:text-gold-400 transition-colors">
                  library@apc.edu.ph
                </a>
              </div>
            </div>
          </div>

          {/* About Links */}
          <div>
            <h3 className="text-base font-bold mb-5 text-gold-400">About</h3>
            <ul className="space-y-2.5">
              {aboutLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-base font-bold mb-5 text-gold-400">Resources</h3>
            <ul className="space-y-2.5">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services Links */}
          <div>
            <h3 className="text-base font-bold mb-5 text-gold-400">Services</h3>
            <ul className="space-y-2.5">
              {serviceLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            {/* Quick Links */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <ul className="space-y-2.5">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {link.label}
                      {link.external && <FiExternalLink className="w-3 h-3" />}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <p className="text-sm text-gray-500 text-center">
            © {new Date().getFullYear()} Asia Pacific College Library. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
