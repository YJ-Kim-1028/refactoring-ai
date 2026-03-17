import { useEffect, useMemo, useState } from 'react'

function App() {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([{ role: 'assistant', content: '코드 리팩토링 도와줄게요. 코드를 붙여넣어 주세요.' }])
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('openai_api_key') || ''
    if (saved) setApiKey(saved)
  }, [])

  const canSend = input.trim().length > 0 && !isSending
  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'assistant') return messages[i]!
    }
    return null
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || isSending) return

    setInput('')
    setIsSending(true)
    setMessages((prev) => [...prev, { role: 'user', content: text }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey.trim() ? { 'x-openai-api-key': apiKey.trim() } : {}),
        },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: text }],
        }),
      })

      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `HTTP ${res.status}`)
      }

      const data = (await res.json()) as { message: { content: string } }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message.content },
      ])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `에러: ${msg}` },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col p-4">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Refactoring Chatbot</h1>
          <p className="text-sm text-slate-300">
            코드를 붙여넣고 “리팩토링해줘”라고 요청해보세요.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={apiKey}
              onChange={(e) => {
                const v = e.target.value
                setApiKey(v)
                localStorage.setItem('openai_api_key', v)
              }}
              type={showKey ? 'text' : 'password'}
              placeholder="(선택) OpenAI API Key (sk-...)"
              className="w-80 max-w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900"
            >
              {showKey ? '숨기기' : '보기'}
            </button>
            <button
              type="button"
              onClick={() => {
                setApiKey('')
                localStorage.removeItem('openai_api_key')
              }}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900"
            >
              키 지우기
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          {isSending ? '응답 생성 중…' : lastAssistant ? '대기 중' : ''}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={
              m.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-2xl bg-indigo-600 px-4 py-2 text-sm text-white'
                : 'mr-auto max-w-[85%] rounded-2xl bg-slate-900 px-4 py-2 text-sm text-slate-100'
            }
          >
            <pre className="whitespace-pre-wrap font-sans leading-relaxed">
              {m.content}
            </pre>
          </div>
        ))}
      </main>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="여기에 코드를 붙여넣고 요청을 입력하세요…"
          rows={3}
          className="flex-1 resize-none rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="h-fit rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          보내기
        </button>
      </form>
    </div>
  )
}

export default App
