import {
  FiArrowLeft,
  FiBookmark,
  FiChevronRight,
  FiDownload,
  FiGrid,
  FiList,
  FiMail,
  FiPrinter,
  FiSearch,
  FiShoppingCart,
  FiStar,
} from 'react-icons/fi';

const getCallNumber = (book) => {
  const match = book.availability.match(/call number: ([^\]]+)/i);
  return match ? match[1] : 'Available at the library';
};

export default function BookDetail({ book, onBack }) {
  const callNumber = getCallNumber(book);
  const copyCount = book.availability.match(/Library \((\d+)\)/)?.[1] || '1';

  return (
    <section className="mt-4 border border-[#d8dde2] bg-white text-[#3d4b57] text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#d8dde2] bg-[#f7f8f9] px-3 py-2 text-xs text-[#35658e]">
        <button type="button" onClick={onBack} className="flex items-center gap-1 hover:underline"><FiArrowLeft /> Back to results</button>
        <span>|</span><button type="button" className="hover:underline">Advanced search</button>
        <span>|</span><button type="button" className="hover:underline">Course reserves</button>
        <span>|</span><button type="button" className="hover:underline">Authority search</button>
      </div>

      <div className="grid gap-5 p-3 lg:grid-cols-[minmax(0,1fr)_285px]">
        <div>
          <div className="mb-3 flex items-center gap-2 border-b border-[#d8dde2] pb-2 text-xs text-[#35658e]">
            <button type="button" className="flex items-center gap-1 bg-[#edf3f7] px-2 py-1"><FiList /> Normal view</button>
            <button type="button" className="flex items-center gap-1 px-2 py-1 hover:bg-[#edf3f7]"><FiGrid /> MARC view</button>
            <button type="button" className="flex items-center gap-1 px-2 py-1 hover:bg-[#edf3f7]"><FiGrid /> ISBD view</button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-36 shrink-0 border border-[#cbdde4] p-2 text-center text-xs text-[#72808c]">
              <img src={book.cover} alt={`${book.title} cover`} className="mx-auto h-44 w-28 object-cover" />
              <div className="pt-2">Local cover image</div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold leading-tight text-[#5d6973]">{book.title}</h1>
              <p className="mt-2 text-xs"><strong>By:</strong> <a href="#" className="text-[#1672ae] hover:underline">{book.author}</a> <FiSearch className="inline text-[#1672ae]" /></p>
              <p className="mt-3 text-xs"><strong>Publisher:</strong> {book.publisher}</p>
              <p className="mt-2 text-xs"><strong>Copyright date:</strong> {book.year}</p>
              <p className="mt-2 text-xs"><strong>Content type:</strong> text &nbsp; <strong>Media type:</strong> unmediated &nbsp; <strong>Carrier type:</strong> volume</p>
              <p className="mt-2 text-xs"><strong>ISBN:</strong> 978-{book.id}000000</p>
              <p className="mt-2 text-xs"><strong>Subject(s):</strong> <a href="#" className="text-[#1672ae] hover:underline">{book.category}</a> <FiSearch className="inline text-[#1672ae]" /></p>
              <p className="mt-2 text-xs"><strong>LOC classification:</strong> {callNumber}</p>
              <p className="mt-2 text-xs"><strong>Online Resources:</strong> <a href="#" className="text-[#1672ae] hover:underline">{book.online}</a></p>
            </div>
          </div>

          <div className="mt-4 text-xs">
            <a href="#contents" className="text-[#1672ae] hover:underline">• Click to access the Table of Contents</a>
            <div className="mt-1 flex items-center gap-1 text-[#c7cdd1]" aria-label="No ratings yet">
              {[1, 2, 3, 4, 5].map((star) => <FiStar key={star} className="h-4 w-4 fill-current" />)}
              <span className="ml-3 text-[#59656f]">Average rating: 0.0 (0 votes)</span>
            </div>
          </div>

          <div className="mt-4 flex border-b border-[#d8dde2] text-xs">
            <button type="button" className="border border-b-0 border-[#d8dde2] bg-white px-3 py-2 font-semibold">Holdings ( {copyCount} )</button>
            <button type="button" className="border-b border-[#d8dde2] px-3 py-2 text-[#1672ae]">Comments ( 0 )</button>
            <button type="button" className="border-b border-[#d8dde2] px-3 py-2 text-[#1672ae]">Images</button>
          </div>
          <div className="overflow-x-auto">
            <table className="mt-3 min-w-[720px] w-full border-collapse text-xs">
              <thead className="bg-[#e7ecef] text-left text-[#3d4b57]"><tr>{['Item type', 'Current library', 'Call number', 'Copy number', 'Status', 'Date due', 'Barcode', 'Item holds'].map((heading) => <th key={heading} className="border border-[#d8dde2] px-2 py-2 font-semibold">{heading}</th>)}</tr></thead>
              <tbody><tr>
                <td className="border border-[#d8dde2] px-2 py-3">BOOKS</td>
                <td className="border border-[#d8dde2] px-2 py-3">Asia Pacific College Library<br /><em>Filipiniana Section</em></td>
                <td className="border border-[#d8dde2] px-2 py-3 text-[#1672ae]">{callNumber}<br />(Browse shelf)</td>
                <td className="border border-[#d8dde2] px-2 py-3">c1</td>
                <td className="border border-[#d8dde2] px-2 py-3 text-[#5e70ae]">Available</td>
                <td className="border border-[#d8dde2] px-2 py-3"></td>
                <td className="border border-[#d8dde2] px-2 py-3">00000{book.id}305</td>
                <td className="border border-[#d8dde2] px-2 py-3"></td>
              </tr></tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-red-500">Total holds: 0</p>
        </div>

        <aside className="h-fit border border-[#d8dde2] bg-[#f5f5f5]">
          <div className="border-b border-[#d8dde2] bg-[#e4e4e4] px-4 py-3 font-semibold text-[#1672ae]">☰ Browse results</div>
          <div className="grid grid-cols-3 border-b border-[#d8dde2] text-center text-xs text-[#1672ae]">
            <button type="button" className="border-r border-[#d8dde2] px-2 py-2">« Previous</button>
            <button type="button" onClick={onBack} className="border-r border-[#d8dde2] px-2 py-2">Back to results</button>
            <button type="button" className="px-2 py-2">Next »</button>
          </div>
          <div className="space-y-3 px-4 py-4 text-xs font-semibold text-[#1672ae]">
            <h2 className="text-sm text-[#334e68]">Reserve Item</h2>
            <button type="button" className="flex items-center gap-2 hover:underline"><FiPrinter /> Print</button>
            <button type="button" className="flex items-center gap-2 hover:underline"><FiBookmark /> Save to your lists</button>
            <button type="button" className="flex items-center gap-2 hover:underline"><FiShoppingCart /> Add to your cart</button>
            <button type="button" className="flex items-center gap-2 hover:underline"><FiMail /> Suggest for purchase</button>
            <button type="button" className="flex items-center gap-2 hover:underline"><FiChevronRight /> Unhighlight</button>
            <button type="button" className="flex items-center gap-2 hover:underline"><FiDownload /> Send to device</button>
            <button type="button" className="flex items-center gap-2 hover:underline"><FiDownload /> Save record</button>
            <button type="button" className="flex items-center gap-2 hover:underline"><FiSearch /> More searches</button>
          </div>
        </aside>
      </div>
    </section>
  );
}