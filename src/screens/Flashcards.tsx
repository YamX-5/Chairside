import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { BiText, ClinicDay } from '../content/schema'
import { useLocale } from '../locales/LocaleContext'
import { buildQuestionBank } from '../game/questionBank'

/**
 * Active-recall flashcards drilled at the desk before the patients arrive.
 *
 * Cards are DERIVED from the day's own questions (buildQuestionBank) — front is
 * the prompt, back is the correct answer + why. The student flips, then honestly
 * self-rates; "review" cards come back at the end so the weak ones get repeated.
 */

interface Props {
  day: ClinicDay
  onDone: () => void
}

// New UI strings kept as deliberate inline bilingual (EN study language + AR aid).
const S = {
  title: { en: 'Flashcards — active recall', ar: 'بطاقات — استرجاع نشط' } as BiText,
  reveal: { en: 'Tap to reveal the answer', ar: 'اضغط لكشف الإجابة' } as BiText,
  again: { en: '↻ Review', ar: '↻ راجع' } as BiText,
  got: { en: '✓ Got it', ar: '✓ أتقنتها' } as BiText,
  skip: { en: 'Skip to the patients →', ar: 'تخطَّ إلى المرضى ←' } as BiText,
  done: { en: 'Recall done', ar: 'انتهى الاسترجاع' } as BiText,
}

export function Flashcards({ day, onDone }: Props) {
  const { c } = useLocale()
  const deck = useMemo(() => buildQuestionBank([day]), [day])

  // A queue we can push "review" cards back onto.
  const [queue, setQueue] = useState<number[]>(() => deck.map((_, i) => i))
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [got, setGot] = useState(0)

  const total = deck.length
  const idx = queue[pos]
  const card = deck[idx]
  const correct = card?.options.find((o) => o.isCorrect)

  function next(knew: boolean) {
    const q = [...queue]
    if (!knew) q.push(idx) // repeat the weak one later
    else setGot((g) => g + 1)
    if (pos + 1 < q.length) {
      setQueue(q)
      setPos(pos + 1)
      setFlipped(false)
    } else {
      onDone()
    }
  }

  if (!card) {
    onDone()
    return null
  }

  return (
    <div className="flash">
      <div className="flash-head">
        <span className="cine-scene-tag">🗂️ {c(S.title)}</span>
        <span className="muted">
          {got} / {total} · {c(S.done)} {Math.round((got / total) * 100)}%
        </span>
      </div>

      <motion.button
        key={`${card.id}-${flipped}`}
        className="flash-card"
        onClick={() => !flipped && setFlipped(true)}
        initial={{ rotateX: 12, opacity: 0, y: 10 }}
        animate={{ rotateX: 0, opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {!flipped ? (
          <div className="flash-face">
            <div className="flash-q">{c(card.prompt)}</div>
            <div className="flash-hint muted">{c(S.reveal)}</div>
          </div>
        ) : (
          <div className="flash-face flash-answered">
            {correct && <div className="flash-a">{c(correct.label)}</div>}
            <div className="flash-exp">{c(card.explanation)}</div>
          </div>
        )}
      </motion.button>

      {flipped && (
        <motion.div
          className="flash-rate"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button className="btn btn-ghost" onClick={() => next(false)}>
            {c(S.again)}
          </button>
          <button className="btn btn-primary" onClick={() => next(true)}>
            {c(S.got)}
          </button>
        </motion.div>
      )}

      <button className="flash-skip" onClick={onDone}>
        {c(S.skip)}
      </button>
    </div>
  )
}
