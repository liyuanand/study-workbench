import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, BookOpenText, FileQuestion } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../db'
import { useObjectUrl } from '../hooks'

export function ContentDetailPage() {
  const { id } = useParams()
  const item = useLiveQuery(() => id ? db.contents.get(id) : undefined, [id])

  if (item === undefined) return <div className="detail-state">正在打开资料…</div>
  if (!item) return <div className="detail-state"><p>这条资料不存在或已移除。</p><Link className="button secondary" to="/library">返回资料库</Link></div>

  return (
    <div className="page detail-page">
      <header className="detail-header">
        <Link to={`/library?type=${item.type}`} className="icon-button" aria-label="返回资料库"><ArrowLeft size={22} /></Link>
        <div><span>资料详情</span><h1>{item.title}</h1></div>
        <span className={`detail-type ${item.type}`}>
          {item.type === 'recitation' ? <><BookOpenText size={15} /> 背诵</> : <><FileQuestion size={15} /> 错题</>}
        </span>
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
    </div>
  )
}

function DetailSection({ label, text, tone = '' }: { label: string; text: string; tone?: string }) {
  return <section className={`detail-section ${tone}`}><h2>{label}</h2><p>{text || '未填写'}</p></section>
}

function DetailImage({ imageId, title, index }: { imageId: string; title: string; index: number }) {
  const media = useLiveQuery(() => db.media.get(imageId), [imageId])
  const url = useObjectUrl(media?.blob)
  return url ? <img src={url} alt={`${title}题目照片${index + 1}`} /> : <p className="detail-empty">照片未找到</p>
}
