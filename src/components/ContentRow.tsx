import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpenText, ChevronRight, CircleAlert, Image as ImageIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { useObjectUrl } from '../hooks'
import { contentTypeLabel } from '../services'
import type { ContentItem } from '../types'

function Thumbnail({ imageId, title }: { imageId?: string; title: string }) {
  const media = useLiveQuery(() => imageId ? db.media.get(imageId) : undefined, [imageId])
  const url = useObjectUrl(media?.blob)
  if (!url) return <div className="row-thumb placeholder"><ImageIcon size={20} /></div>
  return <img className="row-thumb" src={url} alt={`${title}题目照片`} />
}

export function ContentRow({ item, status }: { item: ContentItem; status?: string }) {
  return (
    <Link className="content-row" to={`/review/${item.id}`} aria-label={`复习${item.title}`}>
      {item.type === 'mistake' ? (
        <Thumbnail imageId={item.imageIds[0]} title={item.title} />
      ) : (
        <div className="row-thumb recitation"><BookOpenText size={22} /></div>
      )}
      <div className="row-copy">
        <div className="row-meta">
          <span>{contentTypeLabel(item.type)}</span>
          <span>{item.subject || item.category || '未分类'}</span>
          {status && <span className={status === '已逾期' ? 'overdue-label' : ''}>{status}</span>}
        </div>
        <strong>{item.title}</strong>
        <small>{item.type === 'recitation' ? '预计 3 分钟' : '预计 5 分钟'}</small>
      </div>
      <ChevronRight size={20} className="row-chevron" aria-hidden="true" />
    </Link>
  )
}

export function DueAlert({ count }: { count: number }) {
  if (!count) return null
  return <div className="due-alert"><CircleAlert size={17} /> 有 {count} 项已逾期，已优先排在前面</div>
}
