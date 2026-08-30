import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, BookOpenText, Camera, FileQuestion, FileText, FileUp, Images, Plus, Search, Tags, X } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConfirmDialog, EmptyState, Field, Modal } from '../components/ui'
import { db } from '../db'
import { useObjectUrl } from '../hooks'
import { addContent, addMistakePhotoBatch, addRecitationTemplateItems } from '../services'
import { getContentGroupLabel } from '../lib/contentGrouping'
import { parseEssayTemplate, parseKnowledgeTemplate, parseRecitationTemplate, type ParsedRecitationTemplate } from '../lib/templateImport'
import type { ContentItem, ContentType } from '../types'
type LibraryTab = ContentType | 'essay'

export function LibraryPage({ notify }: { notify: (message: string) => void }) {
  const location = useLocation()
  const [tab, setTab] = useState<LibraryTab>(() => { const type = new URLSearchParams(location.search).get('type'); return type === 'mistake' || type === 'essay' ? type : 'recitation' })
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<LibraryTab | null>(null)
  const [importing, setImporting] = useState(false)
  const [archiveItem, setArchiveItem] = useState<ContentItem | null>(null)
  const [groupByTag, setGroupByTag] = useState(true)
  const items = useLiveQuery(() => db.contents.filter((item) => !item.archived).reverse().sortBy('createdAt')) ?? []
  const filtered = useMemo(() => items.filter((item) => {
    const matchesTab = tab === 'essay'
      ? item.type === 'recitation' && item.category.startsWith('作文训练')
      : tab === 'recitation'
        ? item.type === 'recitation' && !item.category.startsWith('作文训练')
        : item.type === 'mistake'
    return matchesTab && [item.title, item.subject, item.category, ...item.tags].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  }).sort((a, b) => Number(Boolean(b.starred)) - Number(Boolean(a.starred)) || b.createdAt.localeCompare(a.createdAt)), [items, query, tab])
  const groups = useMemo(() => {
    if (!groupByTag) return [{ label: '', items: filtered }]
    const map = new Map<string, ContentItem[]>()
    filtered.forEach((item) => { const tag = getContentGroupLabel(item); map.set(tag, [...(map.get(tag) ?? []), item]) })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'zh-CN')).map(([label, groupItems]) => ({ label, items: groupItems }))
  }, [filtered, groupByTag, tab])

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
          {tab === 'recitation' && <button type="button" className="icon-button" onClick={() => setImporting(true)} aria-label="批量导入背诵资料"><FileUp size={21} /></button>}
          {tab === 'essay' && <button type="button" className="icon-button" onClick={() => setImporting(true)} aria-label="批量导入作文素材"><FileUp size={21} /></button>}
          <button type="button" className="icon-button solid" onClick={() => setAdding(tab)} aria-label={`添加${tab === 'recitation' ? '背诵' : tab === 'essay' ? '作文素材' : '错题'}`}><Plus size={22} /></button>
        </div>
      </header>

      <div className="segmented" role="tablist" aria-label="资料类型">
        <button role="tab" aria-selected={tab === 'recitation'} className={tab === 'recitation' ? 'active' : ''} onClick={() => setTab('recitation')}>背诵资料 <span>{items.filter((item) => item.type === 'recitation' && !item.category.startsWith('作文训练')).length}</span></button>
        <button role="tab" aria-selected={tab === 'mistake'} className={tab === 'mistake' ? 'active' : ''} onClick={() => setTab('mistake')}>错题本 <span>{items.filter((item) => item.type === 'mistake').length}</span></button>
        <button role="tab" aria-selected={tab === 'essay'} className={tab === 'essay' ? 'active' : ''} onClick={() => setTab('essay')}>作文训练 <span>{items.filter((item) => item.type === 'recitation' && item.category.startsWith('作文训练')).length}</span></button>
      </div>

      <label className="search-field">
        <Search size={19} />
        <span className="sr-only">搜索资料</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、科目或标签" />
      </label>

      <button type="button" className={`tag-group-toggle ${groupByTag ? 'active' : ''}`} aria-pressed={groupByTag} onClick={() => setGroupByTag((value) => !value)}><Tags size={17} /> {groupByTag ? '按标签分组中' : '按标签分组'}</button>

      {filtered.length ? (
        <div className="library-groups">
          {groups.map((group) => <section className="library-group" key={group.label || 'all'}>
            {group.label && <h2><Tags size={16} />{group.label}<span>{group.items.length}</span></h2>}
            <div className="library-list">{group.items.map((item) => (
            <article key={item.id} className="library-row">
              <Link to={`/library/${item.id}`} className="library-main" aria-label={`查看${item.title}`}>
                <span className={`library-icon ${item.type}`} aria-hidden="true">{item.type === 'recitation' ? <BookOpenText size={21} /> : <FileQuestion size={21} />}</span>
                <span className="library-copy"><strong>{item.title}</strong><small>{item.subject || item.category || '未分类'} · 下次 {item.dueDate}</small></span>
              </Link>
              <button type="button" className="icon-button subtle" aria-label={`归档${item.title}`} onClick={() => setArchiveItem(item)}><Archive size={19} /></button>
            </article>
            ))}</div>
          </section>)}
        </div>
      ) : (
        <EmptyState
          icon={tab === 'recitation' ? <BookOpenText size={28} /> : tab === 'essay' ? <FileText size={28} /> : <FileQuestion size={28} />}
          title={query ? '没有匹配的资料' : tab === 'recitation' ? '建立第一份背诵资料' : tab === 'essay' ? '建立第一份作文素材' : '收下第一道错题'}
          text={query ? '换一个关键词试试。' : tab === 'recitation' ? '按段落录入文章或名言，系统会安排复习。' : tab === 'essay' ? '录入结构模板、金句或论据，系统会安排复习。' : '拍下原题，再补充答案、解析和错误原因。'}
          action={!query && <button className="button primary inline-button" onClick={() => setAdding(tab)}><Plus size={18} /> 立即添加</button>}
        />
      )}

      {adding && <AddContentModal type={adding} onClose={() => setAdding(null)} onSaved={(message) => { setAdding(null); notify(message) }} />}
      {importing && <ImportTemplateModal initialMode={tab === 'essay' ? 'essay' : 'idiom'} onClose={() => setImporting(false)} onSaved={(message) => { setImporting(false); notify(message) }} />}
      {archiveItem && <ConfirmDialog title="归档这条资料？" text="归档后不会再进入今日复习，但历史记录仍会保留在备份中。" confirmLabel="确认归档" danger onConfirm={archive} onClose={() => setArchiveItem(null)} />}
    </div>
  )
}

