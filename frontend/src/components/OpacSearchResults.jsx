import { FiList, FiShoppingCart } from 'react-icons/fi';
import { useEffect, useState } from 'react';
import { mockBooks } from '../data/books';

const getItemType = (book) => book.itemType || 'BOOKS';
const getLocation = (book) => book.location || 'Asia Pacific College Library';

const getFacetValues = (books, getValue) => [...new Set(books.map(getValue))];

export default function OpacSearchResults({ query, onFilter, onSelectBook }) {
  const [showAllAuthors, setShowAllAuthors] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredBooks = mockBooks.filter((book) => {
    if (!query) return true;

    const lowerQuery = query.toLowerCase();

    if (lowerQuery.startsWith('su:')) {
      const categorySearch = lowerQuery.replace('su:', '').trim();
      return book.category.toLowerCase() === categorySearch;
    }

    if (lowerQuery.startsWith('author:')) {
      return book.author.toLowerCase() === lowerQuery.replace('author:', '').trim();
    }

    if (lowerQuery.startsWith('category:')) {
      return book.category.toLowerCase() === lowerQuery.replace('category:', '').trim();
    }

    if (lowerQuery.startsWith('item:')) {
      return getItemType(book).toLowerCase() === lowerQuery.replace('item:', '').trim();
    }

    if (lowerQuery.startsWith('location:')) {
      return getLocation(book).toLowerCase() === lowerQuery.replace('location:', '').trim();
    }

    if (lowerQuery.startsWith('available:')) {
      return book.availability.toLowerCase().includes('items available');
    }

    return (
      book.title.toLowerCase().includes(lowerQuery) ||
      book.author.toLowerCase().includes(lowerQuery) ||
      book.category.toLowerCase().includes(lowerQuery)
    );
  });

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const paginatedBooks = filteredBooks.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  const authors = getFacetValues(mockBooks, (book) => book.author);
  const itemTypes = getFacetValues(mockBooks, getItemType);
  const locations = getFacetValues(mockBooks, getLocation);

  return (
    <div className="flex gap-6 mt-4">
      {/* Sidebar: Refine your search */}
      <div className="w-64 flex-shrink-0">
        <div className="bg-[#f8f9fa] border border-gray-200">
          <div className="bg-gray-100 p-2 border-b border-gray-200 text-sm font-semibold text-gray-700 text-center">
            Refine your search
          </div>
          
          <div className="p-3">
            <h4 className="text-xs font-bold text-gray-700 mb-1">Availability</h4>
            <button type="button" onClick={() => onFilter('available:')} className="text-xs text-blue-600 hover:underline block mb-3 text-left">
              Limit to records with available items
            </button>

            <h4 className="text-xs font-bold text-gray-700 mb-1">Authors</h4>
            <ul className="text-xs space-y-1 mb-1">
              {(showAllAuthors ? authors : authors.slice(0, 5)).map((author) => (
                <li key={author}>
                  <button type="button" onClick={() => onFilter(`author:${author}`)} className="text-blue-600 hover:underline text-left">
                    {author}
                  </button>
                </li>
              ))}
            </ul>
            {authors.length > 5 && (
              <button type="button" onClick={() => setShowAllAuthors((value) => !value)} className="text-xs text-[#1b2a4a] font-semibold hover:underline block mb-3">
                {showAllAuthors ? 'Show less' : 'Show more'}
              </button>
            )}

            <h4 className="text-xs font-bold text-gray-700 mb-1">Item types</h4>
            <ul className="text-xs space-y-1 mb-1">
              {itemTypes.map((itemType) => (
                <li key={itemType}>
                  <button type="button" onClick={() => onFilter(`item:${itemType}`)} className="text-blue-600 hover:underline text-left">
                    {itemType}
                  </button>
                </li>
              ))}
            </ul>

            <h4 className="text-xs font-bold text-gray-700 mb-1">Locations</h4>
            <ul className="text-xs space-y-1 mb-1">
              {locations.map((location) => (
                <li key={location}>
                  <button type="button" onClick={() => onFilter(`location:${location}`)} className="text-blue-600 hover:underline text-left">
                    {location}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Main Results Area */}
      <div className="flex-1">
        <h2 className="text-xl font-normal text-gray-800 mb-3">
          Your search returned <span className="font-bold">{filteredBooks.length}</span> results. <span className="text-orange-500 text-sm">RSS</span>
        </h2>

        <div className="bg-yellow-50 border border-yellow-200 p-3 text-sm text-gray-700 mb-4">
          Not what you expected? Check for <a href="#" className="text-blue-600 hover:underline">suggestions</a>
        </div>

        {/* Pagination & Sort */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex text-sm text-blue-600 gap-2">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`px-2 py-1 rounded ${page === visiblePage ? 'bg-gray-200 text-gray-700' : 'hover:underline'}`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
              disabled={visiblePage === totalPages}
              className="px-2 py-1 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              Next &gt;
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={visiblePage === totalPages}
              className="px-2 py-1 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              Last &gt;&gt;
            </button>
          </div>
          <div>
            <select className="border border-gray-300 text-sm py-1 px-2 rounded outline-none w-48">
              <option>Relevance</option>
            </select>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="bg-gray-100 border border-gray-300 flex items-center p-2 text-xs gap-3">
          <button className="text-blue-600 hover:underline flex items-center gap-1">Unhighlight</button> <span className="text-gray-400">|</span>
          <button className="text-blue-600 hover:underline flex items-center gap-1">Select all</button>
          <button className="text-blue-600 hover:underline flex items-center gap-1">Clear all</button> <span className="text-gray-400">|</span>
          <div className="flex items-center gap-1">
            <span className="text-gray-600">Select titles to:</span>
            <select className="border border-gray-300 rounded px-1 py-0.5 outline-none bg-white">
              <option>Add to...</option>
            </select>
            <button className="bg-[#5A7198] hover:bg-[#1B2A4A] text-white px-3 py-1 rounded">Save</button>
          </div>
          <button className="text-gray-400 flex items-center gap-1 cursor-not-allowed">Place hold</button>
        </div>

        {/* Results List */}
        <div className="border-x border-b border-gray-300 bg-white">
          {filteredBooks.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No results found for "{query}".
            </div>
          )}
          {paginatedBooks.map((item) => (
            <div key={item.id} className="flex border-b border-gray-200 p-4 relative">
              <div className="flex-shrink-0 w-8">
                <input type="checkbox" className="mt-1 cursor-pointer" />
              </div>
              <div className="flex-shrink-0 w-8 text-sm text-gray-500 font-semibold">
                {item.id}.
              </div>
              
              <div className="flex-1 pr-4">
                <button type="button" onClick={() => onSelectBook(item)} className="text-left text-base font-semibold text-blue-700 hover:underline cursor-pointer mb-1">
                  {item.title}
                </button>
                <div className="text-sm text-gray-700 mb-0.5">
                  by <a href="#" className="text-blue-600 hover:underline">{item.author}</a>
                </div>
                <div className="text-xs text-gray-600 mb-0.5">
                  Publisher: {item.publisher}
                </div>
                <div className="text-xs text-gray-600 mb-0.5">
                  Copyright date: {item.year}
                </div>
                <div className="text-xs text-gray-600 mb-1">
                  Online resources: <a href="#" className="text-blue-600 hover:underline">{item.online}</a>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  Availability: <span className="font-semibold text-gray-800">{item.availability}</span>
                </div>
                
                {/* Rating Stars (Mock) */}
                <div className="flex gap-1 mb-3">
                  {[1,2,3,4,5].map(star => (
                    <svg key={star} className="w-3.5 h-3.5 text-gray-300 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {/* Item Actions */}
                <div className="flex items-center gap-4 text-xs font-semibold text-blue-600">
                  <a href="#" className="hover:underline">Reserve Item</a>
                  <a href="#" className="hover:underline flex items-center gap-1"><FiList /> Save to lists</a>
                  <a href="#" className="hover:underline flex items-center gap-1"><FiShoppingCart /> Add to cart</a>
                </div>
              </div>

              {/* Cover Image */}
              <div className="flex-shrink-0 w-24">
                <img src={item.cover} alt="Book cover" className="w-full border border-gray-200 shadow-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
