import { FiSearch, FiArrowRight } from 'react-icons/fi';
import { Link } from 'react-router-dom';

export default function LibraryCatalogueSection() {
  return (
    <section className="py-16 lg:py-20 bg-navy-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left Content */}
          <div className="flex items-start gap-5 max-w-xl">
            <div className="w-14 h-14 rounded-full bg-gold-500/20 flex items-center justify-center shrink-0 mt-1">
              <FiSearch className="w-6 h-6 text-gold-400" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                Access the Library Catalogue
              </h2>
              <p className="text-gray-300 leading-relaxed">
                Search our complete collection of books, journals, theses, and multimedia resources.
                Discover materials for your research and coursework.
              </p>
            </div>
          </div>

          {/* Right Buttons */}
          <div className="flex flex-wrap gap-4 shrink-0">
            <Link
              to="/catalog"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-600 text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-gold-500/25"
            >
              Search Catalogue
              <FiArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://library.apc.edu.ph/resources/new-arrivals"
              className="group inline-flex items-center gap-2 px-6 py-3 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 hover:border-white transition-all duration-300"
            >
              Browse New Arrivals
              <FiArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
