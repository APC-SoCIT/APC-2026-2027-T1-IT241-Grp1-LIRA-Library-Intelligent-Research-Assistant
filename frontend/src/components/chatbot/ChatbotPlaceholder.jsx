import { useState } from 'react'
import { FiMessageCircle, FiX } from 'react-icons/fi'
import { translate } from '../../i18n/catalogTranslations'

export default function ChatbotPlaceholder({ language }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen && (
        <section
          className="mb-3 w-[min(20rem,calc(100vw-2.5rem))] rounded-2xl border border-[#e8dcc8] bg-[#fffdf8] p-5 shadow-[0_18px_50px_rgba(36,31,24,0.2)]"
          aria-labelledby="chatbot-placeholder-title"
          role="status"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.15em] text-[#9a784a]">LIRA</p>
              <h2 id="chatbot-placeholder-title" className="mt-1 font-semibold text-[#342c24]">
                {translate(language, 'chatbotTitle')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-[#796b58] hover:bg-[#f4ead9]"
              aria-label={translate(language, 'chatbotClose')}
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#6e6252]">
            {translate(language, 'chatbotComingSoon')}
          </p>
        </section>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#73532f] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#5b4126]"
        aria-label={isOpen ? translate(language, 'chatbotClose') : translate(language, 'chatbotOpen')}
        aria-expanded={isOpen}
      >
        {isOpen ? <FiX className="h-6 w-6" aria-hidden="true" /> : <FiMessageCircle className="h-6 w-6" aria-hidden="true" />}
      </button>
    </div>
  )
}
