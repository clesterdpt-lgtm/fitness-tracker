import {
  compareDateInputs,
  formatDateInput,
  shiftDate,
} from './workload'

export type InjuryCaseStatus = 'active' | 'resolved'

export type InjuryBodyArea =
  | 'neck-shoulder'
  | 'elbow-hand'
  | 'back-core'
  | 'hip-glute'
  | 'knee'
  | 'ankle-foot'
  | 'other'

export type InjurySide = 'left' | 'right' | 'both' | 'center' | 'na'

export type InjuryCase = {
  id: string
  name: string
  bodyArea: InjuryBodyArea
  side: InjurySide
  onsetDate: string
  status: InjuryCaseStatus
  notes: string
  createdAt: string
  resolvedAt: string | null
}

export type InjuryCheckIn = {
  id: string
  injuryId: string
  date: string
  painAtRest: number
  painWithTraining: number
  confidenceToTrain: number
  modifiedTraining: boolean
  notes: string
  availabilityScore: number
  createdAt: string
}

export type InjuryDailyPoint = {
  date: string
  availabilityScore: number | null
  painAtRest: number | null
  painWithTraining: number | null
  confidenceToTrain: number | null
  modifiedTraining: boolean | null
  entry: InjuryCheckIn | null
}

export type InjuryBand = {
  label: string
  detail: string
  color: string
}

type InjuryInputs = Pick<
  InjuryCheckIn,
  'painAtRest' | 'painWithTraining' | 'confidenceToTrain' | 'modifiedTraining'
>

export const INJURY_BODY_AREA_OPTIONS: Array<{
  value: InjuryBodyArea
  label: string
}> = [
  { value: 'neck-shoulder', label: 'Neck / shoulder' },
  { value: 'elbow-hand', label: 'Elbow / wrist / hand' },
  { value: 'back-core', label: 'Back / trunk' },
  { value: 'hip-glute', label: 'Hip / glute' },
  { value: 'knee', label: 'Knee' },
  { value: 'ankle-foot', label: 'Ankle / foot' },
  { value: 'other', label: 'Other' },
]

export const INJURY_SIDE_OPTIONS: Array<{
  value: InjurySide
  label: string
}> = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both sides' },
  { value: 'center', label: 'Center / middle' },
  { value: 'na', label: 'Not side-specific' },
]

const INJURY_BODY_AREA_CONDITION_TAGS: Record<InjuryBodyArea, string[]> = {
  'neck-shoulder': ['shoulder_impingement', 'shoulder_labrum'],
  'elbow-hand': ['grip_issue'],
  'back-core': ['lumbar_disc'],
  'hip-glute': ['hip_flexor_strain'],
  knee: ['knee_pain'],
  'ankle-foot': [],
  other: [],
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizePain(value: number) {
  return clamp((10 - value) / 10, 0, 1)
}

function normalizeConfidence(value: number) {
  return clamp((value - 1) / 4, 0, 1)
}

export function calculateInjuryAvailabilityScore(inputs: InjuryInputs) {
  const total =
    normalizePain(inputs.painAtRest) * 0.24 +
    normalizePain(inputs.painWithTraining) * 0.38 +
    normalizeConfidence(inputs.confidenceToTrain) * 0.26 +
    (inputs.modifiedTraining ? 0.12 : 1) * 0.12

  return Math.round(total * 100)
}

export function getInjuryBand(score: number | null): InjuryBand {
  if (score === null) {
    return {
      label: 'No update yet',
      detail: 'Add a case update to track how much the issue is affecting training.',
      color: '#8b6c4a',
    }
  }

  if (score >= 80) {
    return {
      label: 'Available',
      detail: 'Symptoms look manageable enough for close-to-normal training.',
      color: '#2f7d69',
    }
  }

  if (score >= 60) {
    return {
      label: 'Manage',
      detail: 'Training is still on the table, but the issue needs some restraint.',
      color: '#4f7a86',
    }
  }

  if (score >= 40) {
    return {
      label: 'Limited',
      detail: 'The issue is changing how training should look today.',
      color: '#b56b21',
    }
  }

  return {
    label: 'Hold',
    detail: 'Symptoms are loud enough that training should stay very conservative.',
    color: '#b34732',
  }
}

export function sortInjuryCases(cases: InjuryCase[]) {
  return [...cases].toSorted((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'active' ? -1 : 1
    }

    return (
      compareDateInputs(right.onsetDate, left.onsetDate) ||
      right.createdAt.localeCompare(left.createdAt)
    )
  })
}

export function sortInjuryCheckIns(entries: InjuryCheckIn[]) {
  return [...entries].toSorted(
    (left, right) =>
      compareDateInputs(right.date, left.date) ||
      right.createdAt.localeCompare(left.createdAt),
  )
}

