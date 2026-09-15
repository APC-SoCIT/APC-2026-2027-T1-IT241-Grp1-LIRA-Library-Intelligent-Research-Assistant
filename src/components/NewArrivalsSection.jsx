import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { FiArrowRight } from 'react-icons/fi';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const newArrivals = [
  {
    title: 'Architectural graphics',
    author: 'Francis D.K. Ching',
    cover: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&q=80',
  },
  {
    title: 'Strategic management for tourism, hospitality and events',
    author: 'Nigel G. Evans',
    cover: 'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=400&q=80',
  },
  {
    title: 'Philippine gastronomical tourism',
    author: 'Abram Emmanuel Peralta, Jonna Dotimas, Jefferson Marcelo',
    cover: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=400&q=80',
  },
  {
    title: 'Valuation : concepts and methods',
    author: 'Ferdinand L. Timbang',
    cover: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80',
  },
  {
    title: 'Architecture: form, space, & order',
    author: 'Francis D.K. Ching',
    cover: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&q=80',
  },
  {
    title: 'Architectural design with SketchUp',
    author: 'Alexander C. Schreyer',
    cover: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&q=80',
  },
  {
    title: 'Simplified income taxation',
    author: 'Ramelo C. Gloria, Aldin L. Pantaleon',
    cover: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80',
  },
];

export default function NewArrivalsSection() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-navy-500 mb-3">
            New Arrivals
          </h2>
          <p className="text-gray-500 text-lg mb-4">
            Recently added titles available in the APC Library collection
          </p>
          <div className="w-16 h-1 bg-navy-500 rounded-full mx-auto"></div>
        </div>

        {/* Book Carousel */}
        <Swiper
          modules={[Navigation, Pagination]}
          spaceBetween={24}
          slidesPerView={1.5}
          centeredSlides={true}
          navigation
          pagination={{ clickable: true }}
          breakpoints={{
            480: { slidesPerView: 2.2 },
            768: { slidesPerView: 3.2 },
            1024: { slidesPerView: 4.2 },
            1280: { slidesPerView: 5 },
          }}
          className="new-arrivals-swiper pb-14"
        >
          {newArrivals.map((book, index) => (
            <SwiperSlide key={index}>
              {({ isActive }) => (
                <div className={`bg-white rounded-xl overflow-hidden transition-all duration-300 ${
                  isActive
                    ? 'border-2 border-gold-500 shadow-xl scale-[1.02]'
                    : 'border border-gray-100 shadow-md hover:shadow-lg'
                }`}>
                  {/* Cover */}
                  <div className="aspect-[3/4] overflow-hidden bg-gray-100">
                    <img
                      src={book.cover}
                      alt={book.title}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-navy-500 mb-1 line-clamp-2 leading-snug">
                      {book.title}
                    </h3>
                    <p className="text-xs text-gray-400 mb-3 line-clamp-1">{book.author}</p>
                    <a
                      href="#"
                      className="inline-flex items-center gap-1 text-gold-600 hover:text-gold-700 text-xs font-semibold transition-colors group"
                    >
                      View details
                      <FiArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
