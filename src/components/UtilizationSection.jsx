import { FiExternalLink } from 'react-icons/fi';

const topBorrowers = [
  { name: 'ANGELITA SALTINO', count: 284 },
  { name: 'Jan Eleonore Montalbo', count: 143 },
  { name: 'Tracy Kidoguchi', count: 72 },
  { name: 'Bernard Josef Miranda', count: 68 },
  { name: 'MANUEL PAOLO LAURENA', count: 43 },
  { name: 'Cherrisie Jumantag', count: 28 },
  { name: 'Vida Camilla Arciaga', count: 27 },
  { name: 'Henrique Luis Beltacion', count: 24 },
  { name: 'Emilio Torralba', count: 20 },
  { name: 'Raymond Zamora', count: 20 },
  { name: 'Bay Ariel Sta.Tomas', count: 14 },
];

const topTitles = [
  { title: 'Management science', count: 32 },
  { title: 'Introduction to networks', count: 23 },
  { title: 'Auditing and assurance', count: 19 },
  { title: 'Government accounting /', count: 16 },
  { title: 'Introduction to the philosophy of the human person /', count: 16 },
  { title: 'Contemporary moral problems /', count: 15 },
  { title: 'Social psychology /', count: 15 },
];

const maxCount = topBorrowers[0].count;

export default function UtilizationSection() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-navy-500 mb-3">
            Utilization
          </h2>
          <p className="text-gray-500 text-lg mb-4 max-w-2xl mx-auto">
            A quick snapshot of how the APC Library supports learning, research, and services across the year.
          </p>
          <div className="w-16 h-1 bg-navy-500 rounded-full mx-auto"></div>
        </div>

        {/* Dashboard Card */}
        <div className="border-2 border-gold-400 rounded-2xl overflow-hidden bg-white shadow-lg max-w-5xl mx-auto">
          {/* Dashboard Header */}
          <div className="bg-white px-6 py-5 border-b border-gray-100">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center border-2 border-gold-300">
                  <div className="w-7 h-7 rounded-full bg-navy-500 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-gold-400"></div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl lg:text-2xl font-bold text-navy-500">
                    BOOK UTILIZATION A.Y. 2025 – 2026
                  </h3>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-navy-500">1002</div>
                <p className="text-xs text-gray-400">Total Number of Books Borrowed</p>
              </div>
            </div>
          </div>

          {/* Dashboard Body */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
            {/* Filters Panel */}
            <div className="p-6 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gray-50/50">
              <h4 className="text-sm font-semibold text-navy-500 mb-4">Date Range</h4>
              <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
                <span className="px-2 py-1 bg-white border border-gray-200 rounded">7/21/2025</span>
                <span>to</span>
                <span className="px-2 py-1 bg-white border border-gray-200 rounded">5/30/2026</span>
              </div>
              <div className="w-full h-1 bg-gray-200 rounded-full mb-6 relative">
                <div className="absolute left-0 w-full h-1 bg-navy-400 rounded-full"></div>
                <div className="absolute left-0 w-3 h-3 bg-navy-500 rounded-full -top-1 border-2 border-white shadow"></div>
                <div className="absolute right-0 w-3 h-3 bg-navy-500 rounded-full -top-1 border-2 border-white shadow"></div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-navy-500 block mb-1.5">School / Office</label>
                  <select className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-600">
                    <option>All</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-navy-500 block mb-1.5">Program</label>
                  <select className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-600">
                    <option>All</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-navy-500 block mb-1.5">Category</label>
                  <select className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-600">
                    <option>Faculty</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="col-span-2 p-6">
              <div className="space-y-2.5">
                {topBorrowers.map((borrower, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-600 w-40 truncate text-right shrink-0">
                      {borrower.name}
                    </span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-sm transition-all duration-1000 flex items-center justify-end pr-1"
                        style={{ width: `${(borrower.count / maxCount) * 100}%` }}
                      >
                        <span className="text-[10px] text-white font-semibold">{borrower.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-center">
                <span className="text-xs text-gray-400">Borrowers</span>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border-t border-gray-100">
            {/* Pie Chart */}
            <div className="p-6 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-gray-100">
              <div className="relative w-32 h-32 mb-4">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="20" />
                  <circle
                    cx="50" cy="50" r="40" fill="none" stroke="#1B2A4A" strokeWidth="20"
                    strokeDasharray="251.2" strokeDashoffset="0"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-navy-500">16 (100%)</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Categ..</span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-navy-500"></span>
                  Faculty
                </span>
              </div>
            </div>

            {/* Top Titles Table */}
            <div className="col-span-2 p-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-sm font-bold text-navy-500 pb-3">Title</th>
                    <th className="text-right text-sm font-bold text-navy-500 pb-3">Count of Title</th>
                  </tr>
                </thead>
                <tbody>
                  {topTitles.map((item, index) => (
                    <tr key={index} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2.5 text-sm text-gray-600">{item.title}</td>
                      <td className="py-2.5 text-sm text-gray-600 text-right font-medium">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* View Full Report Link */}
        <div className="text-center mt-8">
          <a
            href="https://library.apc.edu.ph/about/utilization-report"
            className="inline-flex items-center gap-2 text-gold-600 hover:text-gold-700 font-semibold transition-colors group"
          >
            View full utilization report
            <FiExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