export function buildInjurySeries(
  entries: InjuryCheckIn[],
  injuryId: string | null,
  days = 14,
  endDate = formatDateInput(),
) {
  if (!injuryId) {
    return []
  }

  const byDate = new Map<string, InjuryCheckIn>()

  for (const entry of entries) {
    if (entry.injuryId !== injuryId) {
      continue
    }

    const current = byDate.get(entry.date)

    if (!current || current.createdAt < entry.createdAt) {
      byDate.set(entry.date, entry)
    }
  }

  const startDate = shiftDate(endDate, -(days - 1))
  const points: InjuryDailyPoint[] = []

  for (let index = 0; index < days; index += 1) {
    const date = shiftDate(startDate, index)
    const entry = byDate.get(date) ?? null

    points.push({
      date,
      availabilityScore: entry?.availabilityScore ?? null,
      painAtRest: entry?.painAtRest ?? null,
      painWithTraining: entry?.painWithTraining ?? null,
      confidenceToTrain: entry?.confidenceToTrain ?? null,
      modifiedTraining: entry?.modifiedTraining ?? null,
      entry,
    })
  }

  return points
}

export function getLatestInjuryCheckIn(
  entries: InjuryCheckIn[],
  injuryId?: string | null,
) {
  if (!injuryId) {
    return entries[0] ?? null
  }

  return entries.find((entry) => entry.injuryId === injuryId) ?? null
}

export function getInjuryAverage(
  entries: InjuryCheckIn[],
  days = 7,
  injuryId?: string | null,
) {
  const cutoff = shiftDate(formatDateInput(), -(days - 1))
  const recentEntries = entries.filter(
    (entry) =>
      compareDateInputs(entry.date, cutoff) >= 0 &&
      (injuryId ? entry.injuryId === injuryId : true),
  )

  if (!recentEntries.length) {
    return null
  }

  const total = recentEntries.reduce((sum, entry) => sum + entry.availabilityScore, 0)

  return Math.round(total / recentEntries.length)
}

export function getInjuryCheckInCount(
  entries: InjuryCheckIn[],
  days = 7,
  injuryId?: string | null,
) {
  const cutoff = shiftDate(formatDateInput(), -(days - 1))

  return entries.filter(
    (entry) =>
      compareDateInputs(entry.date, cutoff) >= 0 &&
      (injuryId ? entry.injuryId === injuryId : true),
  ).length
}

export function getActiveInjuryCount(cases: InjuryCase[]) {
  return cases.filter((injuryCase) => injuryCase.status === 'active').length
}

export function getActiveInjuryBodyAreas(cases: InjuryCase[]) {
  return Array.from(
    new Set(
      cases
        .filter((injuryCase) => injuryCase.status === 'active')
        .map((injuryCase) => injuryCase.bodyArea),
    ),
  )
}

export function getActiveInjuryConditionTags(cases: InjuryCase[]) {
  return Array.from(
    new Set(
      cases
        .filter((injuryCase) => injuryCase.status === 'active')
        .flatMap(
          (injuryCase) => INJURY_BODY_AREA_CONDITION_TAGS[injuryCase.bodyArea],
        ),
    ),
  )
}

export function getMostLimitingInjury(
  cases: InjuryCase[],
  entries: InjuryCheckIn[],
) {
  const activeCases = cases.filter((injuryCase) => injuryCase.status === 'active')

  if (!activeCases.length) {
    return null
  }

  const latestByCase = new Map<string, InjuryCheckIn>()

  for (const entry of entries) {
    if (!latestByCase.has(entry.injuryId)) {
      latestByCase.set(entry.injuryId, entry)
    }
  }

  let selectedCase = activeCases[0]
  let selectedCheckIn = latestByCase.get(selectedCase.id) ?? null
  let selectedScore = selectedCheckIn?.availabilityScore ?? 100

  for (const injuryCase of activeCases.slice(1)) {
    const latestCheckIn = latestByCase.get(injuryCase.id) ?? null
    const score = latestCheckIn?.availabilityScore ?? 100

    if (
      score < selectedScore ||
      (score === selectedScore &&
        latestCheckIn &&
        (!selectedCheckIn ||
          compareDateInputs(latestCheckIn.date, selectedCheckIn.date) > 0))
    ) {
      selectedCase = injuryCase
      selectedCheckIn = latestCheckIn
      selectedScore = score
    }
  }

  return {
    injuryCase: selectedCase,
    latestCheckIn: selectedCheckIn,
  }
}

export function createDemoInjuryCases(endDate = formatDateInput()) {
  return sortInjuryCases([
    {
      id: 'injury-demo-achilles',
      name: 'Achilles irritation',
      bodyArea: 'ankle-foot',
      side: 'right',
      onsetDate: shiftDate(endDate, -18),
      status: 'active',
      notes: 'Usually louder the day after faster running or hills.',
      createdAt: `${shiftDate(endDate, -18)}T07:00:00.000Z`,
      resolvedAt: null,
    },
    {
      id: 'injury-demo-shoulder',
      name: 'Shoulder irritation',
      bodyArea: 'neck-shoulder',
      side: 'left',
      onsetDate: shiftDate(endDate, -9),
      status: 'active',
      notes: 'Mostly shows up with pressing and overhead work.',
      createdAt: `${shiftDate(endDate, -9)}T07:05:00.000Z`,
      resolvedAt: null,
    },
    {
      id: 'injury-demo-back',
      name: 'Low-back flare',
      bodyArea: 'back-core',
      side: 'center',
      onsetDate: shiftDate(endDate, -34),
      status: 'resolved',
      notes: 'Settled after a lighter week and mobility work.',
      createdAt: `${shiftDate(endDate, -34)}T07:10:00.000Z`,
      resolvedAt: shiftDate(endDate, -12),
    },
  ])
}

