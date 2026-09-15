import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import { FiArrowRight } from 'react-icons/fi';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const announcements = [
  {
    title: 'Recommended Reads',
    description: 'Looking for your next read? Browse book recommendations and reviews from fellow Rams to discover stories and ideas worth exploring.',
    image: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=600&q=80',
    link: '#',
  },
  {
    title: 'Explore APC Library!',
    description: 'Access the APC Library Orientation and Information Literacy is a self-paced module to learn about library services, resources, and essential research skills through self-paced guides and video tutorials.',
    image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&q=80',
    link: '#',
    badge: 'Available',
  },
  {
    title: 'Book of the Month',
    description: 'Discover Stephen R. Covey\'s timeless classic, The 7 Habits of Highly Effective People, our featured Book of the Month. Learn practical principles for personal and professional growth.',
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80',
    link: '#',
  },
  {
    title: 'APC recognized as a DOST-STII STARBOOKS Partner',
    description: 'Asia Pacific College has been recognized by the Department of Science and Technology – Science and Technology Information Institute (DOST-STII) as a STARBOOKS Circle of Collaborators Partner.',
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&q=80',
    link: '#',
  },
];

export default function AnnouncementsSection() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-navy-500 mb-3">
            Announcements
          </h2>
          <div className="w-16 h-1 bg-gold-500 rounded-full mb-4"></div>
          <p className="text-gray-500 text-lg">
            Stay updated with the latest news and events from APC Library
          </p>
        </div>

        {/* Carousel */}
        <Swiper
          modules={[Navigation, Pagination, Autoplay]}
          spaceBetween={30}
          slidesPerView={1}
          navigation
          pagination={{ clickable: true }}
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          className="announcements-swiper"
        >
          {announcements.map((item, index) => (
            <SwiperSlide key={index}>
              <div className="flex flex-col md:flex-row bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100">
                {/* Image */}
                <div className="md:w-1/2 relative overflow-hidden group">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-64 md:h-80 object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute bottom-4 left-4">
                    <span className="px-3 py-1.5 bg-white/90 backdrop-blur-sm text-navy-500 text-xs font-medium rounded-md">
                      Click for details
                    </span>
                  </div>
                </div>
                {/* Content */}
                <div className="md:w-1/2 p-8 lg:p-10 flex flex-col justify-center">
                  <div className="w-10 h-1 bg-gold-500 rounded-full mb-5"></div>
                  {item.badge && (
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full mb-3 w-fit">
                      {item.badge}
                    </span>
                  )}
                  <h3 className="text-xl lg:text-2xl font-bold text-navy-500 mb-4">
                    {item.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed mb-6">
                    {item.description}
                  </p>
                  <a
                    href={item.link}
                    className="inline-flex items-center gap-2 text-gold-600 hover:text-gold-700 font-semibold transition-colors group"
                  >
                    Read full details
                    <FiArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