function ImportTemplateModal({ initialMode, onClose, onSaved }: { initialMode: 'idiom' | 'essay'; onClose: () => void; onSaved: (message: string) => void }) {
  const [mode, setMode] = useState<'idiom' | 'knowledge' | 'essay'>(initialMode)
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedRecitationTemplate | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = mode === 'idiom' ? parseRecitationTemplate(text) : mode === 'knowledge' ? parseKnowledgeTemplate(text) : parseEssayTemplate(text)
    setParsed(result)
    setError(result.items.length ? '' : mode === 'idiom' ? '没有识别到“成语：释义”格式，请确认模板内容完整。' : mode === 'knowledge' ? '没有识别到完整知识点。每条必须包含“### 标题”和“【考点精析】”。' : '没有识别到作文素材。每条必须包含“## 标题”和正文。')
  }

  async function importItems() {
    if (!parsed?.items.length) return
    setSaving(true)
    try {
      await addRecitationTemplateItems(parsed.items)
      onSaved(`已导入 ${parsed.items.length} 条${mode === 'idiom' ? '成语' : mode === 'knowledge' ? '知识点' : '作文素材'}，系统将按学习计划安排`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入失败，请重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="批量导入" onClose={onClose} wide>
      <div className="segmented import-type-tabs" role="tablist" aria-label="导入模板类型">
        <button type="button" role="tab" aria-selected={mode === 'idiom'} className={mode === 'idiom' ? 'active' : ''} onClick={() => { setMode('idiom'); setText(''); setParsed(null); setError('') }}>成语模板</button>
        <button type="button" role="tab" aria-selected={mode === 'knowledge'} className={mode === 'knowledge' ? 'active' : ''} onClick={() => { setMode('knowledge'); setText(''); setParsed(null); setError('') }}>知识点模板</button>
        <button type="button" role="tab" aria-selected={mode === 'essay'} className={mode === 'essay' ? 'active' : ''} onClick={() => { setMode('essay'); setText(''); setParsed(null); setError('') }}>作文模板</button>
      </div>
      <form className="content-form" onSubmit={preview}>
        <p className="dialog-copy">{mode === 'idiom' ? '每个“成语：释义”会转换成一条语文背诵资料。' : mode === 'knowledge' ? '每个“### 标题”会转换成一条背诵资料，考点精析和知识延伸分段复习。' : '每个“## 标题”会转换成一条作文素材，按主题和用途分类复习。'}</p>
        <Field label="模板内容" hint={mode === 'idiom' ? '支持【组名】、#### 分栏标题，以及“成语：释义”格式。' : mode === 'knowledge' ? '格式：【数学知识】专题、### 标题、【考点精析】正文、【知识延伸】正文。' : '格式：【作文素材】主题、## 标题、【类型】、【适用位置】、正文、【标签】。'}>
          <textarea value={text} onChange={(event) => { setText(event.target.value); setParsed(null); setError('') }} rows={10} autoFocus placeholder={mode === 'idiom' ? '粘贴老师发来的成语模板…' : mode === 'knowledge' ? '粘贴数学、物理或其他学科知识点模板…' : '粘贴作文结构、金句或论据模板…'} />
        </Field>
        <label className="file-import-button"><FileUp size={17} /> 选择 Markdown 文件<input className="sr-only" type="file" accept=".md,.txt,text/markdown,text/plain" onChange={async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setText(await file.text()); setParsed(null); setError('') }} /></label>
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

function AddContentModal({ type, onClose, onSaved }: { type: LibraryTab; onClose: () => void; onSaved: (message: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [mergePhotos, setMergePhotos] = useState(true)

  function addFiles(nextFiles: File[]) {
    setFiles((current) => {
      const merged = [...current]
      for (const file of nextFiles) {
        const key = `${file.name}-${file.size}-${file.lastModified}`
        if (!merged.some((entry) => `${entry.name}-${entry.size}-${entry.lastModified}` === key)) merged.push(file)
      }
      return merged
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const form = new FormData(event.currentTarget)
    try {
      const title = String(form.get('title') ?? '').trim()
      const body = String(form.get('body') ?? '').trim()
      if (!title) throw new Error('请填写标题。')
      if ((type === 'recitation' || type === 'essay') && !body) throw new Error(type === 'essay' ? '请填写作文素材正文。' : '请填写要背诵的正文。')
      if (type === 'mistake' && !files.length) throw new Error('请拍照或从相册选择错题图片。')
      const commonValues = {
        type: type === 'essay' ? 'recitation' : type,
        title,
        category: type === 'essay' ? `作文训练 · ${String(form.get('essayType') ?? '作文素材').trim() || '作文素材'}` : String(form.get('category') ?? '').trim(),
        subject: String(form.get('subject') ?? '').trim(),
        body,
        tags: String(form.get('tags') ?? '').split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        imageIds: [],
        answer: String(form.get('answer') ?? '').trim(),
        analysis: String(form.get('analysis') ?? '').trim(),
        errorReason: String(form.get('errorReason') ?? '').trim(),
      }
      if (type === 'mistake') {
        const count = await addMistakePhotoBatch(files, commonValues, mergePhotos)
        onSaved(mergePhotos ? '已保存 1 道错题（含多张照片）并加入今天的新内容' : `已导入 ${count} 道错题并加入今天的新内容`)
      } else {
        await addContent(commonValues)
        onSaved('背诵资料已加入今天的新内容')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败，请重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={type === 'recitation' ? '添加背诵资料' : type === 'essay' ? '添加作文素材' : '添加错题'} onClose={onClose} wide>
      <form className="content-form" onSubmit={submit}>
        <Field label={type === 'recitation' ? '标题' : files.length > 1 ? '标题前缀' : '标题'} hint={type === 'mistake' && files.length > 1 ? `将自动保存为“标题前缀 01”至“标题前缀 ${String(files.length).padStart(2, '0')}”。` : undefined}><input name="title" autoFocus maxLength={60} placeholder={type === 'recitation' ? '例如：劝学（节选）' : files.length > 1 ? '例如：八月数学错题' : '例如：函数单调性第 3 题'} /></Field>
        {type === 'recitation' || type === 'essay' ? (
          <>
            <div className="field-grid">
              <Field label={type === 'essay' ? '素材类型' : '分类'}><input name={type === 'essay' ? 'essayType' : 'category'} placeholder={type === 'essay' ? '结构模板 / 金句 / 论据' : '文章 / 名言'} /></Field>
              <Field label="学科"><input name="subject" placeholder="语文" /></Field>
            </div>
            <Field label={type === 'essay' ? '素材正文' : '正文'} hint="请用换行分隔段落，复习时会逐段遮挡。"><textarea name="body" rows={9} placeholder={type === 'essay' ? '粘贴模板、金句或论据内容…' : '粘贴需要背诵的内容…'} /></Field>
          </>
        ) : (
          <>
            <Field label="错题相关图片" hint="可连续拍照或从相册多选；多张图片默认保存在同一道错题中，并按选择顺序展示。">
              <div className="photo-source-grid">
                <label className="photo-source-button">
                  <Camera size={22} /><span>拍照</span>
                  <input aria-label="拍照添加错题" type="file" accept="image/*" capture="environment" onChange={(event) => { addFiles([...event.target.files ?? []]); event.target.value = '' }} />
                </label>
                <label className="photo-source-button">
                  <Images size={22} /><span>从相册选择</span><small>支持多选</small>
                  <input aria-label="从相册选择错题照片（可多选）" type="file" accept="image/*" multiple onChange={(event) => { addFiles([...event.target.files ?? []]); event.target.value = '' }} />
                </label>
              </div>
              {files.length > 0 && (
                <div className="selected-photos" aria-live="polite">
                  <div><strong>已选择 {files.length} 张</strong><button type="button" className="button text-button" onClick={() => setFiles([])}>全部清除</button></div>
                  <div className="selected-photo-list">
                    {files.map((selected, index) => <SelectedPhotoRow key={`${selected.name}-${selected.size}-${selected.lastModified}`} file={selected} index={index} onRemove={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} />)}
                  </div>
                  {files.length > 1 && <label className="merge-photos-option"><input type="checkbox" checked={mergePhotos} onChange={(event) => setMergePhotos(event.target.checked)} /><span><strong>保存为同一道错题</strong><small>{mergePhotos ? '复习时会按顺序查看全部图片' : '关闭后，每张图片生成一道独立错题'}</small></span></label>}
                </div>
              )}
            </Field>
            <Field label="学科"><input name="subject" placeholder="数学" /></Field>
            <Field label="答案"><textarea name="answer" rows={3} placeholder="正确答案或关键步骤" /></Field>
            <Field label="解析"><textarea name="analysis" rows={4} placeholder="为什么这样做" /></Field>
            <Field label="错误原因"><textarea name="errorReason" rows={3} placeholder="审题、概念、计算或方法问题" /></Field>
          </>
        )}
        <Field label="标签" hint="多个标签用逗号分隔。"><input name="tags" placeholder="期中, 重点" /></Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary full-button" disabled={saving}>{saving ? `正在压缩并保存 ${files.length || 1} 张…` : type === 'mistake' && files.length > 1 && !mergePhotos ? `保存 ${files.length} 道并加入复习` : '保存并加入复习'}</button>
      </form>
    </Modal>
  )
}

function SelectedPhotoRow({ file, index, onRemove }: { file: File; index: number; onRemove: () => void }) {
  const preview = useObjectUrl(file)
  return <span><img src={preview} alt="" /><i>{index + 1}</i><b>{file.name}</b><button type="button" className="icon-button" aria-label={`移除${file.name}`} onClick={onRemove}><X size={17} /></button></span>
}
