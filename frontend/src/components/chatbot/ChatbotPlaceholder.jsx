import { useEffect, useRef, useState } from 'react'
import { FiMessageCircle, FiSend, FiX } from 'react-icons/fi'
import { translate } from '../../i18n/catalogTranslations'
import { askLibraryFaq } from '../../services/catalogService'

function RamseyRamIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden="true">
      <path d="M15 21c-6 0-9-4-7-8 2-4 7-3 7 0 0 2-2 3-4 2M33 21c6 0 9-4 7-8-2-4-7-3-7 0 0 2 2 3 4 2" fill="none" stroke="#D99A00" strokeLinecap="round" strokeWidth="2.5" />
      <path d="m14 24-7-2 5 8m22-6 7-2-5 8" fill="#F5C9C9" stroke="#003A70" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M13 23c-2-4 1-8 5-9 1-4 6-5 9-2 4-2 8 1 8 5 4 2 4 7 1 10 1 5-3 8-7 8H19c-5 0-8-4-7-8-2-1-2-3 1-4Z" fill="#FFFDF8" stroke="#003A70" strokeLinejoin="round" strokeWidth="1.5" />
      <ellipse cx="24" cy="26" rx="8" ry="9" fill="#F3D6B8" />
      <circle cx="21" cy="25" r="1" fill="#172B4D" />
      <circle cx="27" cy="25" r="1" fill="#172B4D" />
      <path d="m22 29 2 1 2-1m-4 3q2 2 4 0" fill="none" stroke="#8B5E4A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
    </svg>
  )
}

export default function ChatbotPlaceholder({ language }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [failedQuestion, setFailedQuestion] = useState('')
  const messageEndRef = useRef(null)
  const t = (key) => translate(language, key)

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const sendQuestion = async (question, isRetry = false) => {
    if (isLoading) return
    const conversation = isRetry && messages.at(-1)?.role === 'user'
      ? messages.slice(0, -1)
      : messages

    setError('')
    setIsLoading(true)
    if (!isRetry) {
      setInput('')
      setMessages((current) => [...current, { role: 'user', content: question }])
    }

    try {
      const result = await askLibraryFaq(
        question,
        conversation.slice(-8).map(({ role, content }) => ({ role, content })),
        language,
      )
      setMessages((current) => [...current, {
        role: 'assistant',
        content: result.answer,
        sourceUrl: result.sourceUrl,
        matchedFaqs: result.matchedFaqs,
      }])
      setFailedQuestion('')
    } catch (requestError) {
      setError(requestError.message || t('chatbotError'))
      setFailedQuestion(question)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const question = input.trim()
    if (question) sendQuestion(question)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen && (
        <section
          id="chatbot-panel"
          className="mb-3 flex h-[min(34rem,calc(100dvh-7rem))] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--apc-border)] bg-[var(--apc-surface)] shadow-[0_18px_50px_rgba(36,31,24,0.2)]"
          aria-labelledby="chatbot-title"
          role="dialog"
        >
          <header className="flex items-center justify-between gap-4 border-b border-[var(--apc-border)] p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF3FF] text-[#003A70]">
                <RamseyRamIcon />
              </div>
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[var(--apc-navy)]">APC LIBRARY</p>
                <h2 id="chatbot-title" className="font-semibold leading-5 text-[#172B4D]">
                  {t('chatbotTitle')}
                </h2>
                <p className="text-xs text-[var(--apc-muted)]">{t('chatbotSubtitle')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-[var(--apc-muted)] hover:bg-[var(--apc-blue-light)]"
              aria-label={t('chatbotClose')}
            >
              <FiX aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
            <div className="flex min-h-full flex-col gap-3">
              {messages.length === 0 && (
                <p className="rounded-xl bg-[var(--apc-blue-light)] p-3 text-sm leading-6 text-[var(--apc-muted)]">
                  {t('chatbotWelcome')}
                </p>
              )}
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`max-w-[90%] rounded-xl p-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'ml-auto bg-[#003A70] text-white'
                      : 'bg-[var(--apc-blue-light)] text-[#172B4D]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.sourceUrl && (
                    <div className="mt-2 border-t border-current/15 pt-2 text-xs">
                      {message.matchedFaqs?.map((faq) => (
                        <p key={faq.id} className="mb-1">{faq.question}</p>
                      ))}
                      <a
                        href={message.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline underline-offset-2"
                      >
                        {t('chatbotSource')}
                      </a>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <p className="w-fit rounded-xl bg-[var(--apc-blue-light)] p-3 text-sm text-[var(--apc-muted)]">
                  {t('chatbotThinking')}
                </p>
              )}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => sendQuestion(failedQuestion, true)}
                    className="mt-2 font-semibold underline underline-offset-2"
                    disabled={isLoading}
                  >
                    {t('chatbotRetry')}
                  </button>
                </div>
              )}
              <div ref={messageEndRef} />
              {messages.length === 0 && (
                <div className="mt-auto flex flex-col items-end gap-2 pt-6" role="group" aria-label={t('chatbotSuggestions')}>
                  {['chatbotSuggestionBorrowDays', 'chatbotSuggestionRenewOnline', 'chatbotSuggestionHomeAccess'].map((key) => {
                    const question = t(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => sendQuestion(question)}
                        disabled={isLoading}
                        className="flex max-w-[95%] items-center gap-3 rounded-full bg-[#1F5489] px-4 py-2.5 text-left text-sm leading-5 text-white shadow-sm transition-colors hover:bg-[#174675] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span>{question}</span>
                        <FiSend className="h-4 w-4 shrink-0 text-[#58A6FF]" aria-hidden="true" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-[var(--apc-border)] p-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t('chatbotInputPlaceholder')}
              aria-label={t('chatbotInputPlaceholder')}
              maxLength={1200}
              rows={2}
              className="min-w-0 flex-1 resize-none rounded-xl border border-[var(--apc-border)] bg-white p-2 text-sm text-[#172B4D] outline-none focus:border-[#003A70]"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#003A70] text-white hover:bg-[#004B87] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t('chatbotSend')}
              title={t('chatbotSend')}
              disabled={isLoading || !input.trim()}
            >
              <FiSend aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#003A70] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#004B87]"
        aria-label={isOpen ? t('chatbotClose') : t('chatbotOpen')}
        aria-expanded={isOpen}
        aria-controls="chatbot-panel"
      >
        {isOpen ? <FiX className="h-6 w-6" aria-hidden="true" /> : <FiMessageCircle className="h-6 w-6" aria-hidden="true" />}
      </button>
    </div>
  )
}
