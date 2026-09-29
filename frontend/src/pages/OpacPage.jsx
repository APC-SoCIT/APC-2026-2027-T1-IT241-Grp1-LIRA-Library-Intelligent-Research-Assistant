import { FiSearch, FiShoppingCart, FiList, FiUser, FiChevronDown, FiGlobe, FiBookOpen } from 'react-icons/fi';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OpacSearchResults from '../components/OpacSearchResults';
import BookDetail from '../components/BookDetail';
import CatalogRecommendations from '../components/CatalogRecommendations';
import ChatbotPlaceholder from '../components/chatbot/ChatbotPlaceholder';
import { addReservationCartItem, getCatalogRecommendationHistory, listBookmarks, listReservations, recordCatalogBookView, recordCatalogSearch, removeBookmark, saveBookmark } from '../services/studentLibraryService';
import { listCatalogBooks, searchCatalogBooks } from '../services/catalogService';
import { adaptCatalogBook } from '../utils/catalogCategories';
import { catalogLanguages, translate } from '../i18n/catalogTranslations';

export default function OpacPage({ user, bookId }) {
  const [books, setBooks] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedBook, setSelectedBook] = useState(null);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkMessage, setBookmarkMessage] = useState('');
  const [reservationCart, setReservationCart] = useState([]);
  const [recommendationHistory, setRecommendationHistory] = useState({ views: [], readings: [], searches: [] });
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('lira_catalog_language');
    return catalogLanguages.some(({ code }) => code === savedLanguage) ? savedLanguage : 'en';
  });
  const navigate = useNavigate();

  const firstName = user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Student';
  const t = (key) => translate(language, key);

  const handleSelectBook = (book) => {
    setSelectedBook(book);
    const viewedAt = new Date().toISOString();
    const view = {
      book_id: book.id,
      title: book.title,
      author: book.author || null,
      item_type: book.itemType || null,
      genres: book.genres || [],
      subjects: book.subjects || [],
      series: book.series || null,
      publisher: book.publisher || null,
      publication_place: book.publicationPlace || null,
      publication_year: book.publicationYear || null,
      url: book.url || null,
      viewed_at: viewedAt,
    };

    setRecommendationHistory((current) => ({
      ...current,
      views: [view, ...current.views.filter((item) => item.book_id !== book.id)],
    }));
    recordCatalogBookView(book).catch((error) => {
      setBookmarkMessage(error.message || 'Could not save this book view for recommendations.');
    });
  };

  useEffect(() => {
    let isCurrent = true;
    listCatalogBooks()
      .then((items) => { if (isCurrent) setBooks(items.map(adaptCatalogBook)); })
      .catch((error) => { if (isCurrent) setCatalogError(error.message || 'Could not load the library catalog.'); })
      .finally(() => { if (isCurrent) setIsLoadingCatalog(false); });
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    const selected = books.find((book) => String(book.id) === String(bookId));
    if (selected) handleSelectBook(selected);
  }, [bookId, books]);

  useEffect(() => {
    listBookmarks()
      .then((items) => setBookmarks(items))
      .catch(() => setBookmarks([]));
  }, []);

  useEffect(() => {
    listReservations()
      .then((items) => setReservationCart(items))
      .catch((error) => setBookmarkMessage(error.message || 'Could not load your reservation cart.'));
  }, []);

  useEffect(() => {
    getCatalogRecommendationHistory()
      .then((history) => setRecommendationHistory(history))
      .catch((error) => setBookmarkMessage(error.message || t('activityHistoryError')));
  }, []);

  const handleLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    localStorage.setItem('lira_catalog_language', nextLanguage);
  };

  const handleShowBookmarks = async () => {
    setShowBookmarks((visible) => !visible);
    if (!showBookmarks) {
      try {
        setBookmarks(await listBookmarks());
        setBookmarkMessage('');
      } catch (error) {
        setBookmarkMessage(error.message || 'Could not load your list.');
      }
    }
  };

  const handleSaveBookmark = async (book) => {
    try {
      const alreadySaved = bookmarks.some((item) => item.book_id === book.id);
      if (alreadySaved) {
        await removeBookmark(book.id);
        setBookmarks((current) => current.filter((item) => item.book_id !== book.id));
        setBookmarkMessage(`Removed “${book.title}” from your list.`);
      } else {
        const bookmark = await saveBookmark(book);
        setBookmarks((current) => [bookmark, ...current.filter((item) => item.book_id !== bookmark.book_id)]);
        setBookmarkMessage(`Saved “${book.title}” to your list.`);
      }
    } catch (error) {
      setBookmarkMessage(error.message || 'Could not save this book.');
    }
  };

  const handleAddToCart = async (book) => {
    try {
      const item = await addReservationCartItem(book);
      setReservationCart((current) => [item, ...current.filter((entry) => entry.book_id !== item.book_id)]);
      setBookmarkMessage(`Added “${book.title}” to your reservation cart.`);
    } catch (error) {
      setBookmarkMessage(error.message || 'Could not add this book to your reservation cart.');
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    try {
      setCatalogError('');
      setIsSearching(true);
      setShowRecommendations(true);
      setSelectedBook(null);
      const query = searchQuery.trim();
      if (query) {
        setRecommendationHistory((current) => ({
          ...current,
          searches: [{ query, created_at: new Date().toISOString() }, ...current.searches],
        }));
        try {
          await recordCatalogSearch(query);
        } catch (error) {
          setBookmarkMessage(`${t('searchHistorySavedError')} ${error.message || ''}`.trim());
        }
      }
      const results = query
        ? await searchCatalogBooks(query)
        : await listCatalogBooks();
      setBooks(results.map(adaptCatalogBook));
    } catch (error) {
      setCatalogError(error.message || 'Could not search the library catalog.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center text-sm text-[#1b2a4a]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => navigate('/catalog/reservations')} className="flex items-center gap-1 hover:text-blue-600 transition-colors relative">
              <FiShoppingCart className="w-4 h-4" /> {t('reservationCart')} {reservationCart.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full absolute -top-2 -right-3">{reservationCart.length}</span>}
            </button>
            <button type="button" onClick={() => { handleShowBookmarks(); }} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
              <FiList className="w-4 h-4" /> {t('lists')} <FiChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className="flex items-center gap-1 font-semibold hover:text-blue-600 transition-colors">
            <FiUser className="w-4 h-4" /> {t('welcome')}, {firstName} <FiChevronDown className="w-3 h-3" />
          </button>
          <label className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 hover:border-blue-400">
            <FiGlobe className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t('language')}</span>
            <select
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value)}
              aria-label={t('language')}
              className="max-w-32 cursor-pointer bg-transparent text-xs outline-none"
            >
              {catalogLanguages.map(({ code, nativeLabel }) => (
                <option key={code} value={code}>{nativeLabel}</option>
              ))}
            </select>
          </label>
        </div>
      </nav>

      {showBookmarks && (
        <aside className="catalog-bookmarks-dropdown fixed left-20 top-14 z-50 w-80 max-w-[calc(100%-2rem)] border border-gray-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-sm font-bold text-[#1b2a4a]">My list</h2>
            <span className="text-xs text-gray-500">{bookmarks.length} saved</span>
          </div>
          {bookmarks.length === 0 ? <p className="text-sm text-gray-500">No saved books yet.</p> : <ul className="space-y-3">
            {bookmarks.slice(0, 5).map((bookmark) => <li key={bookmark.book_id} className="text-sm"><button type="button" onClick={() => navigate(`/catalog?book=${bookmark.book_id}`)} className="text-left hover:underline"><strong className="block text-[#1b2a4a]">{bookmark.title}</strong><span className="text-xs text-gray-500">{bookmark.author || 'Unknown author'}</span></button></li>)}
          </ul>}
          <button type="button" onClick={() => navigate('/catalog/lists')} className="mt-4 w-full border-t border-gray-200 pt-3 text-left text-sm font-semibold text-blue-700 hover:underline">View all {bookmarks.length} saved books</button>
        </aside>
      )}
      {bookmarkMessage && <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 bg-[#1b2a4a] px-4 py-2 text-sm text-white shadow-lg">{bookmarkMessage}</div>}

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-[#142544] via-[#1b2a4a] to-[#245485] px-5 py-12 text-white sm:px-8 sm:py-16">
        <img src="/opac-banner.png" alt={t('bannerAlt')} className="mx-auto block h-auto w-full max-w-[2000px]" />
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Search Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[#1b2a4a] mb-2">{t('exploreCollection')}</h2>
          <p className="text-gray-500 text-sm">{t('searchDescription')}</p>
        </div>

        {/* Search Bar container */}
        <form onSubmit={handleSearch} onMouseEnter={() => setShowRecommendations(true)} className="mx-auto flex max-w-5xl flex-wrap gap-2 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200">
            <input 
              aria-label={t('searchPlaceholder')}
              type="text" 
              placeholder={t('searchPlaceholder')}
              onFocus={() => setShowRecommendations(true)}
              className="min-w-0 flex-1 basis-64 rounded-lg px-4 py-3 text-slate-800 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          <button type="button" onClick={() => setShowRecommendations((visible) => !visible)} aria-pressed={showRecommendations} className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${showRecommendations ? 'border-[#73532f] bg-[#faf5eb] text-[#5b4126]' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            <FiBookOpen className="h-4 w-4" aria-hidden="true" /> {t('recommendations')}
          </button>
          <button type="submit" disabled={isSearching} className="flex items-center justify-center gap-2 rounded-lg bg-[#1b2a4a] px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-900 disabled:cursor-wait disabled:opacity-60">
             <FiSearch className="w-5 h-5" />
             {isSearching ? t('searching') : t('search')}
          </button>
        </form>
        
        {/* Sub search links */}
        {catalogError ? (
          <div className="bg-red-50 border border-red-200 p-6 text-center text-sm text-red-700">{catalogError}</div>
        ) : isLoadingCatalog ? (
          <div className="bg-white border border-gray-200 p-8 text-center text-sm text-gray-500">{t('loadingCatalog')}</div>
        ) : selectedBook ? (
          <BookDetail book={selectedBook} language={language} onBack={() => setSelectedBook(null)} onSaveBookmark={handleSaveBookmark} onReserveBook={handleAddToCart} isBookmarked={bookmarks.some((item) => item.book_id === selectedBook.id)} />
        ) : (
          <OpacSearchResults books={books} query={searchQuery} language={language} sourceFilter={sourceFilter} onSourceFilterChange={setSourceFilter} onSelectBook={handleSelectBook} onSaveBookmark={handleSaveBookmark} onReserveBook={handleAddToCart} isBookmarked={(book) => bookmarks.some((item) => item.book_id === book.id)} />
        )}
        {showRecommendations && !isLoadingCatalog && (
          <CatalogRecommendations
            books={books}
            history={recommendationHistory}
            selectedBook={selectedBook}
            language={language}
            onSelectBook={handleSelectBook}
          />
        )}
      </main>
      
      <ChatbotPlaceholder language={language} />
    </div>
  );
}
