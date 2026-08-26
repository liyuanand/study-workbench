export interface ParsedRecitationTemplateItem {
  title: string
  category: string
  subject: string
  body: string
  tags: string[]
}

export interface ParsedRecitationTemplate {
  group: string
  countLabel: string
  items: ParsedRecitationTemplateItem[]
}

/** Parse the teacher's simple Markdown format without requiring a Markdown dependency. */
export function parseRecitationTemplate(markdown: string): ParsedRecitationTemplate {
  let group = '语文模板'
  let countLabel = ''
  let section = '未分类'
  const items: ParsedRecitationTemplateItem[] = []

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('【')) {
      const match = line.match(/^【([^】]+)】\s*(.*?)(?:（\s*(\d+)\s*个\s*）)?$/)
      if (match) {
        group = [match[1], match[2]].filter(Boolean).join(' · ')
        countLabel = match[3] ? `${match[3]} 个` : ''
      }
      continue
    }

    const heading = line.match(/^#{2,6}\s+(.+?)\s*$/)
    if (heading) {
      section = heading[1].replace(/（\s*\d+\s*个\s*）$/, '').trim() || '未分类'
      continue
    }

    const definition = line.match(/^[-*]?\s*(.{1,32}?)[：:]\s*(.+)$/)
    if (!definition || definition[1].includes(' ')) continue
    const title = definition[1].trim().replace(/^\*+|\*+$/g, '')
    const body = definition[2].trim()
    if (['说明', '注', '提示', '示例'].includes(title)) continue
    if (!title || !body || items.some((item) => item.title === title)) continue
    items.push({
      title,
      category: `${group} · ${section}`,
      subject: '语文',
      body,
      tags: [group, section, '成语'],
    })
  }

  return { group, countLabel, items }
}

export function parseKnowledgeTemplate(markdown: string): ParsedRecitationTemplate {
  let groupLabel = '知识点'
  let topic = '未分类'
  let subject = '其他'
  let title = ''
  let section: 'analysis' | 'extension' | null = null
  let analysisLines: string[] = []
  let extensionLines: string[] = []
  const items: ParsedRecitationTemplateItem[] = []

  function flush() {
    const analysis = analysisLines.join(' ').trim()
    const extension = extensionLines.join(' ').trim()
    if (title && analysis && !items.some((item) => item.title === title)) {
      items.push({
        title,
        category: [groupLabel, topic].filter(Boolean).join(' · '),
        subject,
        body: [`【考点精析】 ${analysis}`, extension ? `【知识延伸】 ${extension}` : ''].filter(Boolean).join('\n\n'),
        tags: [groupLabel, topic, '知识点'].filter(Boolean),
      })
    }
    analysisLines = []
    extensionLines = []
    section = null
  }

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || /^-{3,}$/.test(line)) continue

    const heading = line.match(/^#{3,6}\s+(.+?)\s*$/)
    if (heading) {
      flush()
      title = heading[1].trim()
      continue
    }

    if (line === '【考点精析】') { section = 'analysis'; continue }
    if (line === '【知识延伸】') { section = 'extension'; continue }

    const header = line.match(/^【([^】]+)】\s*(.*)$/)
    if (header && !title) {
      groupLabel = header[1].trim() || '知识点'
      topic = header[2].trim() || '未分类'
      subject = groupLabel.replace(/知识|专题|学科/g, '').trim() || '其他'
      continue
    }

    if (section === 'analysis') analysisLines.push(line)
    if (section === 'extension') extensionLines.push(line)
  }
  flush()

  return { group: [groupLabel, topic].filter(Boolean).join(' · '), countLabel: '', items }
}

export function parseEssayTemplate(markdown: string): ParsedRecitationTemplate {
  markdown = normalizeEssayMarkdown(markdown)
  let group = '作文素材'
  let kind = '未分类'
  let title = ''
  let lines: string[] = []
  let fields: Record<string, string> = {}
  const items: ParsedRecitationTemplateItem[] = []
  function flush() {
    const body = lines.join('\n').trim()
    const usage = fields['使用说明'] || ''
    const fullBody = [body, usage ? `【使用说明】${usage}` : ''].filter(Boolean).join('\n\n')
    if (title && fullBody && !items.some((item) => item.title === title)) {
      const theme = fields['主题'] || kind
      const type = fields['类型'] || '作文素材'
      const position = fields['适用位置'] || '作文素材'
      const tags = (fields['标签'] || '').split(/[、,，]/).map((tag) => tag.trim()).filter(Boolean)
      items.push({ title, category: `作文训练 · ${theme} · ${type}`, subject: '语文', body: fullBody, tags: [...new Set([theme, position, type, ...tags, '作文'])] })
    }
    lines = []; fields = {}
  }
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || /^-{3,}$/.test(line) || /^```/.test(line)) continue
    const groupHeader = line.match(/^【作文素材】\s*(.*)$/)
    if (groupHeader && !title) { group = groupHeader[0]; kind = groupHeader[1].trim() || '未分类'; continue }
    const heading = line.match(/^#{2,6}\s*(.+?)\s*$/)
    if (heading) { flush(); title = heading[1].trim(); continue }
    const field = line.match(/^【([^】]+)】\s*(.*)$/)
    if (field && !title) { kind = field[2].trim() || field[1].trim() || kind; continue }
    if (field) {
      const name = field[1].trim()
      const value = field[2].trim()
      if (['正文', '模板正文', '金句', '核心事实', '论证句', '范文片段', '内容'].includes(name)) { if (value) lines.push(value) }
      else fields[name] = value
      continue
    }
    lines.push(line)
  }
  flush()
  return { group, countLabel: '', items }
}

export function normalizeEssayMarkdown(markdown: string): string {
  const cleaned = markdown.replace(/^\uFEFF/, '').replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/, '')
  if (/^#{2,6}\s*\S/m.test(cleaned)) return cleaned
  const rows = cleaned.split(/\r?\n/)
  const headerIndex = rows.findIndex((line) => /^【作文素材】/.test(line.trim()))
  const tail = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0)
  const nonEmpty = tail.map((line) => line.trim()).filter(Boolean)
  if (!nonEmpty.length || nonEmpty.filter((line) => [...line].length <= 2).length / nonEmpty.length < 0.8) return cleaned
  let rebuilt = ''
  for (const rawLine of tail) {
    const line = rawLine.trim()
    if (line) rebuilt += line
    else if (rawLine.length > 0) rebuilt += ' '
    else if (rebuilt && !rebuilt.endsWith('\n')) rebuilt += '\n'
  }
  const header = headerIndex >= 0 ? rows[headerIndex].trim() : '【作文素材】旧版文件修复'
  return `${header}\n\n${rebuilt.trim()}`
}
