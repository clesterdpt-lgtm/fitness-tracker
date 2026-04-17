import {
  compareDateInputs,
  formatDateInput,
  shiftDate,
} from './workload'

export type NutritionTargets = {
  calories: number
  protein: number
  carbs: number
  fat: number
  hydration: number
}

export type NutritionEntry = {
  id: string
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
  hydration: number
  notes: string
  score: number
  createdAt: string
}

export type NutritionDailyPoint = {
  date: string
  calories: number | null
  score: number | null
  protein: number | null
  hydration: number | null
  entry: NutritionEntry | null
}

export type NutritionBand = {
  label: string
  detail: string
  color: string
}

type NutritionInputs = Pick<
  NutritionEntry,
  'calories' | 'protein' | 'carbs' | 'fat' | 'hydration'
>

export const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
  calories: 2400,
  protein: 180,
  carbs: 260,
  fat: 75,
  hydration: 3,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function scoreAgainstTarget(actual: number, target: number, tolerance = 0.35) {
  return clamp(1 - Math.abs(actual - target) / (target * tolerance), 0, 1)
}

function scoreAgainstMinimum(actual: number, target: number) {
  return clamp(actual / target, 0, 1)
}

export function calculateNutritionScore(
  inputs: NutritionInputs,
  targets: NutritionTargets,
) {
  const total =
    scoreAgainstTarget(inputs.calories, targets.calories, 0.3) * 0.35 +
    scoreAgainstMinimum(inputs.protein, targets.protein) * 0.3 +
    scoreAgainstTarget(inputs.carbs, targets.carbs, 0.4) * 0.15 +
    scoreAgainstTarget(inputs.fat, targets.fat, 0.4) * 0.1 +
    scoreAgainstMinimum(inputs.hydration, targets.hydration) * 0.1

  return Math.round(total * 100)
}

export function getNutritionBand(score: number | null): NutritionBand {
  if (score === null) {
    return {
      label: 'No log yet',
      detail: 'Add a nutrition day to start tracking intake against your targets.',
      color: '#8b6c4a',
    }
  }

  if (score >= 85) {
    return {
      label: 'On target',
      detail: 'Calories, macros, and hydration are tracking close to plan.',
      color: '#2f7d69',
    }
  }

  if (score >= 70) {
    return {
      label: 'Close',
      detail: 'Most targets are being met, with a little room to tighten up.',
      color: '#4f7a86',
    }
  }

  if (score >= 55) {
    return {
      label: 'Mixed day',
      detail: 'Some core targets slipped enough to be worth reviewing.',
      color: '#b56b21',
    }
  }

  return {
    label: 'Off target',
    detail: 'Intake is far enough from plan that recovery or fueling may suffer.',
    color: '#b34732',
  }
}

export function sortNutritionEntries(entries: NutritionEntry[]) {
  return [...entries].toSorted(
    (left, right) =>
      compareDateInputs(right.date, left.date) ||
      right.createdAt.localeCompare(left.createdAt),
  )
}

export function buildNutritionSeries(
  entries: NutritionEntry[],
  days = 14,
  endDate = formatDateInput(),
) {
  const byDate = new Map<string, NutritionEntry>()

  for (const entry of entries) {
    const current = byDate.get(entry.date)

    if (!current || current.createdAt < entry.createdAt) {
      byDate.set(entry.date, entry)
    }
  }

  const startDate = shiftDate(endDate, -(days - 1))
  const points: NutritionDailyPoint[] = []

  for (let index = 0; index < days; index += 1) {
    const date = shiftDate(startDate, index)
    const entry = byDate.get(date) ?? null

    points.push({
      date,
      calories: entry?.calories ?? null,
      score: entry?.score ?? null,
      protein: entry?.protein ?? null,
      hydration: entry?.hydration ?? null,
      entry,
    })
  }

  return points
}

export function getNutritionAverage(entries: NutritionEntry[], days = 7) {
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

export function getNutritionAverageCalories(entries: NutritionEntry[], days = 7) {
  const cutoff = shiftDate(formatDateInput(), -(days - 1))
  const recentEntries = entries.filter(
    (entry) => compareDateInputs(entry.date, cutoff) >= 0,
  )

  if (!recentEntries.length) {
    return null
  }

  const total = recentEntries.reduce((sum, entry) => sum + entry.calories, 0)

  return Math.round(total / recentEntries.length)
}

export function getNutritionLogCount(entries: NutritionEntry[], days = 7) {
  const cutoff = shiftDate(formatDateInput(), -(days - 1))

  return entries.filter((entry) => compareDateInputs(entry.date, cutoff) >= 0)
    .length
}

export function createDemoNutritionEntries(
  targets: NutritionTargets = DEFAULT_NUTRITION_TARGETS,
  endDate = formatDateInput(),
) {
  const caloriePattern = [0.94, 1.02, 0.98, 1.08, 0.89, 1.01, 0.96]
  const proteinPattern = [0.98, 1.04, 1.02, 0.95, 0.9, 1.01, 0.97]
  const carbsPattern = [0.92, 1.06, 0.99, 1.1, 0.86, 1.02, 0.95]
  const fatPattern = [0.94, 1.01, 0.97, 1.08, 0.91, 1.03, 0.96]
  const hydrationPattern = [0.95, 1.02, 1.04, 0.88, 0.82, 1.05, 0.98]
  const entries: NutritionEntry[] = []

  for (let offset = 17; offset >= 0; offset -= 1) {
    const date = shiftDate(endDate, -offset)
    const patternIndex = (17 - offset) % 7
    const calories = Math.round(targets.calories * caloriePattern[patternIndex])
    const protein = Math.round(targets.protein * proteinPattern[patternIndex])
    const carbs = Math.round(targets.carbs * carbsPattern[patternIndex])
    const fat = Math.round(targets.fat * fatPattern[patternIndex])
    const hydration = Math.round(targets.hydration * hydrationPattern[patternIndex] * 10) / 10

    entries.push({
      id: `nutrition-demo-${date}`,
      date,
      calories,
      protein,
      carbs,
      fat,
      hydration,
      notes:
        patternIndex === 4
          ? 'Lower intake on a lighter or busier day.'
          : 'Daily intake tracked against target.',
      score: calculateNutritionScore(
        { calories, protein, carbs, fat, hydration },
        targets,
      ),
      createdAt: `${date}T19:30:00.000Z`,
    })
  }

  return sortNutritionEntries(entries)
}