export function createDemoInjuryCheckIns(
  cases: InjuryCase[],
  endDate = formatDateInput(),
) {
  const achillesCase = cases.find((injuryCase) => injuryCase.id === 'injury-demo-achilles')
  const shoulderCase = cases.find((injuryCase) => injuryCase.id === 'injury-demo-shoulder')
  const backCase = cases.find((injuryCase) => injuryCase.id === 'injury-demo-back')
  const entries: InjuryCheckIn[] = []

  if (achillesCase) {
    const painAtRestPattern = [2, 2, 1, 1, 1, 1, 2]
    const painWithTrainingPattern = [6, 5, 5, 4, 4, 3, 4]
    const confidencePattern = [2, 3, 3, 3, 4, 4, 3]
    const modifiedPattern = [true, true, true, true, false, false, true]

    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = shiftDate(endDate, -offset)
      const patternIndex = (13 - offset) % painAtRestPattern.length
      const painAtRest = painAtRestPattern[patternIndex]
      const painWithTraining = painWithTrainingPattern[patternIndex]
      const confidenceToTrain = confidencePattern[patternIndex]
      const modifiedTraining = modifiedPattern[patternIndex]

      entries.push({
        id: `injury-checkin-achilles-${date}`,
        injuryId: achillesCase.id,
        date,
        painAtRest,
        painWithTraining,
        confidenceToTrain,
        modifiedTraining,
        notes:
          modifiedTraining
            ? 'Kept the run easy and shortened the faster work.'
            : 'Handled the session without extra symptoms later.',
        availabilityScore: calculateInjuryAvailabilityScore({
          painAtRest,
          painWithTraining,
          confidenceToTrain,
          modifiedTraining,
        }),
        createdAt: `${date}T07:15:00.000Z`,
      })
    }
  }

  if (shoulderCase) {
    const painAtRestPattern = [1, 1, 2, 1, 1, 1, 0]
    const painWithTrainingPattern = [4, 4, 5, 4, 3, 3, 2]
    const confidencePattern = [3, 3, 2, 3, 4, 4, 4]
    const modifiedPattern = [true, true, true, false, false, false, false]

    for (let offset = 8; offset >= 0; offset -= 1) {
      const date = shiftDate(endDate, -offset)
      const patternIndex = (8 - offset) % painAtRestPattern.length
      const painAtRest = painAtRestPattern[patternIndex]
      const painWithTraining = painWithTrainingPattern[patternIndex]
      const confidenceToTrain = confidencePattern[patternIndex]
      const modifiedTraining = modifiedPattern[patternIndex]

      entries.push({
        id: `injury-checkin-shoulder-${date}`,
        injuryId: shoulderCase.id,
        date,
        painAtRest,
        painWithTraining,
        confidenceToTrain,
        modifiedTraining,
        notes:
          modifiedTraining
            ? 'Swapped pressing for rows and lighter support work.'
            : 'Upper-body work felt calmer than last week.',
        availabilityScore: calculateInjuryAvailabilityScore({
          painAtRest,
          painWithTraining,
          confidenceToTrain,
          modifiedTraining,
        }),
        createdAt: `${date}T07:20:00.000Z`,
      })
    }
  }

  if (backCase) {
    const painAtRestPattern = [3, 2, 1]
    const painWithTrainingPattern = [5, 4, 2]
    const confidencePattern = [2, 3, 4]
    const modifiedPattern = [true, true, false]

    for (let offset = 16; offset >= 14; offset -= 1) {
      const date = shiftDate(endDate, -offset)
      const patternIndex = 16 - offset
      const painAtRest = painAtRestPattern[patternIndex]
      const painWithTraining = painWithTrainingPattern[patternIndex]
      const confidenceToTrain = confidencePattern[patternIndex]
      const modifiedTraining = modifiedPattern[patternIndex]

      entries.push({
        id: `injury-checkin-back-${date}`,
        injuryId: backCase.id,
        date,
        painAtRest,
        painWithTraining,
        confidenceToTrain,
        modifiedTraining,
        notes: 'Symptoms faded as lifting intensity came down.',
        availabilityScore: calculateInjuryAvailabilityScore({
          painAtRest,
          painWithTraining,
          confidenceToTrain,
          modifiedTraining,
        }),
        createdAt: `${date}T07:25:00.000Z`,
      })
    }
  }

  return sortInjuryCheckIns(entries)
}
