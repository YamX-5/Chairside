import { parseClinicDay, type ClinicDay } from '../content/schema'
import { localDateKey } from '../game/dates'
import type { Blueprint, GeneratedCase, TopicItems } from './schemas'
import { findDuplicates, verifyAll, type VerifiedItem } from './verify'

/**
 * Maps generated English-only output onto the game's ClinicDay schema and runs
 * it through the same `parseClinicDay` gate as hand-written content. Nothing
 * skips validation just because a model produced it.
 */

export interface AssembleInput {
  blueprint: Blueprint
  topics: { topic: { id: string; title: string }; result: TopicItems }[]
  patientCase: GeneratedCase
  deck: { fileName: string; pages: { page: number; text: string }[] }
  model: string
}

export interface AssembleReport {
  day: ClinicDay
  kept: number
  droppedUnverified: number
  droppedDuplicate: number
  /** Items whose quote could not be found — surfaced so they can be inspected. */
  unverified: VerifiedItem[]
  difficultyMix: Record<string, number>
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function assembleDay(input: AssembleInput): AssembleReport {
  const { blueprint, topics, patientCase, deck, model } = input

  const allItems = topics.flatMap((t) => t.result.items)
  const verified = verifyAll(allItems, deck)
  const duplicateIds = new Set(findDuplicates(allItems))

  const usable = new Set(
    verified
      .filter((v) => v.verified && !duplicateIds.has(v.item.id))
      .map((v) => v.item.id),
  )

  const chunks = topics
    .map((t) => {
      const kept = t.result.items.filter((i) => usable.has(i.id))
      if (kept.length === 0) return null

      // One micro-question per chunk in the PREP flow; every item also lands in
      // the derived question bank for the future recall queue.
      return kept.map((item, index) => ({
        id: `${t.topic.id}-${index}`,
        title: { en: t.topic.title },
        body: { en: t.result.teachingChunk },
        question: {
          id: item.id,
          prompt: { en: item.stem },
          options: item.options.map((o, oi) => ({
            id: `o${oi}`,
            label: { en: o.text },
            isCorrect: o.isCorrect,
            rationale: { en: o.rationale },
          })),
          explanation: { en: item.explanation },
          sourceRef: { en: `Page ${item.sourcePage}` },
          difficulty: item.difficulty,
          cognitive: item.cognitive,
          sourceQuote: item.sourceQuote,
        },
      }))
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .flat()

  const raw = {
    schemaVersion: 1 as const,
    id: `gen-${slug(blueprint.title)}-${localDateKey()}`,
    isDemo: false,
    provenance: {
      sourceFile: deck.fileName,
      pageCount: deck.pages.length,
      model,
      generatedOn: localDateKey(),
    },
    subject: { en: blueprint.subject },
    title: { en: blueprint.title },
    citations:
      blueprint.citations.length > 0
        ? blueprint.citations
        : [`Generated from ${deck.fileName} — verify against your syllabus`],
    prep: {
      missionTitle: { en: `Prep: ${blueprint.title}` },
      briefing: { en: blueprint.caseScenario },
      chunks,
    },
    treat: {
      missionTitle: { en: 'Treat: the afternoon case' },
      cases: [
        {
          id: 'case-1',
          patient: {
            name: { en: patientCase.patientName },
            age: patientCase.patientAge,
            avatar: patientCase.avatar,
          },
          chiefComplaint: { en: patientCase.chiefComplaint },
          history: { en: patientCase.history },
          findings: patientCase.findings.map((f) => ({ en: f })),
          decisions: patientCase.decisions.map((d) => ({
            id: d.id,
            prompt: { en: d.prompt },
            difficulty: d.difficulty,
            sourceQuote: d.sourceQuote,
            options: d.options.map((o, oi) => ({
              id: `d${oi}`,
              label: { en: o.text },
              quality: o.quality,
              feedback: { en: o.feedback },
              sourceRef: { en: `Page ${d.sourcePage}` },
            })),
          })),
          outcome: {
            success: { en: patientCase.outcomeSuccess },
            partial: { en: patientCase.outcomePartial },
            failure: { en: patientCase.outcomeFailure },
          },
        },
      ],
    },
  }

  const mix: Record<string, number> = { easy: 0, moderate: 0, hard: 0, brutal: 0 }
  for (const item of allItems) {
    if (usable.has(item.id)) mix[item.difficulty] = (mix[item.difficulty] ?? 0) + 1
  }

  return {
    day: parseClinicDay(raw),
    kept: usable.size,
    droppedUnverified: verified.filter((v) => !v.verified).length,
    droppedDuplicate: duplicateIds.size,
    unverified: verified.filter((v) => !v.verified),
    difficultyMix: mix,
  }
}
