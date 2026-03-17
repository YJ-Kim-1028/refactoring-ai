const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/healthz', (_req, res) => {
  res.json({ ok: true })
})

function buildSystemPrompt() {
  return [
    'You are a senior code refactoring assistant.',
    '',
    '## Core goal',
    '- Improve maintainability and clarity while preserving behavior.',
    '- Prefer small, safe steps over large rewrites.',
    '',
    '## Safety & correctness rules (non-negotiable)',
    '- Do NOT change externally observable behavior unless the user explicitly asks.',
    '- Do NOT change public APIs, function signatures, routes, JSON shapes, or DB schemas unless explicitly allowed.',
    '- Do NOT invent dependencies, project structure, file names, or tests that were not provided.',
    '- If information is missing, ask concise clarifying questions (minimum needed).',
    '',
    '## Refactoring style',
    '- Reduce duplication and cyclomatic complexity.',
    '- Increase cohesion: group related logic and name things well.',
    '- Make side effects explicit; isolate I/O from pure logic when possible.',
    '- Prefer standard library / existing dependencies; avoid adding new packages unless asked.',
    '',
    '## Output format (always follow)',
    'Return the answer in the following sections:',
    '1) Summary: 3-6 bullets describing the intent and impact',
    '2) Changes: show updated code (or diff-like blocks) clearly; keep changes minimal',
    '3) Risk & compatibility: what could break, and how you avoided it',
    '4) Test plan: exact commands / steps; include edge cases',
    '',
    '## When user provides code',
    '- First, restate the constraints you inferred (1-3 bullets).',
    '- If multiple approaches exist, propose 2 options briefly, then pick one and implement.',
    '',
    '## Language',
    '- Reply in Korean unless the user writes in another language.',
  ].join('\n')
}

async function callOpenAIChat({ apiKey, model, messages }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t || `OpenAI HTTP ${res.status}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Empty response from model')
  }
  return content
}

app.post('/api/chat', async (req, res) => {
  try {
    const userMessages = Array.isArray(req.body?.messages) ? req.body.messages : []
    const safeMessages = userMessages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }))

    const headerKey = req.header('x-openai-api-key')
    const apiKey = (typeof headerKey === 'string' && headerKey.trim()) ? headerKey.trim() : process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'

    if (!apiKey) {
      const lastUser = [...safeMessages].reverse().find((m) => m.role === 'user')?.content ?? ''
      return res.json({
        message: {
          content:
            '백엔드는 정상 동작 중인데, 아직 OpenAI API Key가 설정되지 않았어요.\n\n' +
            '해결 방법(둘 중 하나):\n' +
            '- 백엔드 `.env`에 `OPENAI_API_KEY=...`\n' +
            '- 또는 프론트에서 본인 키를 입력하면(Bring-your-own-key) 요청 헤더로 전달됩니다.\n\n' +
            '지금 요청(요약):\n' +
            (lastUser ? `- ${lastUser.slice(0, 500)}` : '- (빈 요청)') +
            '\n\n' +
            '설정 후 다시 보내면 실제 모델 응답으로 바뀝니다.',
        },
      })
    }

    const content = await callOpenAIChat({
      apiKey,
      model,
      messages: [{ role: 'system', content: buildSystemPrompt() }, ...safeMessages],
    })

    res.json({ message: { content } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ error: msg })
  }
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`backend listening on http://localhost:${port}`)
})

