import { useEffect, useRef, useState } from 'react'
import {
  FiEdit2, FiMessageCircle, FiMessageSquare, FiPlus, FiSend, FiSettings, FiTrash2, FiX,
} from 'react-icons/fi'
import { translate } from '../../i18n/catalogTranslations'
import {
  askLibraryFaq,
  createChatConversation,
  deleteAllChatConversations,
  deleteChatConversation,
  getChatConversation,
  getChatHistoryPreference,
  requestBookSummary,
  listChatConversations,
  renameChatConversation,
  saveChatConversationMessage,
  setChatHistoryPreference,
} from '../../services/catalogService'
import { detectCitationStyle, findBookForCitation, formatBookCitation, isCitationRequest } from '../../utils/bookCitation'
import { findBookForSummary, findReadableBookResource, isBookSummaryRequest } from '../../utils/bookSummary'

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

function renderCitationText(citation) {
  const segments = [
    { value: citation.title, type: 'title' },
    ...(citation.url ? [{ value: citation.url, type: 'url' }] : []),
  ]
    .map((segment) => ({ ...segment, index: citation.text.indexOf(segment.value) }))
    .filter((segment) => segment.index >= 0)
    .sort((left, right) => left.index - right.index)
  if (segments.length === 0) return citation.text

  const output = []
  let cursor = 0
  for (const [index, segment] of segments.entries()) {
    output.push(citation.text.slice(cursor, segment.index))
    output.push(segment.type === 'title'
      ? <cite key={`title-${index}`} className="italic">{segment.value}</cite>
      : <a key={`url-${index}`} href={segment.value} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">{segment.value}</a>)
    cursor = segment.index + segment.value.length
  }
  output.push(citation.text.slice(cursor))
  return output
}

function formatConversationDate(value, language) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatMessageTime(value, language) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit' }).format(date)
}

