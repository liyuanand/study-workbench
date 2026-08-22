import { describe, expect, it } from 'vitest'
import { parseRecitationTemplate } from './templateImport'

describe('parseRecitationTemplate', () => {
  it('parses group, sections and idiom definitions', () => {
    const result = parseRecitationTemplate(`【第二组】文化传承（10 个）

#### 传承不间断

一脉相承：由一个血统或一个派别世代相传承袭下来。
薪火相传: 比喻学问和技艺代代相传。

#### 传承方式
继往开来：继承前人的事业，开辟未来的道路。`)

    expect(result.group).toBe('第二组 · 文化传承')
    expect(result.countLabel).toBe('10 个')
    expect(result.items).toHaveLength(3)
    expect(result.items[0]).toMatchObject({ title: '一脉相承', subject: '语文', category: '第二组 · 文化传承 · 传承不间断' })
    expect(result.items[2].tags).toContain('传承方式')
  })

  it('ignores markdown prose and duplicate terms', () => {
    const result = parseRecitationTemplate('说明：下面开始\n\n- 一脉相承：释义\n一脉相承：重复')
    expect(result.items.map((item) => item.title)).toEqual(['一脉相承'])
  })
})
