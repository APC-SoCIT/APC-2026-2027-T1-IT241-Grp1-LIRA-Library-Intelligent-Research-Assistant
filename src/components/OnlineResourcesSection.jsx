import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import { FiExternalLink } from 'react-icons/fi';
import 'swiper/css';
import 'swiper/css/navigation';

const resources = [
  {
    name: 'SOMA Verge',
    category: 'Digital Library',
    categoryColor: 'bg-blue-100 text-blue-700',
    description: 'Digital media and academic content platform for research and learning from the School of Multimedia and Arts.',
    url: 'https://somaverge.apc.edu.ph/',
    icon: '🌐',
  },
  {
    name: 'ADB',
    category: 'Research',
    categoryColor: 'bg-green-100 text-green-700',
    description: 'Asian Development Bank — publications, data, and research on Asia-Pacific development.',
    url: 'https://www.adb.org',
    icon: '🏦',
  },
  {
    name: 'DOST SciNET - PHIL',
    category: 'Science',
    categoryColor: 'bg-purple-100 text-purple-700',
    description: 'Department of Science and Technology — Philippine Science and Technology information network.',
    url: 'https://scinet.dost.gov.ph',
    icon: '🔬',
  },
  {
    name: 'Starbooks',
    category: 'Science',
    categoryColor: 'bg-purple-100 text-purple-700',
    description: 'Science and Technology Academic and Research-Based Openly Operated KioskS — offline science library.',
    url: 'https://www.starbooks.ph',
    icon: '⭐',
  },
  {
    name: 'AJOL',
    category: 'Journals',
    categoryColor: 'bg-amber-100 text-amber-700',
    description: 'Ateneo Journals Online — scholarly journals and publications from the Ateneo network.',
    url: 'https://archium.ateneo.edu/ateneo-journals/',
    icon: '📚',
  },
  {
    name: 'JSTOR',
    category: 'Journals',
    categoryColor: 'bg-amber-100 text-amber-700',
    description: 'Digital library of academic journals, books, and primary sources.',
    url: 'https://www.jstor.org',
    icon: '📖',
  },
  {
    name: 'HighWire',
    category: 'Journals',
    categoryColor: 'bg-amber-100 text-amber-700',
    description: 'HighWire Press — hosted scholarly journals and publications from leading publishers.',
    url: 'https://www.highwirepress.com',
    icon: '📄',
  },
  {
    name: 'CCCOER',
    category: 'OER',
    categoryColor: 'bg-teal-100 text-teal-700',
    description: 'Community College Consortium for Open Educational Resources (CCCOER) — free and open teaching materials.',
    url: 'https://www.cccoer.org',
    icon: '🎓',
  },
  {
    name: 'Obooko',
    category: 'eBooks',
    categoryColor: 'bg-rose-100 text-rose-700',
    description: 'Free ebooks by contemporary authors across fiction and non-fiction genres.',
    url: 'https://www.obooko.com',
    icon: '📱',
  },
  {
    name: 'LinkedIn',
    category: 'Learning',
    categoryColor: 'bg-sky-100 text-sky-700',
    description: 'Professional networking and LinkedIn Learning courses for skills development.',
    url: 'https://www.linkedin.com/learning',
    icon: '💼',
  },
  {
    name: 'Project Gutenberg',
    category: 'eBooks',
    categoryColor: 'bg-rose-100 text-rose-700',
    description: 'Library of over 70,000 free ebooks, including classic literature and reference works.',
    url: 'https://www.gutenberg.org',
    icon: '📕',
  },
  {
    name: 'NIST',
    category: 'Standards',
    categoryColor: 'bg-gray-100 text-gray-700',
    description: 'National Institute of Standards and Technology — data, standards, and scientific reference.',
    url: 'https://www.nist.gov',
    icon: '⚖️',
  },
  {
    name: 'J-Gate',
    category: 'Discovery',
    categoryColor: 'bg-indigo-100 text-indigo-700',
    description: 'Journal discovery and access platform for academic and research literature.',
    url: 'https://jgateplus.com',
    icon: '🔍',
  },
  {
    name: 'Gadgets Magazine',
    category: 'News',
    categoryColor: 'bg-red-100 text-red-700',
    description: 'Technology news, reviews, and features from the Philippines and beyond.',
    url: 'https://www.gadgetsmagazine.com.ph',
    icon: '📰',
  },
];

export default function OnlineResourcesSection() {
  return (
    <section className="py-16 lg:py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-navy-500 mb-3">
            Online Resources
          </h2>
          <p className="text-gray-500 text-lg mb-4">
            Access subscribed databases, open collections, and digital learning platforms
          </p>
          <div className="w-16 h-1 bg-navy-500 rounded-full mx-auto"></div>
        </div>

        {/* Resources Carousel */}
        <Swiper
          modules={[Navigation]}
          spaceBetween={20}
          slidesPerView={1}
          navigation
          breakpoints={{
            480: { slidesPerView: 1.5 },
            768: { slidesPerView: 2.5 },
            1024: { slidesPerView: 3.5 },
            1280: { slidesPerView: 4 },
          }}
          className="resources-swiper"
        >
          {resources.map((resource, index) => (
            <SwiperSlide key={index}>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-gold-200 transition-all duration-300 h-full flex flex-col">
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-xl mb-4">
                  {resource.icon}
                </div>

                {/* Category Badge */}
                <span className={`inline-block px-2.5 py-1 text-[10px] font-semibold rounded-full mb-3 w-fit ${resource.categoryColor}`}>
                  {resource.category}
                </span>

                {/* Name */}
                <h3 className="text-base font-bold text-navy-500 mb-2">
                  {resource.name}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-400 leading-relaxed mb-4 flex-grow line-clamp-3">
                  {resource.description}
                </p>

                {/* Link */}
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-gold-600 hover:text-gold-700 text-sm font-semibold transition-colors group"
                >
                  Visit site
                  <FiExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