export default function ChatbotPlaceholder({ language, currentBook, currentResourceId, books = [], user }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [error, setError] = useState('')
  const [failedQuestion, setFailedQuestion] = useState('')
  const [pendingCitation, setPendingCitation] = useState(null)
  const [pendingSummary, setPendingSummary] = useState(false)
  const [conversations, setConversations] = useState([])
  const [conversationId, setConversationId] = useState('')
  const [conversationTitleOverride, setConversationTitleOverride] = useState('')
  const [saveHistory, setSaveHistory] = useState(false)
  const [historyReady, setHistoryReady] = useState(!user?.id)
  const [historyError, setHistoryError] = useState('')
  const [isHistoryBusy, setIsHistoryBusy] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const conversationIdRef = useRef('')
  const saveHistoryRef = useRef(false)
  const messageEndRef = useRef(null)
  const userId = user?.id
  const t = (key) => translate(language, key)
  const activeConversation = conversations.find((conversation) => conversation.id === conversationId)
  const activeConversationTitle = activeConversation?.title
    || conversationTitleOverride
    || messages.find((message) => message.role === 'user')?.content?.trim().slice(0, 120)
    || t('chatbotNewConversation')
  const suggestionKeys = [
    'chatbotSuggestionBorrowDays',
    'chatbotSuggestionRenewOnline',
    'chatbotSuggestionHomeAccess',
    ...(currentBook ? ['chatbotSuggestionCitation'] : []),
  ]

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    let isCurrent = true
    conversationIdRef.current = ''
    saveHistoryRef.current = false
    setConversationId('')
    setConversationTitleOverride('')
    setMessages([])
    setConversations([])
    setSaveHistory(false)
    setHistoryError('')
    setPendingCitation(null)
    setPendingSummary(false)
    setIsHistoryOpen(false)
    setIsSettingsOpen(false)

    if (!userId) {
      setHistoryReady(true)
      return () => { isCurrent = false }
    }

    setHistoryReady(false)
    Promise.all([getChatHistoryPreference(), listChatConversations()])
      .then(async ([preference, savedConversations]) => {
        const latest = savedConversations[0]
        const latestConversation = latest ? await getChatConversation(latest.id) : null
        if (!isCurrent) return
        saveHistoryRef.current = preference.saveHistory
        setSaveHistory(preference.saveHistory)
        setConversations(savedConversations)
        if (latestConversation) {
          conversationIdRef.current = latest.id
          setConversationId(latest.id)
          setMessages(latestConversation.messages)
        }
      })
      .catch(() => {
        if (!isCurrent) return
        setHistoryError(t('chatbotHistoryError'))
      })
      .finally(() => {
        if (isCurrent) setHistoryReady(true)
      })

    return () => { isCurrent = false }
  }, [userId])

  const persistMessage = async (message, title) => {
    if (!userId || !historyReady || !saveHistoryRef.current) return
    try {
      let activeId = conversationIdRef.current
      if (!activeId) {
        const created = await createChatConversation(String(conversationTitleOverride || title || message.content).slice(0, 120))
        activeId = created.id
        conversationIdRef.current = activeId
        setConversationId(activeId)
        setConversations((current) => [created, ...current.filter((item) => item.id !== activeId)])
      }
      await saveChatConversationMessage(activeId, {
        role: message.role,
        content: message.content,
        ...(message.citation ? { citation: message.citation } : {}),
        ...(message.matchedKnowledge ? { matchedKnowledge: message.matchedKnowledge } : {}),
      })
      const updatedAt = new Date().toISOString()
      setConversations((current) => current
        .map((item) => item.id === activeId ? { ...item, updatedAt } : item)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)))
      setHistoryError('')
    } catch {
      setHistoryError(t('chatbotHistoryError'))
    }
  }

  const validateConversationTitle = (title) => {
    const normalizedTitle = title.trim()
    if (!normalizedTitle || normalizedTitle.length > 120) {
      setHistoryError(t('chatbotRenameTitleInvalid'))
      return null
    }
    return normalizedTitle
  }

  const saveConversationTitle = async (conversation, title) => {
    setIsHistoryBusy(true)
    setHistoryError('')
    try {
      const updated = await renameChatConversation(conversation.id, title)
      setConversations((current) => current
        .map((item) => item.id === conversation.id ? { ...item, ...updated } : item)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)))
    } catch {
      setHistoryError(t('chatbotHistoryError'))
    } finally {
      setIsHistoryBusy(false)
    }
  }

  const renameSavedConversation = async (conversation) => {
    const title = window.prompt(t('chatbotRenamePrompt'), conversation.title)
    if (title === null) return
    const normalizedTitle = validateConversationTitle(title)
    if (!normalizedTitle || normalizedTitle === conversation.title) return
    await saveConversationTitle(conversation, normalizedTitle)
  }

  const renameCurrentConversation = async () => {
    const title = window.prompt(t('chatbotRenamePrompt'), activeConversationTitle)
    if (title === null) return
    const normalizedTitle = validateConversationTitle(title)
    if (!normalizedTitle || normalizedTitle === activeConversationTitle) return
    if (activeConversation) {
      await saveConversationTitle(activeConversation, normalizedTitle)
      return
    }
    setHistoryError('')
    setConversationTitleOverride(normalizedTitle)
  }

  const sendQuestion = async (question, isRetry = false) => {
    if (isLoading || isHistoryBusy || (userId && !historyReady)) return
    const shouldSummarize = pendingSummary || isBookSummaryRequest(question)
    const isCitationFollowup = !isRetry && pendingCitation && !shouldSummarize
    const isCitationQuestion = !isRetry && !shouldSummarize && isCitationRequest(question)
    if (isCitationFollowup || isCitationQuestion) {
      setIsLoading(true)
      setError('')
      setInput('')
      try {
        const userMessage = { role: 'user', content: question, createdAt: new Date().toISOString() }
        setMessages((current) => [...current, userMessage])
        await persistMessage(userMessage, question)

        const style = pendingCitation?.style || detectCitationStyle(question)
        const book = pendingCitation?.book || findBookForCitation(question, currentBook, books)
        let assistantMessage
        if (!book) {
          setPendingCitation({ book: null, style })
          assistantMessage = { role: 'assistant', content: t('chatbotCitationBook') }
        } else if (!style) {
          setPendingCitation({ book, style: null })
          assistantMessage = { role: 'assistant', content: t('chatbotCitationFormats') }
        } else {
          const citation = formatBookCitation(book, style)
          setPendingCitation(null)
          assistantMessage = {
            role: 'assistant',
            content: citation.text,
            citation,
          }
        }
        assistantMessage.createdAt = new Date().toISOString()
        setMessages((current) => [...current, assistantMessage])
        await persistMessage(assistantMessage, question)
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (shouldSummarize) {
      setError('')
      setIsLoading(true)
      setIsSummarizing(true)
      setPendingCitation(null)
      if (!isRetry) {
        setInput('')
        const userMessage = { role: 'user', content: question, createdAt: new Date().toISOString() }
        setMessages((current) => [...current, userMessage])
        await persistMessage(userMessage, question)
      }

      try {
        let content
        if (!userId) {
          setPendingSummary(false)
          content = t('chatbotSummarySignIn')
        } else {
          const book = findBookForSummary(question, currentBook, books)
          if (!book) {
            setPendingSummary(true)
            content = t('chatbotSummaryBook')
          } else {
            const resource = findReadableBookResource(book, String(currentBook?.id) === String(book.id) ? currentResourceId : null)
            setPendingSummary(false)
            if (!resource) {
              content = t('chatbotSummaryUnavailable')
            } else {
              const summary = await requestBookSummary(book.id, resource.id)
              const verification = summary.status === 'approved'
                ? t('chatbotSummaryVerified')
                : t('chatbotSummaryPending')
              content = `${verification}\n\n${summary.summary}`
            }
          }
        }
        const assistantMessage = { role: 'assistant', content, createdAt: new Date().toISOString() }
        setMessages((current) => [...current, assistantMessage])
        await persistMessage(assistantMessage, question)
        setFailedQuestion('')
      } catch (requestError) {
        setError(requestError.message || t('chatbotError'))
        setFailedQuestion(question)
      } finally {
        setIsSummarizing(false)
        setIsLoading(false)
      }
      return
    }

    const conversation = isRetry && messages.at(-1)?.role === 'user'
      ? messages.slice(0, -1)
      : messages

    setError('')
    setIsLoading(true)
    if (!isRetry) {
      setInput('')
      const userMessage = { role: 'user', content: question, createdAt: new Date().toISOString() }
      setMessages((current) => [...current, userMessage])
      await persistMessage(userMessage, question)
    }

    try {
      const result = await askLibraryFaq(
        question,
        conversation.slice(-8).map(({ role, content }) => ({ role, content })),
        language,
      )
      const assistantMessage = {
        role: 'assistant',
        content: result.answer,
        matchedKnowledge: result.matchedKnowledge,
        createdAt: new Date().toISOString(),
      }
      setMessages((current) => [...current, assistantMessage])
      await persistMessage(assistantMessage, question)
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

  const startNewConversation = () => {
    conversationIdRef.current = ''
    setConversationId('')
    setConversationTitleOverride('')
    setMessages([])
    setPendingCitation(null)
    setPendingSummary(false)
    setError('')
    setFailedQuestion('')
    setIsHistoryOpen(false)
    setIsSettingsOpen(false)
  }

  const openConversation = async (id) => {
    if (!id) return
    setIsHistoryBusy(true)
    setHistoryError('')
    try {
      const conversation = await getChatConversation(id)
      conversationIdRef.current = id
      setConversationId(id)
      setConversationTitleOverride('')
      setMessages(conversation.messages)
      setPendingCitation(null)
      setPendingSummary(false)
      setError('')
      setFailedQuestion('')
      setIsHistoryOpen(false)
      setIsSettingsOpen(false)
    } catch {
      setHistoryError(t('chatbotHistoryError'))
    } finally {
      setIsHistoryBusy(false)
    }
  }

  const toggleSaveHistory = async () => {
    const enabled = !saveHistory
    setIsHistoryBusy(true)
    setHistoryError('')
    try {
      const preference = await setChatHistoryPreference(enabled)
      saveHistoryRef.current = preference.saveHistory
      setSaveHistory(preference.saveHistory)
    } catch {
      saveHistoryRef.current = false
      setSaveHistory(false)
      setHistoryError(t('chatbotHistoryError'))
    } finally {
      setIsHistoryBusy(false)
    }
  }

  const removeConversation = async (id = conversationId) => {
    if (!id || !window.confirm(t('chatbotDeleteConfirm'))) return
    setIsHistoryBusy(true)
    setHistoryError('')
    try {
      await deleteChatConversation(id)
      setConversations((current) => current.filter((item) => item.id !== id))
      if (id === conversationId) {
        conversationIdRef.current = ''
        setConversationId('')
        setConversationTitleOverride('')
        setMessages([])
        setPendingCitation(null)
        setPendingSummary(false)
        setError('')
        setFailedQuestion('')
      }
    } catch {
      setHistoryError(t('chatbotHistoryError'))
    } finally {
      setIsHistoryBusy(false)
    }
  }

  const removeAllConversations = async () => {
    if (!window.confirm(t('chatbotDeleteAllConfirm'))) return
    setIsHistoryBusy(true)
    setHistoryError('')
    try {
      await deleteAllChatConversations()
      setConversations([])
      startNewConversation()
    } catch {
      setHistoryError(t('chatbotHistoryError'))
    } finally {
      setIsHistoryBusy(false)
    }
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

          <div className="flex min-h-0 flex-1">
            <aside
              className="flex w-11 shrink-0 flex-col items-center gap-2 border-r border-[var(--apc-border)] py-2"
              aria-label={t('chatbotControls')}
            >
              <button
                type="button"
                onClick={startNewConversation}
                disabled={isLoading || isHistoryBusy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#003A70] hover:bg-[var(--apc-blue-light)] disabled:opacity-50"
                aria-label={t('chatbotNewConversation')}
                title={t('chatbotNewConversation')}
              >
                <FiPlus aria-hidden="true" />
              </button>
              {userId && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false)
                      setIsHistoryOpen((open) => !open)
                    }}
                    disabled={!historyReady || isLoading || isHistoryBusy}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#003A70] hover:bg-[var(--apc-blue-light)] disabled:opacity-50"
                    aria-label={t('chatbotConversationSelector')}
                    aria-pressed={isHistoryOpen}
                    title={t('chatbotConversationSelector')}
                  >
                    <FiMessageSquare aria-hidden="true" />
                  </button>
                  {conversationId && (
                    <button
                      type="button"
                      onClick={() => removeConversation()}
                      disabled={isHistoryBusy || isLoading}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 disabled:opacity-50"
                      aria-label={t('chatbotDeleteConversation')}
                      title={t('chatbotDeleteConversation')}
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  )}
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsHistoryOpen(false)
                      setIsSettingsOpen((open) => !open)
                    }}
                    disabled={!historyReady || isHistoryBusy || isLoading}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50 ${
                      isSettingsOpen ? 'bg-[var(--apc-blue-light)] text-[#003A70]' : 'text-[#003A70] hover:bg-[var(--apc-blue-light)]'
                    }`}
                    aria-label={t('chatbotSettings')}
                    aria-pressed={isSettingsOpen}
                    title={t('chatbotSettings')}
                  >
                    <FiSettings aria-hidden="true" />
                  </button>
                </>
              )}
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
                <div className="flex min-h-full flex-col gap-3">
                  {isSettingsOpen && userId ? (
                    <section className="space-y-4 rounded-xl bg-[var(--apc-blue-light)] p-4" aria-label={t('chatbotSettings')}>
                      <h3 className="font-semibold text-[#172B4D]">{t('chatbotSettings')}</h3>
                      <label className="flex items-center gap-3 text-sm font-semibold text-[#172B4D]">
                        <input
                          type="checkbox"
                          checked={!saveHistory}
                          onChange={toggleSaveHistory}
                          disabled={!historyReady || isHistoryBusy || isLoading}
                          className="accent-[#003A70]"
                        />
                        {t('chatbotDontSave')}
                      </label>
                      <p className="text-xs leading-5 text-[var(--apc-muted)]">
                        {t(saveHistory ? 'chatbotSavedNotice' : 'chatbotPrivateNotice')}
                      </p>
                      {historyError && <p role="alert" className="text-xs text-red-700">{historyError}</p>}
                    </section>
                  ) : isHistoryOpen && userId ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-[#172B4D]">{t('chatbotConversationSelector')}</h3>
                        {conversations.length > 0 && (
                          <button
                            type="button"
                            onClick={removeAllConversations}
                            disabled={isHistoryBusy || isLoading}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            aria-label={t('chatbotDeleteAll')}
                            title={t('chatbotDeleteAll')}
                          >
                            <FiTrash2 aria-hidden="true" />
                            {t('chatbotDeleteAll')}
                          </button>
                        )}
                      </div>
                      {historyError && <p role="alert" className="text-xs text-red-700">{historyError}</p>}
                      {conversations.length === 0 ? (
                        <p className="text-sm text-[var(--apc-muted)]">{t('chatbotNoConversations')}</p>
                      ) : (
                        conversations.map((conversation) => (
                          <div key={conversation.id} className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openConversation(conversation.id)}
                              disabled={isHistoryBusy || isLoading}
                              className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--apc-blue-light)] disabled:opacity-50 ${
                                conversation.id === conversationId ? 'bg-[var(--apc-blue-light)] font-semibold text-[#003A70]' : 'text-[#172B4D]'
                              }`}
                            >
                              <span className="block truncate">{conversation.title}</span>
                              <time
                                dateTime={conversation.updatedAt || conversation.createdAt}
                                className="block truncate text-xs font-normal text-[var(--apc-muted)]"
                              >
                                {t('chatbotLastUpdated')}{' '}
                                {formatConversationDate(conversation.updatedAt || conversation.createdAt, language)}
                              </time>
                            </button>
                            <button
                              type="button"
                              onClick={() => renameSavedConversation(conversation)}
                              disabled={isHistoryBusy || isLoading}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#003A70] hover:bg-[var(--apc-blue-light)] disabled:opacity-50"
                              aria-label={`${t('chatbotRenameConversation')}: ${conversation.title}`}
                              title={t('chatbotRenameConversation')}
                            >
                              <FiEdit2 aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeConversation(conversation.id)}
                              disabled={isHistoryBusy || isLoading}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 disabled:opacity-50"
                              aria-label={`${t('chatbotDeleteConversation')}: ${conversation.title}`}
                              title={t('chatbotDeleteConversation')}
                            >
                              <FiTrash2 aria-hidden="true" />
                            </button>
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <h3 className="min-w-0 flex-1 break-words text-sm font-semibold text-[#172B4D]">
                          {activeConversationTitle}
                        </h3>
                        <button
                          type="button"
                          onClick={renameCurrentConversation}
                          disabled={isHistoryBusy || isLoading || (!!userId && !historyReady)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#003A70] hover:bg-[var(--apc-blue-light)] disabled:opacity-50"
                          aria-label={`${t('chatbotRenameConversation')}: ${activeConversationTitle}`}
                          title={t('chatbotRenameConversation')}
                        >
                          <FiEdit2 aria-hidden="true" />
                        </button>
                      </div>
                      {userId ? (
                        <p className="text-[0.68rem] leading-4 text-[var(--apc-muted)]">
                          {t(saveHistory ? 'chatbotSavedNotice' : 'chatbotPrivateNotice')}
                        </p>
                      ) : (
                        <p className="text-xs leading-5 text-[var(--apc-muted)]">{t('chatbotSignedOutNotice')}</p>
                      )}
                      {!historyReady && userId && (
                        <p className="text-xs text-[var(--apc-muted)]">{t('chatbotHistoryLoading')}</p>
                      )}
                      {historyError && <p role="alert" className="text-xs text-red-700">{historyError}</p>}
                      {messages.length === 0 && (
                        <p className="rounded-xl bg-[var(--apc-blue-light)] p-3 text-sm leading-6 text-[var(--apc-muted)]">
                          {t('chatbotWelcome')}
                        </p>
                      )}
                      {messages.map((message, index) => {
                        const messageTime = formatMessageTime(message.createdAt, language)
                        return (
                          <div
                            key={`${message.role}-${index}`}
                            className={`max-w-[90%] rounded-xl p-3 text-sm leading-6 ${
                              message.role === 'user'
                                ? 'ml-auto bg-[#003A70] text-white'
                                : 'bg-[var(--apc-blue-light)] text-[#172B4D]'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">
                              {message.citation ? (
                                <>
                                  <strong>{message.citation.style}</strong>
                                  <br />
                                  {renderCitationText(message.citation)}
                                  {message.citation.missingFields.length > 0 && (
                                    <span className="mt-2 block text-xs">{t('chatbotCitationVerify')}</span>
                                  )}
                                </>
                              ) : message.content}
                            </p>
                            {message.matchedKnowledge?.length > 0 && (
                              <div className="mt-2 border-t border-current/15 pt-2 text-xs">
                                {message.matchedKnowledge?.map((entry) => (
                                  <p key={entry.id} className="mb-1">
                                    {entry.title}
                                    {entry.sourceUrl && (
                                      <> · <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">{t('chatbotSource')}</a></>
                                    )}
                                  </p>
                                ))}
                              </div>
                            )}
                            {messageTime && (
                              <time
                                dateTime={message.createdAt}
                                className={`mt-1 block text-right text-[0.65rem] leading-4 ${
                                  message.role === 'user' ? 'text-white/70' : 'text-[var(--apc-muted)]'
                                }`}
                              >
                                {messageTime}
                              </time>
                            )}
                          </div>
                        )
                      })}
                      {isLoading && (
                        <p className="w-fit rounded-xl bg-[var(--apc-blue-light)] p-3 text-sm text-[var(--apc-muted)]">
                          {t(isSummarizing ? 'chatbotSummaryGenerating' : 'chatbotThinking')}
                        </p>
                      )}
                      {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                          <p>{error}</p>
                          <button
                            type="button"
                            onClick={() => sendQuestion(failedQuestion, true)}
                            className="mt-2 font-semibold underline underline-offset-2"
                            disabled={isLoading || isHistoryBusy || (!!userId && !historyReady)}
                          >
                            {t('chatbotRetry')}
                          </button>
                        </div>
                      )}
                      <div ref={messageEndRef} />
                      {messages.length === 0 && (
                        <div className="mt-auto flex flex-col items-end gap-2 pt-6" role="group" aria-label={t('chatbotSuggestions')}>
                          {suggestionKeys.map((key) => {
                            const question = t(key)
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => sendQuestion(question)}
                                disabled={isLoading || isHistoryBusy || (!!userId && !historyReady)}
                                className="flex max-w-[95%] items-center gap-3 rounded-full bg-[#1F5489] px-4 py-2.5 text-left text-sm leading-5 text-white shadow-sm transition-colors hover:bg-[#174675] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <span>{question}</span>
                                <FiSend className="h-4 w-4 shrink-0 text-[#58A6FF]" aria-hidden="true" />
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
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
                  disabled={isLoading || isHistoryBusy || (!!userId && !historyReady)}
                />
                <button
                  type="submit"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#003A70] text-white hover:bg-[#004B87] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t('chatbotSend')}
                  title={t('chatbotSend')}
                  disabled={isLoading || isHistoryBusy || (!!userId && !historyReady) || !input.trim()}
                >
                  <FiSend aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
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
