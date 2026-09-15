import { FiArrowRight } from 'react-icons/fi';
import { Link } from 'react-router-dom';

export default function HeroSection() {
  return (
    <section className="relative min-h-[600px] lg:min-h-[700px] flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1920&q=80"
          alt="Library bookshelves"
          className="w-full h-full object-cover"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-500/90 via-navy-500/70 to-navy-500/30"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 mt-16">
        <div className="max-w-2xl">
          {/* Subtitle */}
          <p className="text-gold-400 text-sm font-semibold tracking-[0.2em] uppercase mb-4 animate-fade-in">
            Asia Pacific College
          </p>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Library
          </h1>

          {/* Description */}
          <p className="text-lg text-gray-200 mb-10 leading-relaxed max-w-lg">
            Your gateway to knowledge, research, and academic excellence. Discover resources,
            services, and support for students, faculty, and researchers.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4">
            <Link
              to="/catalog"
              className="group inline-flex items-center gap-2 px-6 py-3.5 bg-gold-500 hover:bg-gold-600 text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-xl hover:shadow-gold-500/25 hover:-translate-y-0.5"
            >
              Access Library Catalogue
              <FiArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://bookings.cloud.microsoft/book/BookALibrarian@apc.edu.ph/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 border-2 border-white/50 text-white font-semibold rounded-lg hover:bg-white/10 hover:border-white transition-all duration-300 hover:-translate-y-0.5"
            >
              Book a Librarian
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
