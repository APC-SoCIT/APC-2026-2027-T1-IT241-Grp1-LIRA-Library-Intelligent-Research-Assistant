import { FiSearch, FiShoppingCart, FiList, FiUser, FiChevronDown } from 'react-icons/fi';
import { FaBrain, FaCog, FaCode, FaBook, FaCamera, FaCalculator, FaBuilding, FaChartBar, FaUserGraduate } from 'react-icons/fa';
import { useState } from 'react';
import OpacSearchResults from '../components/OpacSearchResults';

export default function OpacPage() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('su:Psychology');

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setIsSearching(true);
  };

  const handleCategoryClick = (e, category) => {
    e.preventDefault();
    setSearchQuery(`su:${category}`);
    setIsSearching(true);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center text-sm text-[#1b2a4a]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1 font-bold italic text-lg text-[#1b2a4a]">
             koha
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 hover:text-blue-600 transition-colors">
              <FiShoppingCart className="w-4 h-4" /> Cart
            </button>
            <button className="flex items-center gap-1 hover:text-blue-600 transition-colors">
              <FiList className="w-4 h-4" /> Lists <FiChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1 font-semibold hover:text-blue-600 transition-colors">
            <FiUser className="w-4 h-4" /> Welcome, Lance Art Fortaleza Fortaleza <FiChevronDown className="w-3 h-3" />
          </button>
          <button className="flex items-center gap-1 hover:text-blue-600 transition-colors">
            Languages <FiChevronDown className="w-3 h-3" />
          </button>
        </div>
      </nav>

      {/* Hero Banner */}
      <div className="bg-[#1b2a4a] text-white py-12 px-8 relative overflow-hidden flex items-center justify-center">
        {/* Mock background building silhouette */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&q=80')] bg-cover bg-center"></div>
        <div className="relative z-10 flex items-center gap-8 max-w-5xl w-full">
           <div className="w-24 h-24 bg-yellow-500 rounded-lg flex-shrink-0 flex flex-col justify-end overflow-hidden border-b-4 border-yellow-600 shadow-lg" style={{clipPath: 'polygon(20% 0%, 80% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)'}}>
             <div className="w-full h-1/3 bg-yellow-400 mt-auto"></div>
           </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wider text-gray-300 mb-1">ASIA PACIFIC COLLEGE LIBRARY</h2>
            <h1 className="text-4xl md:text-5xl font-bold">Online Public Access Catalog</h1>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Search Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[#1b2a4a] mb-2">Explore the Collection</h2>
          <p className="text-gray-500 text-sm">Search for books, digital resources, theses, and more.</p>
        </div>

        {/* Search Bar container */}
        <form onSubmit={handleSearch} className="bg-[#1b2a4a] p-3 rounded-md flex shadow-md mb-2">
          <div className="flex bg-white rounded flex-1 overflow-hidden h-10">
            <select className="bg-white border-r border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none w-40">
              <option>Library catalog</option>
            </select>
            <input 
              type="text" 
              className="flex-1 px-4 py-2 outline-none text-gray-800 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select className="bg-white border-l border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none w-40">
              <option>All Item Types</option>
            </select>
          </div>
          <button type="submit" className="bg-[#1b2a4a] hover:bg-blue-900 transition-colors text-white px-4 flex items-center justify-center rounded-r-md">
             <FiSearch className="w-5 h-5" />
          </button>
        </form>
        
        {/* Sub search links */}
        <div className="flex gap-2 text-xs text-blue-600 mb-6 px-1">
          <a href="#" className="hover:underline">Advanced search</a> | 
          <a href="#" className="hover:underline">Course reserves</a> | 
          <a href="#" className="hover:underline">Authority search</a> | 
          <a href="#" className="hover:underline">Library</a>
        </div>

        {isSearching ? (
          <OpacSearchResults query={searchQuery} />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8 max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
            <div className="w-6 h-6 bg-[#1b2a4a] rounded flex items-center justify-center">
               <div className="w-2.5 h-2.5 border-2 border-white rounded-sm"></div>
            </div>
            <h3 className="text-lg font-bold text-[#1b2a4a]">Browse by Category</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Category Cards */}
            <a href="#" onClick={(e) => handleCategoryClick(e, 'Psychology')} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all group cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                <FaBrain className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1b2a4a] group-hover:text-blue-600 transition-colors">Psychology</h4>
                <p className="text-xs text-gray-500">Mind & behavior</p>
              </div>
            </a>

            <a href="#" onClick={(e) => handleCategoryClick(e, 'Engineering')} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all group cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                <FaCog className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1b2a4a] group-hover:text-blue-600 transition-colors">Engineering</h4>
                <p className="text-xs text-gray-500">Design & technology</p>
              </div>
            </a>

            <a href="#" onClick={(e) => handleCategoryClick(e, 'Computer Science')} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all group cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                <FaCode className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1b2a4a] group-hover:text-blue-600 transition-colors">Computer Science</h4>
                <p className="text-xs text-gray-500">Computing & programming</p>
              </div>
            </a>

            <a href="#" onClick={(e) => handleCategoryClick(e, 'Literature')} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all group cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                <FaBook className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1b2a4a] group-hover:text-blue-600 transition-colors">Literature</h4>
                <p className="text-xs text-gray-500">Books & literary works</p>
              </div>
            </a>

            <a href="#" className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                <FaCamera className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1b2a4a] group-hover:text-blue-600 transition-colors">Photography</h4>
                <p className="text-xs text-gray-500">Images & visual media</p>
              </div>
            </a>

            <a href="#" onClick={(e) => handleCategoryClick(e, 'Accounting')} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all group cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                <FaCalculator className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1b2a4a] group-hover:text-blue-600 transition-colors">Accounting</h4>
                <p className="text-xs text-gray-500">Finance & financial reporting</p>
              </div>
            </a>

            <a href="#" onClick={(e) => handleCategoryClick(e, 'Architecture')} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all group cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                <FaBuilding className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1b2a4a] group-hover:text-blue-600 transition-colors">Architecture</h4>
                <p className="text-xs text-gray-500">Building, planning & design</p>
              </div>
            </a>

            <a href="#" onClick={(e) => handleCategoryClick(e, 'Business & Economics')} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all group cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                <FaChartBar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1b2a4a] group-hover:text-blue-600 transition-colors">Business & Economics</h4>
                <p className="text-xs text-gray-500">Markets, management & economy</p>
              </div>
            </a>

            <a href="#" className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-lg bg-amber-700 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                <FaUserGraduate className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1b2a4a] group-hover:text-blue-600 transition-colors">History</h4>
                <p className="text-xs text-gray-500">People, events & civilizations</p>
              </div>
            </a>

          </div>
        </div>
        )}
      </main>
      
      {/* Footer bar */}
      <footer className="bg-gray-800 text-gray-400 text-xs py-2 px-4 fixed bottom-0 w-full">
         https://library.apc.edu.ph
      </footer>
    </div>
  );
}
