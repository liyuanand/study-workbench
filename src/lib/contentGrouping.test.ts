import { describe, expect, it } from 'vitest'
import { getContentGroupLabel } from './contentGrouping'

describe('content grouping labels', () => {
  it('uses the Chinese template topic instead of the numbered group', () => {
    expect(getContentGroupLabel({ tags: ['第一组 · 文化传承', '传承方式', '成语'] })).toBe('语文模板 · 文化传承')
    expect(getContentGroupLabel({ tags: ['第二组 · 文化传承', '传承不间断', '成语'] })).toBe('语文模板 · 文化传承')
  })

  it('keeps ordinary tags and untagged items usable', () => {
    expect(getContentGroupLabel({ tags: ['数学知识', '函数专题'] })).toBe('数学知识')
    expect(getContentGroupLabel({ tags: [] })).toBe('未分类')
  })
})
