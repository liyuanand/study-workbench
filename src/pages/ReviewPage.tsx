import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, BookOpenText, Check, Eye, EyeOff, HelpCircle, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import { useObjectUrl } from '../hooks'
import { toDateKey } from '../lib/date'
import { calculateReviewOutcome } from '../lib/schedule'
import { completeReview, getNextDueItem } from '../services'
import type { ContentItem, ReviewRating } from '../types'

export function ReviewPage({ notify }: { notify: (message: string) => void }) {
  const { id } = useParams()
  const item = useLiveQuery(() => id ? db.contents.get(id) : undefined, [id])
  if (item === undefined) return <div className="review-loading">正在打开资料…</div>
  if (!item) return <div className="review-missing"><p>这条资料不存在或已移除。</p><Link className="button secondary" to="/today">返回今日</Link></div>
  return item.type === 'recitation'
    ? <RecitationReview key={item.id} item={item} notify={notify} />
    : <MistakeReview key={item.id} item={item} notify={notify} />
}

function ReviewHeader({ item }: { item: ContentItem }) {
  return (
    <header className="review-header">
      <Link to="/today" className="icon-button" aria-label="返回今日"><ArrowLeft size={22} /></Link>
      <div><span>{item.type === 'recitation' ? '背诵复习' : '错题复习'}</span><strong>{item.title}</strong></div>
      <span className="stage-badge">{item.reviewStage < 0 ? '新' : `${item.reviewStage + 1} 阶`}</span>
    </header>
  )
}

function RecitationReview({ item, notify }: { item: ContentItem; notify: (message: string) => void }) {
  const sections = useMemo(() => item.body.split(/\n+/).map((part) => part.trim()).filter(Boolean), [item.body])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const finished = index >= sections.length

  function next() {
    if (!revealed) {
      setRevealed(true)
      return
    }
    setIndex((value) => value + 1)
    setRevealed(false)
  }

  return (
    <div className="review-page">
      <ReviewHeader item={item} />
      <div className="review-progress"><span style={{ width: `${Math.min(100, (index / Math.max(1, sections.length)) * 100)}%` }} /></div>
      {!finished ? (
        <section className="recitation-stage" aria-live="polite">
          <div className="section-counter">第 {index + 1} 段 / 共 {sections.length} 段</div>
          {index > 0 && <div className="context-block"><span>上一段</span><p>{sections[index - 1]}</p></div>}
          <div className={`masked-block ${revealed ? 'revealed' : ''}`}>
            {revealed ? <p>{sections[index]}</p> : <><EyeOff size={26} /><strong>先在心里背出这一段</strong><span>准备好后查看原文</span></>}
          </div>
          <button type="button" className="button primary full-button review-action" onClick={next}>
            {revealed ? <><Check size={19} /> 这段完成，继续</> : <><Eye size={19} /> 查看原文</>}
          </button>
        </section>
      ) : (
        <RatingPanel item={item} notify={notify} intro="整篇已经走完一遍。按真实感受选择，系统会安排下次复习。" />
      )}
    </div>
  )
}

function MistakeReview({ item, notify }: { item: ContentItem; notify: (message: string) => void }) {
  const media = useLiveQuery(() => item.imageIds[0] ? db.media.get(item.imageIds[0]) : undefined, [item.imageIds[0]])
  const url = useObjectUrl(media?.blob)
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="review-page">
      <ReviewHeader item={item} />
      {!revealed ? (
        <section className="mistake-stage">
          <p className="review-prompt">先独立思考并在纸上完成，再查看答案。</p>
          <div className="question-image-wrap">{url ? <img src={url} alt={`${item.title}原题`} /> : <div className="image-missing">题目图片未找到</div>}</div>
          <button type="button" className="button primary full-button review-action" onClick={() => setRevealed(true)}><Eye size={19} /> 查看答案与解析</button>
        </section>
      ) : (
        <section className="answer-stage">
          <div className="question-image-wrap compact">{url && <img src={url} alt={`${item.title}原题`} />}</div>
          <AnswerBlock label="正确答案" text={item.answer || '未填写'} />
          <AnswerBlock label="解析" text={item.analysis || '未填写'} />
          <AnswerBlock label="上次错误原因" text={item.errorReason || '未填写'} tone="warning" />
          <RatingPanel item={item} notify={notify} intro="对照完成后，选择最接近当前掌握程度的一项。" />
        </section>
      )}
    </div>
  )
}

function AnswerBlock({ label, text, tone = '' }: { label: string; text: string; tone?: string }) {
  return <div className={`answer-block ${tone}`}><span>{label}</span><p>{text}</p></div>
}

const ratingMeta: Array<{ value: ReviewRating; label: string; detail: string; icon: typeof RotateCcw }> = [
  { value: 'forgot', label: '忘记', detail: '明天再来', icon: RotateCcw },
  { value: 'fuzzy', label: '模糊', detail: '缩短间隔', icon: HelpCircle },
  { value: 'remembered', label: '记住', detail: '进入下一阶', icon: Sparkles },
]

function RatingPanel({ item, intro, notify }: { item: ContentItem; intro: string; notify: (message: string) => void }) {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState<ReviewRating | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }, [])

  async function rate(rating: ReviewRating) {
    setSubmitting(rating)
    setError('')
    try {
      const outcome = calculateReviewOutcome(item.reviewStage, rating, toDateKey())
      await completeReview(item.id, rating)
      const next = await getNextDueItem(item.id)
      notify(next ? '复习完成 +5 分，继续下一个' : `复习完成 +5 分，下次安排在 ${outcome.dueDate}`)
      navigate(next ? `/review/${next.id}` : '/today')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败，请重试。')
      setSubmitting(null)
    }
  }

  return (
    <div className="rating-panel">
      <BookOpenText size={24} />
      <h2>这次记得怎么样？</h2>
      <p>{intro}</p>
      <div className="rating-options">
        {ratingMeta.map(({ value, label, detail, icon: Icon }) => (
          <button key={value} type="button" className={`rating-button ${value}`} disabled={submitting !== null} onClick={() => rate(value)}>
            <Icon size={21} /><strong>{label}</strong><span>{detail}</span>
          </button>
        ))}
      </div>
      <small className="rating-note">无论选择哪项，首次完成都会获得相同积分。</small>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
