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
