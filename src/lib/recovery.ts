import {
  compareDateInputs,
  formatDateInput,
  shiftDate,
} from './workload'

export type RecoveryEntry = {
  id: string
  date: string
  sleepHours: number
  hrv: number | null
  sleepQuality: number
  energy: number
  soreness: number
  stress: number
  hydration: number
  notes: string
  score: number
  createdAt: string
}

export type RecoveryDailyPoint = {
  date: string
  score: number | null
  sleepHours: number | null
  hrv: number | null
  entry: RecoveryEntry | null
}

export type RecoveryBand = {
  label: string
  detail: string
  color: string
}

type RecoveryInputs = Pick<
  RecoveryEntry,
  'sleepHours' | 'sleepQuality' | 'energy' | 'soreness' | 'stress' | 'hydration'
>

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeScale(value: number) {
  return clamp((value - 1) / 4, 0, 1)
}

function normalizeInverseScale(value: number) {
  return clamp((5 - value) / 4, 0, 1)
}

function normalizeSleepHours(hours: number) {
  return clamp(hours / 8.5, 0, 1)
}

export function calculateRecoveryScore(inputs: RecoveryInputs) {
  const total =
    normalizeSleepHours(inputs.sleepHours) * 0.28 +
    normalizeScale(inputs.sleepQuality) * 0.2 +
    normalizeScale(inputs.energy) * 0.2 +
    normalizeInverseScale(inputs.soreness) * 0.14 +
    normalizeInverseScale(inputs.stress) * 0.1 +
    normalizeScale(inputs.hydration) * 0.08

  return Math.round(total * 100)
}

export function getRecoveryBand(score: number | null): RecoveryBand {
  if (score === null) {
    return {
      label: 'No check-in yet',
      detail: 'Add a morning check-in to start building recovery context.',
      color: '#8b6c4a',
    }
  }

  if (score >= 80) {
    return {
      label: 'Ready',
      detail: 'Recovery markers look strong enough to tolerate normal training.',
      color: '#2f7d69',
    }
  }

  if (score >= 65) {
    return {
      label: 'Stable',
      detail: 'You look mostly recovered, but today may reward a little restraint.',
      color: '#4f7a86',
    }
  }

  if (score >= 50) {
    return {
      label: 'Watch',
      detail: 'Recovery is trending down. Consider trimming intensity or volume.',
      color: '#b56b21',
    }
  }

  return {
    label: 'Recover',
    detail: 'Markers are low enough that recovery should take priority today.',
    color: '#b34732',
  }
}

export function sortRecoveryEntries(entries: RecoveryEntry[]) {
  return [...entries].toSorted(
    (left, right) =>
      compareDateInputs(right.date, left.date) ||
      right.createdAt.localeCompare(left.createdAt),
  )
}

export function buildRecoverySeries(
  entries: RecoveryEntry[],
  days = 14,
  endDate = formatDateInput(),
) {
  const byDate = new Map<string, RecoveryEntry>()

  for (const entry of entries) {
    const current = byDate.get(entry.date)

    if (!current || current.createdAt < entry.createdAt) {
      byDate.set(entry.date, entry)
    }
  }

  const startDate = shiftDate(endDate, -(days - 1))
  const points: RecoveryDailyPoint[] = []

  for (let index = 0; index < days; index += 1) {
    const date = shiftDate(startDate, index)
    const entry = byDate.get(date) ?? null

    points.push({
      date,
      score: entry?.score ?? null,
      sleepHours: entry?.sleepHours ?? null,
      hrv: entry?.hrv ?? null,
      entry,
    })
  }

  return points
}

export function getRecoveryAverage(entries: RecoveryEntry[], days = 7) {
  const cutoff = shiftDate(formatDateInput(), -(days - 1))
  const recentEntries = entries.filter(
    (entry) => compareDateInputs(entry.date, cutoff) >= 0,
  )

  if (!recentEntries.length) {
    return null
  }

  const total = recentEntries.reduce((sum, entry) => sum + entry.score, 0)

  return Math.round(total / recentEntries.length)
}

export function getRecoveryCheckIns(entries: RecoveryEntry[], days = 7) {
  const cutoff = shiftDate(formatDateInput(), -(days - 1))

  return entries.filter((entry) => compareDateInputs(entry.date, cutoff) >= 0)
    .length
}

export function getRecoveryHrvAverage(entries: RecoveryEntry[], days = 7) {
  const cutoff = shiftDate(formatDateInput(), -(days - 1))
  const recentHrvEntries = entries.filter(
    (entry) =>
      compareDateInputs(entry.date, cutoff) >= 0 && entry.hrv !== null,
  )

  if (!recentHrvEntries.length) {
    return null
  }

  const total = recentHrvEntries.reduce((sum, entry) => sum + (entry.hrv ?? 0), 0)

  return Math.round(total / recentHrvEntries.length)
}

export function createDemoRecoveryEntries(endDate = formatDateInput()) {
  const sleepHoursPattern = [7.8, 8.2, 7.4, 6.9, 8.1, 7.6, 8.4]
  const hrvPattern = [58, 61, 56, 49, 57, 60, 63]
  const qualityPattern = [4, 5, 4, 3, 4, 4, 5]
  const energyPattern = [4, 5, 4, 3, 4, 4, 5]
  const sorenessPattern = [2, 2, 3, 4, 3, 2, 2]
  const stressPattern = [2, 2, 3, 4, 3, 2, 2]
  const hydrationPattern = [4, 4, 3, 3, 4, 4, 5]
  const entries: RecoveryEntry[] = []

  for (let offset = 17; offset >= 0; offset -= 1) {
    const date = shiftDate(endDate, -offset)
    const patternIndex = (17 - offset) % 7
    const score = calculateRecoveryScore({
      sleepHours: sleepHoursPattern[patternIndex],
      sleepQuality: qualityPattern[patternIndex],
      energy: energyPattern[patternIndex],
      soreness: sorenessPattern[patternIndex],
      stress: stressPattern[patternIndex],
      hydration: hydrationPattern[patternIndex],
    })

    entries.push({
      id: `recovery-demo-${date}`,
      date,
      sleepHours: sleepHoursPattern[patternIndex],
      hrv: hrvPattern[patternIndex],
      sleepQuality: qualityPattern[patternIndex],
      energy: energyPattern[patternIndex],
      soreness: sorenessPattern[patternIndex],
      stress: stressPattern[patternIndex],
      hydration: hydrationPattern[patternIndex],
      notes:
        patternIndex === 3
          ? 'Lower sleep after a heavier training block.'
          : 'Morning check-in looks consistent.',
      score,
      createdAt: `${date}T06:30:00.000Z`,
    })
  }

  return sortRecoveryEntries(entries)
}
