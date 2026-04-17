export type WorkloadSession = {
  id: string
  title: string
  date: string
  duration: number | null
  rpe: number | null
  load: number
  notes: string
  createdAt: string
}

export type DailyLoadPoint = {
  date: string
  totalLoad: number
  sessionCount: number
  acuteLoad: number
  chronicLoad: number | null
  ratio: number | null
  baselineReady: boolean
}

export type RatioBand = {
  label: string
  detail: string
  color: string
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function parseDateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  return { year, month, day }
}

function toUtcMs(value: string) {
  const { year, month, day } = parseDateParts(value)

  return Date.UTC(year, month - 1, day)
}

function formatUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`
}

function sumWindow(points: DailyLoadPoint[], index: number, size: number) {
  let total = 0

  for (let cursor = Math.max(0, index - size + 1); cursor <= index; cursor += 1) {
    total += points[cursor].totalLoad
  }

  return total
}

function round(value: number, precision = 0) {
  const factor = 10 ** precision

  return Math.round(value * factor) / factor
}

export function formatDateInput(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function shiftDate(value: string, amount: number) {
  const date = new Date(toUtcMs(value))
  date.setUTCDate(date.getUTCDate() + amount)

  return formatUtcDate(date)
}

export function compareDateInputs(left: string, right: string) {
  return toUtcMs(left) - toUtcMs(right)
}

export function differenceInDays(start: string, end: string) {
  return Math.round((toUtcMs(end) - toUtcMs(start)) / DAY_IN_MS)
}

export function getWeekdayIndex(value: string) {
  return new Date(toUtcMs(value)).getUTCDay()
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(toUtcMs(value)))
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(toUtcMs(value)))
}

export function sortSessions(sessions: WorkloadSession[]) {
  return [...sessions].toSorted(
    (left, right) =>
      compareDateInputs(right.date, left.date) ||
      right.createdAt.localeCompare(left.createdAt),
  )
}

function getEarliestSessionDate(sessions: WorkloadSession[]) {
  return sessions.reduce(
    (earliest, session) =>
      compareDateInputs(session.date, earliest) < 0 ? session.date : earliest,
    sessions[0].date,
  )
}

export function getBaselineProgress(
  sessions: WorkloadSession[],
  endDate = formatDateInput(),
) {
  if (!sessions.length) {
    return 0
  }

  const earliestDate = getEarliestSessionDate(sessions)

  return Math.min(differenceInDays(earliestDate, endDate) + 1, 28)
}

export function buildDailyLoadSeries(
  sessions: WorkloadSession[],
  days = 56,
  endDate = formatDateInput(),
) {
  const totalsByDate = new Map<string, { totalLoad: number; sessionCount: number }>()

  for (const session of sessions) {
    const current = totalsByDate.get(session.date) ?? {
      totalLoad: 0,
      sessionCount: 0,
    }

    current.totalLoad += session.load
    current.sessionCount += 1
    totalsByDate.set(session.date, current)
  }

  const earliestDate = sessions.length ? getEarliestSessionDate(sessions) : null

  const startDate = shiftDate(endDate, -(days - 1))
  const points: DailyLoadPoint[] = []

  for (let index = 0; index < days; index += 1) {
    const date = shiftDate(startDate, index)
    const totals = totalsByDate.get(date) ?? { totalLoad: 0, sessionCount: 0 }

    points.push({
      date,
      totalLoad: round(totals.totalLoad),
      sessionCount: totals.sessionCount,
      acuteLoad: 0,
      chronicLoad: null,
      ratio: null,
      baselineReady: false,
    })
  }

  return points.map((point, index) => {
    const acuteLoad = round(sumWindow(points, index, 7))
    const baselineReady =
      earliestDate !== null && differenceInDays(earliestDate, point.date) >= 27
    const chronicWindowTotal = round(sumWindow(points, index, 28))
    const chronicLoad = baselineReady ? round(chronicWindowTotal / 4) : null
    const ratio =
      chronicLoad && chronicLoad > 0 ? round(acuteLoad / chronicLoad, 2) : null

    return {
      ...point,
      acuteLoad,
      chronicLoad,
      ratio,
      baselineReady,
    }
  })
}

export function getRatioBand(ratio: number | null, baselineReady: boolean) {
  if (!baselineReady || ratio === null) {
    return {
      label: 'Baseline building',
      detail: 'Collect 28 days of training before relying on the ratio.',
      color: '#8b6c4a',
    } satisfies RatioBand
  }

  if (ratio < 0.8) {
    return {
      label: 'Low load',
      detail: 'Current training is well below your rolling average.',
      color: '#4f7a86',
    } satisfies RatioBand
  }

  if (ratio <= 1.3) {
    return {
      label: 'Target zone',
      detail: 'Current load is tracking close to your recent baseline.',
      color: '#2f7d69',
    } satisfies RatioBand
  }

  if (ratio <= 1.5) {
    return {
      label: 'Caution',
      detail: 'Load is rising faster than the chronic baseline.',
      color: '#b56b21',
    } satisfies RatioBand
  }

  return {
    label: 'High spike',
    detail: 'Current load is far above the recent baseline.',
    color: '#b34732',
  } satisfies RatioBand
}

export function createSessionLoad(duration: number | null, rpe: number | null) {
  if (duration === null || rpe === null) {
    return null
  }

  return round(duration * rpe)
}

export function createDemoSessions(endDate = formatDateInput()) {
  const sessions: WorkloadSession[] = []
  const weeklyProgression = [0.92, 0.98, 1.02, 1.08, 1.04, 1.1]

  for (let offset = 41; offset >= 0; offset -= 1) {
    const date = shiftDate(endDate, -offset)
    const weekday = getWeekdayIndex(date)
    const weekIndex = Math.min(
      weeklyProgression.length - 1,
      Math.floor((41 - offset) / 7),
    )
    const progression = weeklyProgression[weekIndex]

    const addSession = (
      title: string,
      duration: number,
      rpe: number,
      notes = '',
    ) => {
      const adjustedDuration = round(duration * progression)
      const load = createSessionLoad(adjustedDuration, rpe) ?? 0

      sessions.push({
        id: `demo-${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        date,
        duration: adjustedDuration,
        rpe,
        load,
        notes,
        createdAt: `${date}T07:00:00.000Z`,
      })
    }

    if (weekday === 1) {
      addSession('Lower-body strength', 55, 6, 'Gym-based lower-body session')
    }

    if (weekday === 2) {
      addSession('Intervals', 46, 8, 'Short high-intensity run set')
    }

    if (weekday === 4) {
      addSession('Tempo session', 64, 7, 'Sustained threshold effort')
    }

    if (weekday === 5) {
      addSession('Mobility + lift', 42, 5, 'Lighter strength and range work')
    }

    if (weekday === 6) {
      addSession('Long run', 92 + weekIndex * 4, 6.5, 'Weekend aerobic anchor')
    }
  }

  return sortSessions(sessions)
}
