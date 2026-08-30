import type { ContentItem } from '../types'

const groupTagPattern = /第[一二三四五六七八九十百千两〇零\d]+组/u

export function getContentGroupLabel(item: Pick<ContentItem, 'tags'>) {
  return item.tags.find((tag) => groupTagPattern.test(tag)) || item.tags[0] || '未分类'
}
