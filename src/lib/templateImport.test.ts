import { describe, expect, it } from 'vitest'
import { parseEssayTemplate, parseKnowledgeTemplate, parseRecitationTemplate } from './templateImport'

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

describe('parseKnowledgeTemplate', () => {
  it('turns each heading into a two-section study item', () => {
    const result = parseKnowledgeTemplate(`【数学知识】函数专题

### 函数
【考点精析】
函数描述两个变量之间的对应关系。
定义域内每个 x 都有唯一的 y。
【知识延伸】
研究定义域、值域、单调性和奇偶性。

### 一元二次方程
【考点精析】
一般形式为 ax²+bx+c=0，其中 a≠0。
【知识延伸】
求根公式为 x=(-b±√Δ)/2a。`)

    expect(result.group).toBe('数学知识 · 函数专题')
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ title: '函数', subject: '数学', category: '数学知识 · 函数专题' })
    expect(result.items[0].body.split('\n\n')).toHaveLength(2)
    expect(result.items[1].body).toContain('求根公式')
  })

  it('requires an analysis section and allows extension to be omitted', () => {
    const result = parseKnowledgeTemplate(`【物理知识】力学
### 速度
【知识延伸】
没有考点精析，不应导入。
### 加速度
【考点精析】
速度变化量与时间的比值。`)
    expect(result.items.map((item) => item.title)).toEqual(['加速度'])
    expect(result.items[0].body).toBe('【考点精析】 速度变化量与时间的比值。')
  })
})

describe('parseEssayTemplate', () => {
  it('maps AI-exported fields into category and tags', () => {
    const result = parseEssayTemplate(`【作文素材】DeepSeek 提取
## 坚持的开头
【类型】结构模板
【主题】坚持、成长
【适用位置】开头
真正的坚持，需要在行动中不断积累。
【使用说明】替换题目关键词。
【标签】议论文、开头`)
    expect(result.items[0]).toMatchObject({ category: '作文训练 · 坚持、成长 · 结构模板', body: '真正的坚持，需要在行动中不断积累。\n\n【使用说明】替换题目关键词。' })
    expect(result.items[0].tags).toContain('开头')
  })
})
