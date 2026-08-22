import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, BookOpenText, Camera, FileQuestion, FileUp, Plus, Search } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog, EmptyState, Field, Modal } from '../components/ui'
import { db } from '../db'
import { addContent, addRecitationTemplateItems, saveMedia } from '../services'
import { parseRecitationTemplate, type ParsedRecitationTemplate } from '../lib/templateImport'
import type { ContentItem, ContentType } from '../types'

export function LibraryPage({ notify }: { notify: (message: string) => void }) {
  const [tab, setTab] = useState<ContentType>('recitation')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<ContentType | null>(null)
  const [importing, setImporting] = useState(false)
  const [archiveItem, setArchiveItem] = useState<ContentItem | null>(null)
  const items = useLiveQuery(() => db.contents.filter((item) => !item.archived).reverse().sortBy('createdAt')) ?? []
  const filtered = useMemo(() => items.filter((item) => item.type === tab && [item.title, item.subject, item.category, ...item.tags].join(' ').toLowerCase().includes(query.trim().toLowerCase())), [items, query, tab])

  async function archive() {
    if (!archiveItem) return
    await db.contents.update(archiveItem.id, { archived: true, updatedAt: new Date().toISOString() })
    notify('已归档，可通过备份保留历史记录')
  }

  return (
    <div className="page library-page">
      <header className="page-header">
        <div><span className="eyebrow">知识资产</span><h1>资料库</h1></div>
        <div className="header-actions">
          {tab === 'recitation' && <button type="button" className="icon-button" onClick={() => setImporting(true)} aria-label="导入成语模板"><FileUp size={21} /></button>}
          <button type="button" className="icon-button solid" onClick={() => setAdding(tab)} aria-label={`添加${tab === 'recitation' ? '背诵' : '错题'}`}><Plus size={22} /></button>
        </div>
      </header>

      <div className="segmented" role="tablist" aria-label="资料类型">
        <button role="tab" aria-selected={tab === 'recitation'} className={tab === 'recitation' ? 'active' : ''} onClick={() => setTab('recitation')}>背诵资料 <span>{items.filter((item) => item.type === 'recitation').length}</span></button>
        <button role="tab" aria-selected={tab === 'mistake'} className={tab === 'mistake' ? 'active' : ''} onClick={() => setTab('mistake')}>错题本 <span>{items.filter((item) => item.type === 'mistake').length}</span></button>
      </div>

      <label className="search-field">
        <Search size={19} />
        <span className="sr-only">搜索资料</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、科目或标签" />
      </label>

      {filtered.length ? (
        <div className="library-list">
          {filtered.map((item) => (
            <article key={item.id} className="library-row">
              <Link to={`/review/${item.id}`} className="library-main">
                <span className={`library-icon ${item.type}`} aria-hidden="true">{item.type === 'recitation' ? <BookOpenText size={21} /> : <FileQuestion size={21} />}</span>
                <span className="library-copy"><strong>{item.title}</strong><small>{item.subject || item.category || '未分类'} · 下次 {item.dueDate}</small></span>
              </Link>
              <button type="button" className="icon-button subtle" aria-label={`归档${item.title}`} onClick={() => setArchiveItem(item)}><Archive size={19} /></button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={tab === 'recitation' ? <BookOpenText size={28} /> : <FileQuestion size={28} />}
          title={query ? '没有匹配的资料' : tab === 'recitation' ? '建立第一份背诵资料' : '收下第一道错题'}
          text={query ? '换一个关键词试试。' : tab === 'recitation' ? '按段落录入文章或名言，系统会安排复习。' : '拍下原题，再补充答案、解析和错误原因。'}
          action={!query && <button className="button primary inline-button" onClick={() => setAdding(tab)}><Plus size={18} /> 立即添加</button>}
        />
      )}

      {adding && <AddContentModal type={adding} onClose={() => setAdding(null)} onSaved={(message) => { setAdding(null); notify(message) }} />}
      {importing && <ImportTemplateModal onClose={() => setImporting(false)} onSaved={(message) => { setImporting(false); notify(message) }} />}
      {archiveItem && <ConfirmDialog title="归档这条资料？" text="归档后不会再进入今日复习，但历史记录仍会保留在备份中。" confirmLabel="确认归档" danger onConfirm={archive} onClose={() => setArchiveItem(null)} />}
    </div>
  )
}

function ImportTemplateModal({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedRecitationTemplate | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = parseRecitationTemplate(text)
    setParsed(result)
    setError(result.items.length ? '' : '没有识别到“成语：释义”格式，请确认模板内容完整。')
  }

  async function importItems() {
    if (!parsed?.items.length) return
    setSaving(true)
    try {
      await addRecitationTemplateItems(parsed.items)
      onSaved(`已导入 ${parsed.items.length} 条成语，今天可以开始复习`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入失败，请重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="导入成语模板" onClose={onClose} wide>
      <form className="content-form" onSubmit={preview}>
        <p className="dialog-copy">粘贴老师发来的 Markdown 模板，系统会把每个“成语：释义”转换成一条语文背诵资料。</p>
        <Field label="模板内容" hint="支持【组名】、#### 分栏标题，以及“成语：释义”格式。">
          <textarea value={text} onChange={(event) => { setText(event.target.value); setParsed(null); setError('') }} rows={10} autoFocus placeholder="粘贴老师发来的模板…" />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button secondary full-button" type="submit">解析并预览</button>
      </form>
      {parsed && parsed.items.length > 0 && (
        <div className="import-preview" aria-live="polite">
          <div className="import-preview-heading"><strong>{parsed.group}</strong><span>{parsed.items.length} 条{parsed.countLabel ? ` / 模板标注 ${parsed.countLabel}` : ''}</span></div>
          <div className="import-preview-list">
            {parsed.items.slice(0, 5).map((item) => <div key={`${item.title}-${item.category}`}><strong>{item.title}</strong><span>{item.category.split(' · ').slice(-1)[0]} · {item.body}</span></div>)}
            {parsed.items.length > 5 && <small>还有 {parsed.items.length - 5} 条，导入后可在资料库搜索和编辑。</small>}
          </div>
          <button className="button primary full-button" type="button" onClick={importItems} disabled={saving}>{saving ? '正在导入…' : `确认导入 ${parsed.items.length} 条`}</button>
        </div>
      )}
    </Modal>
  )
}

function AddContentModal({ type, onClose, onSaved }: { type: ContentType; onClose: () => void; onSaved: (message: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const form = new FormData(event.currentTarget)
    try {
      const title = String(form.get('title') ?? '').trim()
      const body = String(form.get('body') ?? '').trim()
      if (!title) throw new Error('请填写标题。')
      if (type === 'recitation' && !body) throw new Error('请填写要背诵的正文。')
      if (type === 'mistake' && !file) throw new Error('请拍照或选择一道错题图片。')
      const imageIds = file ? [(await saveMedia(file)).id] : []
      await addContent({
        type,
        title,
        category: String(form.get('category') ?? '').trim(),
        subject: String(form.get('subject') ?? '').trim(),
        body,
        tags: String(form.get('tags') ?? '').split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        imageIds,
        answer: String(form.get('answer') ?? '').trim(),
        analysis: String(form.get('analysis') ?? '').trim(),
        errorReason: String(form.get('errorReason') ?? '').trim(),
      })
      onSaved(type === 'recitation' ? '背诵资料已加入今天的新内容' : '错题已保存并加入今天的新内容')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败，请重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={type === 'recitation' ? '添加背诵资料' : '添加错题'} onClose={onClose} wide>
      <form className="content-form" onSubmit={submit}>
        <Field label="标题"><input name="title" autoFocus maxLength={60} placeholder={type === 'recitation' ? '例如：劝学（节选）' : '例如：函数单调性第 3 题'} /></Field>
        {type === 'recitation' ? (
          <>
            <div className="field-grid">
              <Field label="分类"><input name="category" placeholder="文章 / 名言" /></Field>
              <Field label="学科"><input name="subject" placeholder="语文" /></Field>
            </div>
            <Field label="正文" hint="请用换行分隔段落，复习时会逐段遮挡。"><textarea name="body" rows={9} placeholder="粘贴需要背诵的内容…" /></Field>
          </>
        ) : (
          <>
            <Field label="原题照片" hint="图片只保存在当前设备，保存时会自动压缩。">
              <label className={`photo-picker ${file ? 'selected' : ''}`}>
                <Camera size={24} />
                <span>{file ? file.name : '拍照或从相册选择'}</span>
                <input type="file" accept="image/*" capture="environment" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </label>
            </Field>
            <Field label="学科"><input name="subject" placeholder="数学" /></Field>
            <Field label="答案"><textarea name="answer" rows={3} placeholder="正确答案或关键步骤" /></Field>
            <Field label="解析"><textarea name="analysis" rows={4} placeholder="为什么这样做" /></Field>
            <Field label="错误原因"><textarea name="errorReason" rows={3} placeholder="审题、概念、计算或方法问题" /></Field>
          </>
        )}
        <Field label="标签" hint="多个标签用逗号分隔。"><input name="tags" placeholder="期中, 重点" /></Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary full-button" disabled={saving}>{saving ? '正在保存…' : '保存并加入复习'}</button>
      </form>
    </Modal>
  )
}
