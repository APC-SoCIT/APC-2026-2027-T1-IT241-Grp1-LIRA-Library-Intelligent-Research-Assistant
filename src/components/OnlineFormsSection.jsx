import { FiMessageSquare, FiTablet, FiMonitor } from 'react-icons/fi';

const forms = [
  {
    icon: <FiMessageSquare className="w-8 h-8" />,
    description: 'Share your experience and suggestions to help us improve library services.',
    url: 'https://forms.cloud.microsoft/r/YhNbsm7jXW',
  },
  {
    icon: <FiTablet className="w-8 h-8" />,
    description: 'Reserve a Kindle e-reader for on-campus use during your visit.',
    url: 'https://forms.cloud.microsoft/r/79UWfnMBEV',
  },
  {
    icon: <FiMonitor className="w-8 h-8" />,
    description: 'Book interactive games and equipment for library activities or events.',
    url: 'https://forms.cloud.microsoft/r/rBAfQcgLGH',
  },
];

export default function OnlineFormsSection() {
  return (
    <section className="py-16 lg:py-24 bg-gold-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-navy-500 mb-3">
            Online Forms
          </h2>
          <p className="text-navy-500/70 text-lg mb-4">
            Submit requests and reservations conveniently online
          </p>
          <div className="w-16 h-1 bg-navy-500 rounded-full mx-auto"></div>
        </div>

        {/* Form Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {forms.map((form, index) => (
            <a
              key={index}
              href={form.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              {/* Icon */}
              <div className="w-16 h-16 rounded-full bg-gold-50 border-2 border-gold-200 flex items-center justify-center mx-auto mb-5 text-gold-600 group-hover:bg-gold-500 group-hover:text-white group-hover:border-gold-500 transition-all duration-300">
                {form.icon}
              </div>

              {/* Description */}
              <p className="text-sm text-gray-500 leading-relaxed">
                {form.description}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
