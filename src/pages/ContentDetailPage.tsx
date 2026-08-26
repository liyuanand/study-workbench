import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, BookOpenText, Edit3, FileQuestion } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Field, Modal } from '../components/ui'
import { db } from '../db'
import { useObjectUrl } from '../hooks'
import { updateContent } from '../services'
import type { ContentItem } from '../types'

export function ContentDetailPage() {
  const { id } = useParams()
  const item = useLiveQuery(() => id ? db.contents.get(id) : undefined, [id])
  const [editing, setEditing] = useState(false)

  if (item === undefined) return <div className="detail-state">正在打开资料…</div>
  if (!item) return <div className="detail-state"><p>这条资料不存在或已移除。</p><Link className="button secondary" to="/library">返回资料库</Link></div>
  const libraryType = item.type === 'recitation' && item.category.startsWith('作文训练') ? 'essay' : item.type

  return (
    <div className="page detail-page">
      <header className="detail-header">
        <Link to={`/library?type=${libraryType}`} className="icon-button" aria-label="返回资料库"><ArrowLeft size={22} /></Link>
        <div><span>资料详情</span><h1>{item.title}</h1></div>
        <span className={`detail-type ${item.type}`}>
          {item.type === 'recitation' ? <><BookOpenText size={15} /> 背诵</> : <><FileQuestion size={15} /> 错题</>}
        </span>
        <button type="button" className="icon-button subtle" aria-label="编辑资料" onClick={() => setEditing(true)}><Edit3 size={19} /></button>
      </header>

      <dl className="detail-meta">
        <div><dt>学科</dt><dd>{item.subject || '未分类'}</dd></div>
        <div><dt>分类</dt><dd>{item.category || '未分类'}</dd></div>
        <div><dt>下次安排</dt><dd>{item.dueDate}</dd></div>
      </dl>

      {item.tags.length > 0 && <div className="detail-tags" aria-label="标签">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}

      {item.type === 'recitation' ? (
        <DetailSection label="背诵原文" text={item.body} />
      ) : (
        <div className="detail-content">
          <section className="detail-section">
            <h2>题目照片</h2>
            <div className="detail-images">
              {item.imageIds.length ? item.imageIds.map((imageId, index) => <DetailImage key={imageId} imageId={imageId} title={item.title} index={index} />) : <p className="detail-empty">未添加题目照片</p>}
            </div>
          </section>
          <DetailSection label="正确答案" text={item.answer} />
          <DetailSection label="解析" text={item.analysis} />
          <DetailSection label="错误原因" text={item.errorReason} tone="warning" />
        </div>
      )}
      {editing && <EditContentModal item={item} onClose={() => setEditing(false)} />}
    </div>
  )
}

function EditContentModal({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      await updateContent(item.id, {
        title: String(form.get('title') ?? '').trim(), category: String(form.get('category') ?? '').trim(), subject: String(form.get('subject') ?? '').trim(),
        tags: String(form.get('tags') ?? '').split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), body: String(form.get('body') ?? '').trim(), answer: String(form.get('answer') ?? '').trim(), analysis: String(form.get('analysis') ?? '').trim(), errorReason: String(form.get('errorReason') ?? '').trim(),
      })
      onClose()
    } catch (caught) { setError(caught instanceof Error ? caught.message : '保存失败，请重试。') } finally { setSaving(false) }
  }
  return <Modal title="编辑资料" onClose={onClose} wide><form className="content-form" onSubmit={submit}>
    <Field label="标题"><input name="title" defaultValue={item.title} required /></Field>
    <div className="field-grid"><Field label="分类"><input name="category" defaultValue={item.category} /></Field><Field label="学科"><input name="subject" defaultValue={item.subject} /></Field></div>
    {item.type === 'recitation' ? <Field label="正文"><textarea name="body" rows={9} defaultValue={item.body} /> </Field> : <><Field label="答案"><textarea name="answer" rows={3} defaultValue={item.answer} /></Field><Field label="解析"><textarea name="analysis" rows={4} defaultValue={item.analysis} /></Field><Field label="错误原因"><textarea name="errorReason" rows={3} defaultValue={item.errorReason} /></Field></>}
    <Field label="标签" hint="多个标签用逗号分隔。"><input name="tags" defaultValue={item.tags.join(', ')} /></Field>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button primary full-button" disabled={saving}>{saving ? '正在保存…' : '保存修改'}</button>
  </form></Modal>
}

function DetailSection({ label, text, tone = '' }: { label: string; text: string; tone?: string }) {
  return <section className={`detail-section ${tone}`}><h2>{label}</h2><p>{text || '未填写'}</p></section>
}

function DetailImage({ imageId, title, index }: { imageId: string; title: string; index: number }) {
  const media = useLiveQuery(() => db.media.get(imageId), [imageId])
  const url = useObjectUrl(media?.blob)
  return url ? <img src={url} alt={`${title}题目照片${index + 1}`} /> : <p className="detail-empty">照片未找到</p>
}
