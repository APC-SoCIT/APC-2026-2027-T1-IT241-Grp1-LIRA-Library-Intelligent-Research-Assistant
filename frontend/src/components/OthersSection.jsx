import { FiBook, FiFileText, FiBookmark, FiStar } from 'react-icons/fi';

const otherResources = [
  {
    icon: <FiBook className="w-6 h-6" />,
    title: 'Virtual Bookshelf',
    description: 'Browse featured and themed collections',
    url: 'https://library.apc.edu.ph/resources/virtual-bookshelf',
  },
  {
    icon: <FiFileText className="w-6 h-6" />,
    title: 'Library Guide',
    description: 'Policies, services, and how to get started',
    url: '#',
  },
  {
    icon: <FiBookmark className="w-6 h-6" />,
    title: 'Course Reserves',
    description: 'Materials reserved for your classes',
    url: 'https://library.apc.edu.ph/cgi-bin/koha/opac-course-reserves.pl',
  },
  {
    icon: <FiStar className="w-6 h-6" />,
    title: 'Book Reviews',
    description: 'Read reviews and discover books recommended by our community.',
    url: '#',
  },
];

export default function OthersSection() {
  return (
    <section className="py-16 lg:py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-navy-500 mb-3">
            Others
          </h2>
          <p className="text-gray-500 text-lg mb-4">
            Additional library resources and community features
          </p>
          <div className="w-16 h-1 bg-navy-500 rounded-full mx-auto"></div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {otherResources.map((resource, index) => (
            <a
              key={index}
              href={resource.url}
              className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gold-200 transition-all duration-300 hover:-translate-y-1 text-center"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-gold-50 flex items-center justify-center mx-auto mb-4 text-gold-600 group-hover:bg-gold-500 group-hover:text-white transition-all duration-300">
                {resource.icon}
              </div>

              {/* Title */}
              <h3 className="text-base font-bold text-navy-500 mb-2">
                {resource.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-400 leading-relaxed">
                {resource.description}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
