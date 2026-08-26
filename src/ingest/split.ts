import {
  ALL_CHANNELS,
  SEAT_MAPS,
  type CaseCore,
  type ChannelId,
  type Fact,
  type Packet,
  type SeatId,
} from './channels'

/**
 * The deal: one CaseCore becomes one Packet per seat.
 *
 * This runs ON THE SERVER and its output is what goes over the wire. Hiding
 * information in the UI is not hiding it — a player opens devtools and reads the
 * whole case. The only implementation that actually enforces the split is one
 * where the client never receives what it isn't allowed to see, which is why
 * this function returns packets rather than a case plus a visibility mask.
 *
 * The test asserts on the SERIALISED payload rather than these objects, because
 * the realistic failure is not a logic bug here — it's a debugging shortcut
 * somewhere else that sends the full case "just for now" and never gets removed.
 */

export class SplitError extends Error {}

/** Channels held by a seat, for a given player count. */
export function seatChannels(playerCount: 1 | 2 | 3, seat: SeatId): ChannelId[] {
  const map = SEAT_MAPS[playerCount]
  const channels = map[seat]
  if (!channels) {
    throw new SplitError(`Seat ${seat} is not dealt in a ${playerCount}-player game`)
  }
  return channels
}

export function seatsFor(playerCount: 1 | 2 | 3): SeatId[] {
  return Object.keys(SEAT_MAPS[playerCount]) as SeatId[]
}

/**
 * The invariant that keeps the design from collapsing into single-player.
 *
 * CHAIR has the only hands; PROTOCOL has the decision rules. A seat holding both
 * can decide AND act without speaking to anyone, and every other seat becomes a
 * spectator. Checked here rather than trusted, because a future mapping edit is
 * exactly the kind of change that silently breaks it.
 */
export function assertHandsNeverHoldProtocol(playerCount: 1 | 2 | 3): void {
  if (playerCount === 1) return // solo is constrained diegetically, not socially
  for (const seat of seatsFor(playerCount)) {
    const channels = seatChannels(playerCount, seat)
    if (channels.includes('CHAIR') && channels.includes('PROTOCOL')) {
      throw new SplitError(
        `Seat ${seat} holds both CHAIR and PROTOCOL in the ${playerCount}-player map — ` +
          'that seat can decide and act alone, which makes the other seats spectators',
      )
    }
  }
}

/**
 * Strip a Fact down to nothing. Foreign facts are not included in a packet at
 * all — this exists to document what a "stub" would have leaked, and is used by
 * the tests to enumerate forbidden substrings.
 *
 * `tooth` is the one that matters most: it is the join key, obtainable only by
 * CHAIR looking in the mouth, and every other channel is indexed by it. Ship it
 * in a stub and the opening "which tooth are we on?" conversation never happens.
 */
export function forbiddenDisclosures(fact: Fact): string[] {
  const out = [fact.value, fact.label, fact.category, fact.sourceQuote]
  if (fact.tooth) out.push(fact.tooth)
  return out.filter((s) => s.length > 0)
}

/**
 * Deal a case into per-seat packets.
 *
 * @param core        the full case — server-only, never sent whole
 * @param playerCount 1, 2 or 3; selects the seat->channel mapping
 */
export function dealCase(core: CaseCore, playerCount: 1 | 2 | 3): Record<SeatId, Packet> {
  assertHandsNeverHoldProtocol(playerCount)

  const seats = seatsFor(playerCount)

  // Every channel must be dealt to someone, or a load-bearing fact silently
  // reaches nobody and the case becomes unwinnable — which reads to players as
  // the game cheating, the one thing the design must never do.
  const dealt = new Set(seats.flatMap((s) => seatChannels(playerCount, s)))
  const undealt = ALL_CHANNELS.filter((c) => !dealt.has(c))
  if (undealt.length > 0) {
    throw new SplitError(
      `Channels ${undealt.join(', ')} are dealt to no seat in the ${playerCount}-player map`,
    )
  }

  const countsByChannel = new Map<ChannelId, number>()
  for (const channel of ALL_CHANNELS) countsByChannel.set(channel, 0)
  for (const fact of core.facts) {
    countsByChannel.set(fact.channel, (countsByChannel.get(fact.channel) ?? 0) + 1)
  }

  const packets = {} as Record<SeatId, Packet>

  for (const seat of seats) {
    const mine = seatChannels(playerCount, seat)
    const isMine = (c: ChannelId) => mine.includes(c)

    // Counts for channels this seat does NOT hold. Enough to know there is
    // something worth asking about; not enough to guess what it is.
    const otherChannelFactCounts: Partial<Record<ChannelId, number>> = {}
    for (const channel of ALL_CHANNELS) {
      if (!isMine(channel)) otherChannelFactCounts[channel] = countsByChannel.get(channel) ?? 0
    }

    packets[seat] = {
      seat,
      caseId: core.id,
      title: core.title,
      channels: mine,
      facts: core.facts.filter((f) => isMine(f.channel)),
      obligations: core.obligations.filter((o) => isMine(o.channel)),
      otherChannelFactCounts,
      options: core.options,
    }
  }

  return packets
}

