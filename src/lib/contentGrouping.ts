import type { ContentItem } from '../types'

const groupTagPattern = /第[一二三四五六七八九十百千两〇零\d]+组/u

export function getContentGroupLabel(item: Pick<ContentItem, 'tags'>) {
  const templateTag = item.tags.find((tag) => groupTagPattern.test(tag))
  if (templateTag) {
    const topic = templateTag.replace(/^第[一二三四五六七八九十百千两〇零\d]+组\s*[·.:：-]?\s*/u, '').trim()
    return topic ? `语文模板 · ${topic}` : '语文模板'
  }
  return item.tags[0] || '未分类'
}
