import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { FiArrowRight } from 'react-icons/fi';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { useNavigate } from 'react-router-dom';
import BookCover from './BookCover';

export default function FeaturedBooksSection({ books = [] }) {
  const navigate = useNavigate();
  return (
    <section className="py-16 lg:py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-navy-500 mb-3">
            Featured Books
          </h2>
          <p className="text-gray-500 text-lg mb-4">
            Explore popular titles in our collection
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
          className="featured-books-swiper pb-14"
        >
          {books.map((book) => (
            <SwiperSlide key={book.id}>
              {({ isActive }) => (
                <div className={`bg-white rounded-xl overflow-hidden transition-all duration-300 ${
                  isActive
                    ? 'border-2 border-gold-500 shadow-xl scale-[1.02]'
                    : 'border border-gray-100 shadow-md hover:shadow-lg'
                }`}>
                  {/* Cover */}
                  <div className="aspect-[3/4] overflow-hidden bg-gray-100">
                    <BookCover book={book} className="w-full h-full transition-transform duration-500 hover:scale-105" />
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-navy-500 mb-1 line-clamp-2 leading-snug">
                      {book.title}
                    </h3>
                    <p className="text-xs text-gray-400 mb-3 line-clamp-1">{book.author}</p>
                    <a
                      href={`/catalog?book=${book.id}`}
                      onClick={(event) => { event.preventDefault(); navigate(`/catalog?book=${book.id}`) }}
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