/**
 * How many load-bearing facts a seat can see.
 *
 * Used by the split verifier and by the human hidden-profile test. If any single
 * seat can see ALL load-bearing facts, the split is decorative — that seat
 * solves the case alone and the other players are watching a video.
 */
export function loadBearingReach(
  core: CaseCore,
  playerCount: 1 | 2 | 3,
): Record<SeatId, { visible: number; total: number }> {
  const total = core.facts.filter((f) => f.loadBearing).length
  const out = {} as Record<SeatId, { visible: number; total: number }>
  for (const seat of seatsFor(playerCount)) {
    const mine = seatChannels(playerCount, seat)
    out[seat] = {
      visible: core.facts.filter((f) => f.loadBearing && mine.includes(f.channel)).length,
      total,
    }
  }
  return out
}

/**
 * Structural check that a split is worth playing, independent of any model call.
 *
 * The LLM-based solo-solver check (verifySplit.ts) is slow, costs money and
 * proves a property about a language model. This proves a property about the
 * data, instantly and for free, and catches the most common generation failures
 * before anything expensive runs.
 */
export function auditSplit(
  core: CaseCore,
  playerCount: 1 | 2 | 3,
): { ok: boolean; problems: string[] } {
  const problems: string[] = []

  if (playerCount === 1) return { ok: true, problems }

  const reach = loadBearingReach(core, playerCount)
  for (const [seat, { visible, total }] of Object.entries(reach)) {
    if (total > 0 && visible === total) {
      problems.push(
        `Seat ${seat} can see all ${total} load-bearing facts — it can solve the case alone`,
      )
    }
  }

  // A channel holding no load-bearing fact is a seat with nothing to contribute.
  // PROTOCOL is exempt: it holds the decision rules, which are a transformation
  // rather than a fact, and its value is that nobody else can apply them.
  for (const channel of ALL_CHANNELS) {
    if (channel === 'CHAIR' || channel === 'PROTOCOL') continue
    const carries = core.facts.some((f) => f.channel === channel && f.loadBearing)
    if (!carries) problems.push(`Channel ${channel} carries no load-bearing fact`)
  }

  // Every contraindication must actually be dealt, or class C — the co-op payoff,
  // the consequence that proves somebody didn't share — can never fire.
  for (const ci of core.groundTruth.contraindications) {
    if (!core.facts.some((f) => f.id === ci.factId)) {
      problems.push(`Contraindication references fact ${ci.factId}, which is in no channel`)
    }
  }

  // A tooth-indexed channel whose facts all point at ONE tooth hands over the
  // site for free.
  //
  // The design says RECORDS and IMAGING are *indexed by* tooth — they hold data
  // for several teeth and must be told which one matters. A generator that emits
  // findings only for the affected tooth produces a case where holding the chart
  // tells you the answer, nobody needs to ask CHAIR anything, and the opening
  // conversation never happens. The case still looks correct in review; it just
  // isn't a hidden-information case any more.
  for (const channel of ['RECORDS', 'IMAGING'] as const) {
    const teeth = new Set(
      core.facts.filter((f) => f.channel === channel && f.tooth !== null).map((f) => f.tooth),
    )
    if (teeth.size === 1) {
      problems.push(
        `Channel ${channel} holds tooth-indexed data for only ${[...teeth][0]} — ` +
          'it gives away the site, so no seat needs to ask which tooth is affected',
      )
    }
  }

  return { ok: problems.length === 0, problems }
}
