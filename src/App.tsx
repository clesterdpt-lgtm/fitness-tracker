import {
  type CSSProperties,
  type FormEvent,
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from 'react'
import './App.css'
import {
  buildNutritionSeries,
  calculateNutritionScore,
  createDemoNutritionEntries,
  DEFAULT_NUTRITION_TARGETS,
  getNutritionAverage,
  getNutritionAverageCalories,
  getNutritionBand,
  getNutritionLogCount,
  sortNutritionEntries,
  type NutritionBand,
  type NutritionDailyPoint,
  type NutritionEntry,
  type NutritionTargets,
} from './lib/nutrition'
import {
  buildRecoverySeries,
  calculateRecoveryScore,
  createDemoRecoveryEntries,
  getRecoveryAverage,
  getRecoveryBand,
  getRecoveryCheckIns,
  getRecoveryHrvAverage,
  sortRecoveryEntries,
  type RecoveryBand,
  type RecoveryDailyPoint,
  type RecoveryEntry,
} from './lib/recovery'
import {
  buildWorkoutGeneratorPlan,
  createWorkoutSuggestionVariation,
  swapWorkoutSuggestionExercise,
  type CustomHomeEquipment,
  type HomeEquipmentCategory,
  type HomeEquipmentId,
  type WorkoutGeneratorInput,
  type WorkoutGeneratorGoal,
  type WorkoutGeneratorMode,
  type WorkoutGeneratorPlan,
  type WorkoutSuggestion,
} from './lib/workoutGenerator'
import {
  buildDailyLoadSeries,
  createDemoSessions,
  createSessionLoad,
  formatDateInput,
  formatLongDate,
  formatShortDate,
  getBaselineProgress,
  getRatioBand,
  sortSessions,
  type DailyLoadPoint,
  type RatioBand,
  type WorkloadSession,
} from './lib/workload'

type SessionFormState = {
  title: string
  date: string
  duration: string
  rpe: string
  loadOverride: string
  notes: string
}

type RecoveryMetricFieldKey =
  | 'sleepQuality'
  | 'energy'
  | 'soreness'
  | 'stress'
  | 'hydration'

type RecoveryFormState = {
  date: string
  sleepHours: string
  hrv: string
  sleepQuality: string
  energy: string
  soreness: string
  stress: string
  hydration: string
  notes: string
}

type NutritionFormState = {
  date: string
  calories: string
  protein: string
  carbs: string
  fat: string
  hydration: string
  notes: string
}

type NutritionTargetsFormState = {
  calories: string
  protein: string
  carbs: string
  fat: string
  hydration: string
}

type CustomHomeEquipmentFormState = {
  name: string
  category: HomeEquipmentCategory
}

type WorkoutGeneratorFormState = {
  date: string
  goal: WorkoutGeneratorGoal
  mode: WorkoutGeneratorMode
  availableMinutes: string
}

type WorkoutSuggestionOverrides = Partial<
  Record<WorkoutSuggestion['id'], WorkoutSuggestion>
>

type WorkoutSuggestionOverrideState = {
  contextKey: string
  suggestions: WorkoutSuggestionOverrides
}

type AppSectionId =
  | 'dashboard'
  | 'workload'
  | 'recovery'
  | 'workout-generator'
  | 'nutrition'
  | 'settings'

type AppSection = {
  id: AppSectionId
  label: string
  eyebrow: string
  summary: string
  badge: string
}

type RecoveryMetricConfig = {
  field: RecoveryMetricFieldKey
  label: string
  hint: string
  low: string
  high: string
}

const WORKLOAD_STORAGE_KEY = 'fitness-tracker.acwr.v1'
const RECOVERY_STORAGE_KEY = 'fitness-tracker.recovery.v1'
const NUTRITION_STORAGE_KEY = 'fitness-tracker.nutrition.v1'
const NUTRITION_TARGETS_STORAGE_KEY = 'fitness-tracker.nutrition-targets.v1'
const HOME_EQUIPMENT_STORAGE_KEY = 'fitness-tracker.home-equipment.v1'
const CUSTOM_HOME_EQUIPMENT_STORAGE_KEY = 'fitness-tracker.custom-home-equipment.v1'
const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})
const sleepHoursFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const hydrationFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const APP_SECTIONS: AppSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    eyebrow: 'Live workspace',
    summary: 'Daily snapshot across workload, recovery, and nutrition.',
    badge: 'Live',
  },
  {
    id: 'workload',
    label: 'Workload',
    eyebrow: 'Live workspace',
    summary: 'ACWR tracking, recent load, and session logging.',
    badge: 'Live',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    eyebrow: 'Live workspace',
    summary: 'Morning check-ins, readiness score, and recovery trends.',
    badge: 'Live',
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    eyebrow: 'Live workspace',
    summary: 'Daily targets, intake logging, and nutrition trend summaries.',
    badge: 'Live',
  },
]
const WORKOUT_GOAL_OPTIONS: Array<{
  value: WorkoutGeneratorGoal
  label: string
  summary: string
}> = [
  {
    value: 'endurance',
    label: 'Endurance',
    summary: 'Build aerobic work without overshooting the day.',
  },
  {
    value: 'speed',
    label: 'Speed',
    summary: 'Use structured quality work when readiness supports it.',
  },
  {
    value: 'strength',
    label: 'Strength',
    summary: 'Bias the session toward force production and support work.',
  },
  {
    value: 'recovery',
    label: 'Recovery',
    summary: 'Use the day to absorb training and restore energy.',
  },
]
const WORKOUT_MODE_OPTIONS: Array<{
  value: WorkoutGeneratorMode
  label: string
  summary: string
}> = [
  {
    value: 'run',
    label: 'Run',
    summary: 'Build the day around running.',
  },
  {
    value: 'bike',
    label: 'Bike',
    summary: 'Use the bike as the main training tool.',
  },
  {
    value: 'gym',
    label: 'Gym',
    summary: 'Train indoors with weights, circuits, or machines.',
  },
  {
    value: 'mixed',
    label: 'Mixed',
    summary: 'Blend cardio, bodyweight, and strength support.',
  },
  {
    value: 'home',
    label: 'Home',
    summary: 'Build a home session from your available equipment.',
  },
]
const HOME_EQUIPMENT_CATEGORY_OPTIONS: Array<{
  value: HomeEquipmentCategory
  label: string
  summary: string
}> = [
  {
    value: 'cardio',
    label: 'Cardio',
    summary: 'Aerobic and conditioning tools for easy work or intervals.',
  },
  {
    value: 'free-weights',
    label: 'Free Weights',
    summary: 'Dumbbells, kettlebells, and other loaded implements.',
  },
  {
    value: 'strength-setup',
    label: 'Strength Setup',
    summary: 'Benches, bars, racks, and home strength stations.',
  },
  {
    value: 'pulling-suspension',
    label: 'Pulling & Suspension',
    summary: 'Bands, pull-up stations, and suspension options.',
  },
  {
    value: 'power-conditioning',
    label: 'Power & Conditioning',
    summary: 'Tools for faster work, carries, and athletic circuits.',
  },
  {
    value: 'mobility-recovery',
    label: 'Mobility & Recovery',
    summary: 'Tools that support warm-ups, resets, and tissue work.',
  },
]
const HOME_EQUIPMENT_OPTIONS: Array<{
  value: HomeEquipmentId
  label: string
  summary: string
  category: HomeEquipmentCategory
}> = [
  {
    value: 'treadmill',
    label: 'Treadmill',
    summary: 'Walk, run, incline work, and easy aerobic flush sessions.',
    category: 'cardio',
  },
  {
    value: 'exercise-bike',
    label: 'Exercise bike',
    summary: 'Low-impact aerobic work and controlled intervals.',
    category: 'cardio',
  },
  {
    value: 'rower',
    label: 'Rower',
    summary: 'Short powerful intervals or steady conditioning blocks.',
    category: 'cardio',
  },
  {
    value: 'elliptical',
    label: 'Elliptical',
    summary: 'A low-impact cardio option for steady aerobic work.',
    category: 'cardio',
  },
  {
    value: 'jump-rope',
    label: 'Jump rope',
    summary: 'Compact cardio and rhythm work for small spaces.',
    category: 'cardio',
  },
  {
    value: 'dumbbells',
    label: 'Dumbbells',
    summary: 'Primary option for loaded lower, upper, and trunk strength work.',
    category: 'free-weights',
  },
  {
    value: 'kettlebell',
    label: 'Kettlebell',
    summary: 'Great for swings, squats, carries, and conditioning circuits.',
    category: 'free-weights',
  },
  {
    value: 'bench',
    label: 'Bench',
    summary: 'Useful for presses, rows, split squats, and step-ups.',
    category: 'strength-setup',
  },
  {
    value: 'barbell',
    label: 'Barbell',
    summary: 'Adds heavier hinge, squat, and press patterns at home.',
    category: 'strength-setup',
  },
  {
    value: 'squat-rack',
    label: 'Squat rack',
    summary: 'Makes barbell squats, presses, and rack-based variations possible.',
    category: 'strength-setup',
  },
  {
    value: 'resistance-bands',
    label: 'Resistance bands',
    summary: 'Add pulling, pressing, warm-up, and trunk work without large equipment.',
    category: 'pulling-suspension',
  },
  {
    value: 'pull-up-bar',
    label: 'Pull-up bar',
    summary: 'Gives the generator a simple vertical pulling option.',
    category: 'pulling-suspension',
  },
  {
    value: 'suspension-trainer',
    label: 'Suspension trainer',
    summary: 'Adds scalable rows, presses, and trunk stability work.',
    category: 'pulling-suspension',
  },
  {
    value: 'medicine-ball',
    label: 'Medicine ball',
    summary: 'Useful for throws, slams, and rotational power work.',
    category: 'power-conditioning',
  },
  {
    value: 'weighted-vest',
    label: 'Weighted vest',
    summary: 'Adds load to carries, split squats, step-ups, and conditioning.',
    category: 'power-conditioning',
  },
  {
    value: 'yoga-mat',
    label: 'Yoga mat',
    summary: 'Useful for floor work, mobility flows, and trunk resets.',
    category: 'mobility-recovery',
  },
  {
    value: 'foam-roller',
    label: 'Foam roller',
    summary: 'A simple recovery tool for tissue work and warm-up prep.',
    category: 'mobility-recovery',
  },
]
const RECOVERY_METRICS: RecoveryMetricConfig[] = [
  {
    field: 'sleepQuality',
    label: 'Sleep quality',
    hint: 'How well did you actually sleep?',
    low: 'restless',
    high: 'deep',
  },
  {
    field: 'energy',
    label: 'Energy',
    hint: 'How ready do you feel to train?',
    low: 'flat',
    high: 'sharp',
  },
  {
    field: 'soreness',
    label: 'Soreness',
    hint: 'How much muscle soreness are you carrying?',
    low: 'fresh',
    high: 'very sore',
  },
  {
    field: 'stress',
    label: 'Stress',
    hint: 'How loaded does today feel outside training?',
    low: 'calm',
    high: 'overloaded',
  },
  {
    field: 'hydration',
    label: 'Hydration',
    hint: 'How well hydrated do you feel this morning?',
    low: 'poor',
    high: 'excellent',
  },
]

function createEmptyFormState(date = formatDateInput()): SessionFormState {
  return {
    title: '',
    date,
    duration: '60',
    rpe: '5',
    loadOverride: '',
    notes: '',
  }
}

function createEmptyRecoveryFormState(date = formatDateInput()): RecoveryFormState {
  return {
    date,
    sleepHours: '7.5',
    hrv: '',
    sleepQuality: '3',
    energy: '3',
    soreness: '2',
    stress: '2',
    hydration: '3',
    notes: '',
  }
}

function createEmptyNutritionFormState(date = formatDateInput()): NutritionFormState {
  return {
    date,
    calories: '2400',
    protein: '180',
    carbs: '260',
    fat: '75',
    hydration: '3.0',
    notes: '',
  }
}

function createEmptyWorkoutGeneratorFormState(
  date = formatDateInput(),
): WorkoutGeneratorFormState {
  return {
    date,
    goal: 'endurance',
    mode: 'run',
    availableMinutes: '45',
  }
}

function createNutritionTargetsFormState(
  targets: NutritionTargets = DEFAULT_NUTRITION_TARGETS,
): NutritionTargetsFormState {
  return {
    calories: `${targets.calories}`,
    protein: `${targets.protein}`,
    carbs: `${targets.carbs}`,
    fat: `${targets.fat}`,
    hydration: `${targets.hydration}`,
  }
}

function createEmptyCustomHomeEquipmentFormState(): CustomHomeEquipmentFormState {
  return {
    name: '',
    category: HOME_EQUIPMENT_CATEGORY_OPTIONS[0].value,
  }
}

function parsePositiveNumber(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseScaleNumber(value: string) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return Math.min(5, Math.max(1, Math.round(parsed)))
}

function formatLoad(value: number | null) {
  return value === null ? 'Not ready' : numberFormatter.format(value)
}

function formatRatio(value: number | null) {
  return value === null ? '--' : value.toFixed(2)
}

function formatRecoveryScore(value: number | null) {
  return value === null ? '--' : numberFormatter.format(value)
}

function formatSleepHours(value: number | null) {
  return value === null ? '--' : `${sleepHoursFormatter.format(value)} h`
}

function formatHrv(value: number | null) {
  return value === null ? '--' : `${numberFormatter.format(value)} ms`
}

function formatCalories(value: number | null) {
  return value === null ? '--' : `${numberFormatter.format(value)} kcal`
}

function formatGrams(value: number | null) {
  return value === null ? '--' : `${numberFormatter.format(value)} g`
}

function formatHydration(value: number | null) {
  return value === null ? '--' : `${hydrationFormatter.format(value)} L`
}

function formatMinutes(value: number | null) {
  return value === null ? '--' : `${numberFormatter.format(value)} min`
}

function formatRpe(value: number | null) {
  if (value === null) {
    return '--'
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function formatNutritionScore(value: number | null) {
  return value === null ? '--' : numberFormatter.format(value)
}

function getWorkoutGoalOption(goal: WorkoutGeneratorGoal) {
  return (
    WORKOUT_GOAL_OPTIONS.find((option) => option.value === goal) ??
    WORKOUT_GOAL_OPTIONS[0]
  )
}

function getWorkoutModeOption(mode: WorkoutGeneratorMode) {
  return (
    WORKOUT_MODE_OPTIONS.find((option) => option.value === mode) ??
    WORKOUT_MODE_OPTIONS[0]
  )
}

function getHomeEquipmentOption(equipmentId: HomeEquipmentId) {
  return (
    HOME_EQUIPMENT_OPTIONS.find((option) => option.value === equipmentId) ??
    HOME_EQUIPMENT_OPTIONS[0]
  )
}

function getHomeEquipmentCategoryOption(category: HomeEquipmentCategory) {
  return (
    HOME_EQUIPMENT_CATEGORY_OPTIONS.find((option) => option.value === category) ??
    HOME_EQUIPMENT_CATEGORY_OPTIONS[0]
  )
}

function createEntryId(prefix: string) {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}`
}

function isStoredSession(value: unknown): value is WorkloadSession {
  if (!value || typeof value !== 'object') {
    return false
  }

  const session = value as Record<string, unknown>

  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    typeof session.date === 'string' &&
    typeof session.load === 'number' &&
    typeof session.createdAt === 'string'
  )
}

function isStoredRecoveryEntry(value: unknown): value is RecoveryEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const entry = value as Record<string, unknown>

  return (
    typeof entry.id === 'string' &&
    typeof entry.date === 'string' &&
    typeof entry.sleepHours === 'number' &&
    (typeof entry.hrv === 'number' ||
      entry.hrv === null ||
      typeof entry.hrv === 'undefined') &&
    typeof entry.sleepQuality === 'number' &&
    typeof entry.energy === 'number' &&
    typeof entry.soreness === 'number' &&
    typeof entry.stress === 'number' &&
    typeof entry.hydration === 'number' &&
    typeof entry.score === 'number' &&
    typeof entry.createdAt === 'string'
  )
}

function isStoredNutritionEntry(value: unknown): value is NutritionEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const entry = value as Record<string, unknown>

  return (
    typeof entry.id === 'string' &&
    typeof entry.date === 'string' &&
    typeof entry.calories === 'number' &&
    typeof entry.protein === 'number' &&
    typeof entry.carbs === 'number' &&
    typeof entry.fat === 'number' &&
    typeof entry.hydration === 'number' &&
    typeof entry.score === 'number' &&
    typeof entry.createdAt === 'string'
  )
}

function isStoredNutritionTargets(value: unknown): value is NutritionTargets {
  if (!value || typeof value !== 'object') {
    return false
  }

  const targets = value as Record<string, unknown>

  return (
    typeof targets.calories === 'number' &&
    typeof targets.protein === 'number' &&
    typeof targets.carbs === 'number' &&
    typeof targets.fat === 'number' &&
    typeof targets.hydration === 'number'
  )
}

function isStoredHomeEquipmentId(value: unknown): value is HomeEquipmentId {
  return (
    typeof value === 'string' &&
    HOME_EQUIPMENT_OPTIONS.some((option) => option.value === value)
  )
}

function isStoredHomeEquipmentCategory(
  value: unknown,
): value is HomeEquipmentCategory {
  return (
    typeof value === 'string' &&
    HOME_EQUIPMENT_CATEGORY_OPTIONS.some((option) => option.value === value)
  )
}

function isStoredCustomHomeEquipment(
  value: unknown,
): value is CustomHomeEquipment {
  if (!value || typeof value !== 'object') {
    return false
  }

  const equipment = value as Record<string, unknown>

  return (
    typeof equipment.id === 'string' &&
    typeof equipment.name === 'string' &&
    isStoredHomeEquipmentCategory(equipment.category)
  )
}

function sortHomeEquipmentSelection(selection: HomeEquipmentId[]) {
  return HOME_EQUIPMENT_OPTIONS.flatMap((option) =>
    selection.includes(option.value) ? [option.value] : [],
  )
}

function loadStoredSessions() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(WORKLOAD_STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return sortSessions(
      parsed.filter(isStoredSession).map((session) => ({
        ...session,
        duration: typeof session.duration === 'number' ? session.duration : null,
        rpe: typeof session.rpe === 'number' ? session.rpe : null,
        notes: typeof session.notes === 'string' ? session.notes : '',
      })),
    )
  } catch {
    return []
  }
}

function loadStoredRecoveryEntries() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(RECOVERY_STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return sortRecoveryEntries(
      parsed.filter(isStoredRecoveryEntry).map((entry) => ({
        ...entry,
        hrv: typeof entry.hrv === 'number' ? entry.hrv : null,
        notes: typeof entry.notes === 'string' ? entry.notes : '',
      })),
    )
  } catch {
    return []
  }
}

function loadStoredNutritionEntries() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(NUTRITION_STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return sortNutritionEntries(
      parsed.filter(isStoredNutritionEntry).map((entry) => ({
        ...entry,
        notes: typeof entry.notes === 'string' ? entry.notes : '',
      })),
    )
  } catch {
    return []
  }
}

function loadStoredNutritionTargets() {
  if (typeof window === 'undefined') {
    return DEFAULT_NUTRITION_TARGETS
  }

  try {
    const raw = window.localStorage.getItem(NUTRITION_TARGETS_STORAGE_KEY)

    if (!raw) {
      return DEFAULT_NUTRITION_TARGETS
    }

    const parsed = JSON.parse(raw)

    return isStoredNutritionTargets(parsed)
      ? parsed
      : DEFAULT_NUTRITION_TARGETS
  } catch {
    return DEFAULT_NUTRITION_TARGETS
  }
}

function loadStoredHomeEquipment() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(HOME_EQUIPMENT_STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return sortHomeEquipmentSelection(parsed.filter(isStoredHomeEquipmentId))
  } catch {
    return []
  }
}

function loadStoredCustomHomeEquipment() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_HOME_EQUIPMENT_STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter(isStoredCustomHomeEquipment)
      .map((equipment) => ({
        id: equipment.id,
        name: equipment.name.trim(),
        category: equipment.category,
      }))
      .filter((equipment) => equipment.name)
  } catch {
    return []
  }
}

function getTotalHomeEquipmentCount(
  homeEquipment: HomeEquipmentId[],
  customHomeEquipment: CustomHomeEquipment[],
) {
  return homeEquipment.length + customHomeEquipment.length
}

function formatHomeEquipmentSummary(
  homeEquipment: HomeEquipmentId[],
  customHomeEquipment: CustomHomeEquipment[],
) {
  const presetLabels = homeEquipment.map(
    (equipmentId) => getHomeEquipmentOption(equipmentId).label,
  )
  const customLabels = customHomeEquipment.map((equipment) => equipment.name)
  const labels = [...presetLabels, ...customLabels]

  if (!labels.length) {
    return 'Bodyweight only'
  }

  return labels.join(', ')
}

function buildRatioPath(points: DailyLoadPoint[], maxRatio: number) {
  let path = ''

  points.forEach((point, index) => {
    if (point.ratio === null) {
      return
    }

    const x = (index / Math.max(1, points.length - 1)) * 100
    const y = 100 - (Math.min(point.ratio, maxRatio) / maxRatio) * 100

    path += path ? ` L ${x} ${y}` : `M ${x} ${y}`
  })

  return path
}

function buildBarPath(points: DailyLoadPoint[], maxLoad: number) {
  return points.map((point, index) => ({
    x: (index / Math.max(1, points.length)) * 100 + 0.4,
    width: 100 / Math.max(1, points.length) - 0.8,
    height: (point.totalLoad / maxLoad) * 100,
  }))
}

function buildRecoveryPath(points: RecoveryDailyPoint[]) {
  let path = ''

  points.forEach((point, index) => {
    if (point.score === null) {
      return
    }

    const x = (index / Math.max(1, points.length - 1)) * 100
    const y = 100 - point.score

    path += path ? ` L ${x} ${y}` : `M ${x} ${y}`
  })

  return path
}

function buildRecoverySleepBars(points: RecoveryDailyPoint[], maxHours: number) {
  return points.map((point, index) => ({
    x: (index / Math.max(1, points.length)) * 100 + 0.5,
    width: 100 / Math.max(1, points.length) - 1,
    height: ((point.sleepHours ?? 0) / maxHours) * 100,
  }))
}

function buildHrvPath(points: RecoveryDailyPoint[], minHrv: number, maxHrv: number) {
  let path = ''
  const range = Math.max(1, maxHrv - minHrv)

  points.forEach((point, index) => {
    if (point.hrv === null) {
      return
    }

    const x = (index / Math.max(1, points.length - 1)) * 100
    const y = 100 - ((point.hrv - minHrv) / range) * 100

    path += path ? ` L ${x} ${y}` : `M ${x} ${y}`
  })

  return path
}

function buildHrvDots(points: RecoveryDailyPoint[], minHrv: number, maxHrv: number) {
  const range = Math.max(1, maxHrv - minHrv)

  return points.flatMap((point, index) => {
    if (point.hrv === null) {
      return []
    }

    return [
      {
        date: point.date,
        value: point.hrv,
        x: (index / Math.max(1, points.length - 1)) * 100,
        y: 100 - ((point.hrv - minHrv) / range) * 100,
      },
    ]
  })
}

function buildNutritionScorePath(points: NutritionDailyPoint[]) {
  let path = ''

  points.forEach((point, index) => {
    if (point.score === null) {
      return
    }

    const x = (index / Math.max(1, points.length - 1)) * 100
    const y = 100 - point.score

    path += path ? ` L ${x} ${y}` : `M ${x} ${y}`
  })

  return path
}

function buildNutritionCalorieBars(
  points: NutritionDailyPoint[],
  maxCalories: number,
) {
  return points.map((point, index) => ({
    x: (index / Math.max(1, points.length)) * 100 + 0.5,
    width: 100 / Math.max(1, points.length) - 1,
    height: (((point.calories ?? 0) / maxCalories) * 100),
  }))
}

function getNutritionSummary(
  score: number | null,
  average: number | null,
  band: NutritionBand,
) {
  if (score === null) {
    return 'Add your first nutrition day to compare intake against daily targets.'
  }

  if (average === null) {
    return `${band.label}. Build a few nutrition days to create a short-term trend.`
  }

  const delta = score - average

  if (Math.abs(delta) <= 3) {
    return 'Today is tracking almost exactly with your 7-day nutrition average.'
  }

  if (delta > 0) {
    return `${band.label} because today is ${delta} points above your 7-day average.`
  }

  return `${band.label} because today is ${Math.abs(delta)} points below your 7-day average.`
}

function getRatioSummary(
  ratio: number | null,
  band: RatioBand,
  baselineProgress: number,
) {
  if (ratio === null) {
    return `${baselineProgress}/28 days collected. Keep logging sessions to build a four-week baseline.`
  }

  const delta = Math.round((ratio - 1) * 100)

  if (Math.abs(delta) <= 4) {
    return 'This week is almost identical to your rolling four-week average.'
  }

  if (delta > 0) {
    return `${band.label} because this week is ${delta}% above your rolling average.`
  }

  return `${band.label} because this week is ${Math.abs(delta)}% below your rolling average.`
}

function getRecoverySummary(score: number | null, average: number | null, band: RecoveryBand) {
  if (score === null) {
    return 'Add your first morning check-in to start tracking recovery readiness.'
  }

  if (average === null) {
    return `${band.label}. Build a few days of recovery data to create a short-term trend.`
  }

  const delta = score - average

  if (Math.abs(delta) <= 3) {
    return 'Today is tracking almost exactly with your 7-day recovery average.'
  }

  if (delta > 0) {
    return `${band.label} because today is ${delta} points above your 7-day average.`
  }

  return `${band.label} because today is ${Math.abs(delta)} points below your 7-day average.`
}

function RatioDial({
  ratio,
  baselineReady,
  baselineProgress,
  band,
}: {
  ratio: number | null
  baselineReady: boolean
  baselineProgress: number
  band: RatioBand
}) {
  const radius = 82
  const circumference = 2 * Math.PI * radius
  const displayValue = baselineReady && ratio !== null ? Math.min(ratio, 1.8) : 0
  const progress = baselineReady
    ? Math.max(0.08, displayValue / 1.8)
    : Math.max(0.05, baselineProgress / 28)
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="ratio-dial">
      <svg viewBox="0 0 200 200" className="ratio-dial-graphic" aria-hidden="true">
        <circle className="ratio-dial-track" cx="100" cy="100" r={radius} />
        <circle
          className="ratio-dial-progress"
          cx="100"
          cy="100"
          r={radius}
          stroke={band.color}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="ratio-dial-copy">
        <span className="ratio-dial-value">
          {baselineReady ? formatRatio(ratio) : `${baselineProgress}/28`}
        </span>
        <span className="ratio-dial-label">
          {baselineReady ? 'A:C ratio' : 'baseline days'}
        </span>
        <strong className="ratio-dial-band" style={{ color: band.color }}>
          {band.label}
        </strong>
      </div>
    </div>
  )
}

function RecoveryScoreDial({
  score,
  band,
}: {
  score: number | null
  band: RecoveryBand
}) {
  const radius = 82
  const circumference = 2 * Math.PI * radius
  const progress = score === null ? 0.05 : Math.max(0.08, score / 100)
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="ratio-dial">
      <svg viewBox="0 0 200 200" className="ratio-dial-graphic" aria-hidden="true">
        <circle className="ratio-dial-track" cx="100" cy="100" r={radius} />
        <circle
          className="ratio-dial-progress"
          cx="100"
          cy="100"
          r={radius}
          stroke={band.color}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="ratio-dial-copy">
        <span className="ratio-dial-value">{formatRecoveryScore(score)}</span>
        <span className="ratio-dial-label">recovery score</span>
        <strong className="ratio-dial-band" style={{ color: band.color }}>
          {band.label}
        </strong>
      </div>
    </div>
  )
}

function NutritionScoreDial({
  score,
  band,
}: {
  score: number | null
  band: NutritionBand
}) {
  const radius = 82
  const circumference = 2 * Math.PI * radius
  const progress = score === null ? 0.05 : Math.max(0.08, score / 100)
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="ratio-dial">
      <svg viewBox="0 0 200 200" className="ratio-dial-graphic" aria-hidden="true">
        <circle className="ratio-dial-track" cx="100" cy="100" r={radius} />
        <circle
          className="ratio-dial-progress"
          cx="100"
          cy="100"
          r={radius}
          stroke={band.color}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="ratio-dial-copy">
        <span className="ratio-dial-value">{formatNutritionScore(score)}</span>
        <span className="ratio-dial-label">nutrition score</span>
        <strong className="ratio-dial-band" style={{ color: band.color }}>
          {band.label}
        </strong>
      </div>
    </div>
  )
}

function RatioTrendChart({ points }: { points: DailyLoadPoint[] }) {
  const maxRatio = Math.max(
    1.6,
    ...points.flatMap((point) => (point.ratio === null ? [] : [point.ratio])),
  )
  const cappedMaxRatio = Math.ceil(maxRatio * 10) / 10
  const ratioPath = buildRatioPath(points, cappedMaxRatio)
  const maxLoad = Math.max(1, ...points.map((point) => point.totalLoad))
  const bars = buildBarPath(points, maxLoad)
  const bandTop = 100 - (1.3 / cappedMaxRatio) * 100
  const bandBottom = 100 - (0.8 / cappedMaxRatio) * 100
  const labels = points.filter(
    (_, index) => index % 7 === 0 || index === points.length - 1,
  )

  return (
    <div className="trend-chart">
      <svg
        viewBox="0 0 100 100"
        className="trend-chart-svg"
        role="img"
        aria-label="Acute to chronic workload ratio trend chart"
      >
        <rect
          className="trend-chart-band"
          x="0"
          y={bandTop}
          width="100"
          height={bandBottom - bandTop}
        />
        {[0.5, 1, 1.5].map((mark) => (
          <line
            key={mark}
            className="trend-chart-gridline"
            x1="0"
            y1={100 - (mark / cappedMaxRatio) * 100}
            x2="100"
            y2={100 - (mark / cappedMaxRatio) * 100}
          />
        ))}
        {bars.map((bar) => (
          <rect
            key={bar.x}
            className="trend-chart-bar"
            x={bar.x}
            y={100 - bar.height}
            width={bar.width}
            height={bar.height}
            rx="0.6"
          />
        ))}
        {ratioPath ? <path className="trend-chart-line" d={ratioPath} /> : null}
      </svg>
      <div className="trend-chart-axis">
        {labels.map((point) => (
          <span key={point.date}>{formatShortDate(point.date)}</span>
        ))}
      </div>
      <div className="trend-legend">
        <span>
          <i className="legend-swatch legend-swatch-band" />
          target zone (0.8-1.3)
        </span>
        <span>
          <i className="legend-swatch legend-swatch-line" />
          ratio trend
        </span>
        <span>
          <i className="legend-swatch legend-swatch-bar" />
          daily load
        </span>
      </div>
    </div>
  )
}

function RecoveryTrendChart({
  points,
  hrvAverage,
}: {
  points: RecoveryDailyPoint[]
  hrvAverage: number | null
}) {
  const scorePath = buildRecoveryPath(points)
  const maxSleepHours = Math.max(
    8,
    ...points.flatMap((point) => (point.sleepHours === null ? [] : [point.sleepHours])),
  )
  const bars = buildRecoverySleepBars(points, maxSleepHours)
  const hrvValues = points.flatMap((point) => (point.hrv === null ? [] : [point.hrv]))
  const rawMinHrv = hrvValues.length ? Math.min(...hrvValues) : null
  const rawMaxHrv = hrvValues.length ? Math.max(...hrvValues) : null
  const hrvPadding =
    rawMinHrv !== null && rawMaxHrv !== null
      ? Math.max(4, Math.round((rawMaxHrv - rawMinHrv || 8) * 0.25))
      : null
  const minHrv =
    rawMinHrv !== null && hrvPadding !== null
      ? Math.max(0, rawMinHrv - hrvPadding)
      : null
  const maxHrv =
    rawMaxHrv !== null && hrvPadding !== null ? rawMaxHrv + hrvPadding : null
  const hrvPath =
    minHrv !== null && maxHrv !== null
      ? buildHrvPath(points, minHrv, maxHrv)
      : ''
  const hrvDots =
    minHrv !== null && maxHrv !== null
      ? buildHrvDots(points, minHrv, maxHrv)
      : []
  const hrvRange =
    minHrv !== null && maxHrv !== null ? Math.max(1, maxHrv - minHrv) : null
  const hrvAverageY =
    hrvAverage !== null && minHrv !== null && hrvRange !== null
      ? 100 - ((hrvAverage - minHrv) / hrvRange) * 100
      : null
  const labels = points.filter(
    (_, index) => index % 3 === 0 || index === points.length - 1,
  )

  return (
    <div className="trend-chart">
      <svg
        viewBox="0 0 100 100"
        className="trend-chart-svg recovery-trend-svg"
        role="img"
        aria-label="Recovery score and HRV trend chart"
      >
        <rect className="recovery-trend-band" x="0" y="0" width="100" height="20" />
        {bars.map((bar) => (
          <rect
            key={bar.x}
            className="recovery-trend-bar"
            x={bar.x}
            y={100 - bar.height}
            width={bar.width}
            height={bar.height}
            rx="0.6"
          />
        ))}
        {hrvAverageY !== null ? (
          <line
            className="hrv-trend-baseline"
            x1="0"
            y1={hrvAverageY}
            x2="100"
            y2={hrvAverageY}
          />
        ) : null}
        {scorePath ? (
          <path className="recovery-trend-line" d={scorePath} />
        ) : null}
        {hrvPath ? <path className="hrv-trend-line" d={hrvPath} /> : null}
        {hrvDots.map((dot) => (
          <circle
            key={dot.date}
            className="hrv-trend-dot"
            cx={dot.x}
            cy={dot.y}
            r="1.2"
          />
        ))}
      </svg>
      <div className="trend-chart-axis">
        {labels.map((point) => (
          <span key={point.date}>{formatShortDate(point.date)}</span>
        ))}
      </div>
      <div className="trend-legend">
        <span>
          <i className="legend-swatch recovery-legend-band" />
          ready zone (80+)
        </span>
        <span>
          <i className="legend-swatch recovery-legend-line" />
          score trend
        </span>
        <span>
          <i className="legend-swatch recovery-legend-bar" />
          sleep hours
        </span>
        {hrvValues.length ? (
          <span>
            <i className="legend-swatch hrv-legend-line" />
            HRV overlay
          </span>
        ) : null}
        {hrvAverageY !== null ? (
          <span>
            <i className="legend-swatch hrv-legend-baseline" />
            HRV 7d average
          </span>
        ) : null}
      </div>
      {minHrv !== null && maxHrv !== null ? (
        <p className="trend-footnote">
          HRV overlay is normalized to the visible range of {formatHrv(minHrv)} to{' '}
          {formatHrv(maxHrv)}.
        </p>
      ) : null}
    </div>
  )
}

function NutritionTrendChart({
  points,
  targets,
}: {
  points: NutritionDailyPoint[]
  targets: NutritionTargets
}) {
  const scorePath = buildNutritionScorePath(points)
  const maxCalories = Math.max(
    targets.calories * 1.2,
    ...points.flatMap((point) => (point.calories === null ? [] : [point.calories])),
    1,
  )
  const bars = buildNutritionCalorieBars(points, maxCalories)
  const targetY = 100 - (targets.calories / maxCalories) * 100
  const labels = points.filter(
    (_, index) => index % 3 === 0 || index === points.length - 1,
  )

  return (
    <div className="trend-chart">
      <svg
        viewBox="0 0 100 100"
        className="trend-chart-svg nutrition-trend-svg"
        role="img"
        aria-label="Nutrition score and calories trend chart"
      >
        {[25, 50, 75].map((mark) => (
          <line
            key={mark}
            className="trend-chart-gridline"
            x1="0"
            y1={100 - mark}
            x2="100"
            y2={100 - mark}
          />
        ))}
        <line
          className="nutrition-target-line"
          x1="0"
          y1={targetY}
          x2="100"
          y2={targetY}
        />
        {bars.map((bar) => (
          <rect
            key={bar.x}
            className="nutrition-trend-bar"
            x={bar.x}
            y={100 - bar.height}
            width={bar.width}
            height={bar.height}
            rx="0.6"
          />
        ))}
        {scorePath ? <path className="nutrition-trend-line" d={scorePath} /> : null}
      </svg>
      <div className="trend-chart-axis">
        {labels.map((point) => (
          <span key={point.date}>{formatShortDate(point.date)}</span>
        ))}
      </div>
      <div className="trend-legend">
        <span>
          <i className="legend-swatch nutrition-legend-line" />
          score trend
        </span>
        <span>
          <i className="legend-swatch nutrition-legend-bar" />
          calories
        </span>
        <span>
          <i className="legend-swatch nutrition-legend-target" />
          calorie target
        </span>
      </div>
      <p className="trend-footnote">
        Current calorie target line: {formatCalories(targets.calories)}.
      </p>
    </div>
  )
}

function WorkloadStrip({ points }: { points: DailyLoadPoint[] }) {
  const maxLoad = Math.max(1, ...points.map((point) => point.totalLoad))

  return (
    <div className="load-strip">
      {points.map((point) => {
        const style = {
          '--load-height': `${(point.totalLoad / maxLoad) * 100}%`,
        } as CSSProperties

        return (
          <article key={point.date} className="load-strip-day">
            <span className="load-strip-date">{formatShortDate(point.date)}</span>
            <div className="load-strip-bar" style={style}>
              <span />
            </div>
            <strong>{formatLoad(point.totalLoad)}</strong>
            <small>{point.sessionCount} sessions</small>
          </article>
        )
      })}
    </div>
  )
}

function RecoveryMetricField({
  config,
  value,
  onChange,
}: {
  config: RecoveryMetricConfig
  value: string
  onChange: (field: RecoveryMetricFieldKey, value: string) => void
}) {
  return (
    <div className="recovery-metric-field">
      <div className="recovery-metric-copy">
        <div>
          <strong>{config.label}</strong>
          <p>{config.hint}</p>
        </div>
        <span className="recovery-metric-value">{value}/5</span>
      </div>
      <input
        className="recovery-range"
        type="range"
        min="1"
        max="5"
        step="1"
        value={value}
        onChange={(event) => onChange(config.field, event.currentTarget.value)}
      />
      <div className="recovery-range-scale" aria-hidden="true">
        <span>{config.low}</span>
        <span>{config.high}</span>
      </div>
    </div>
  )
}

function RecoveryBreakdown({ entry }: { entry: RecoveryEntry | undefined }) {
  if (!entry) {
    return (
      <div className="empty-block">
        <p>No recovery check-ins yet.</p>
        <p>Once you log one, the latest readiness breakdown will appear here.</p>
      </div>
    )
  }

  const metrics = [
    {
      label: 'Sleep hours',
      value: formatSleepHours(entry.sleepHours),
      detail: 'time asleep',
    },
    {
      label: 'HRV',
      value: formatHrv(entry.hrv),
      detail: 'optional device input',
    },
    {
      label: 'Sleep quality',
      value: `${entry.sleepQuality}/5`,
      detail: 'restfulness',
    },
    {
      label: 'Energy',
      value: `${entry.energy}/5`,
      detail: 'morning readiness',
    },
    {
      label: 'Soreness',
      value: `${entry.soreness}/5`,
      detail: 'muscle fatigue',
    },
    {
      label: 'Stress',
      value: `${entry.stress}/5`,
      detail: 'outside load',
    },
    {
      label: 'Hydration',
      value: `${entry.hydration}/5`,
      detail: 'fluid status',
    },
  ]

  return (
    <div className="recovery-breakdown">
      <div className="recovery-breakdown-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="recovery-breakdown-item">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>
      {entry.notes ? (
        <p className="recovery-note">Latest note: {entry.notes}</p>
      ) : null}
    </div>
  )
}

function RecentSessionTable({
  sessions,
  onDelete,
}: {
  sessions: WorkloadSession[]
  onDelete: (sessionId: string) => void
}) {
  if (!sessions.length) {
    return (
      <div className="empty-block">
        <p>No sessions logged yet.</p>
        <p>Your latest training sessions will appear here after the first entry.</p>
      </div>
    )
  }

  return (
    <div className="session-table-wrapper">
      <table className="session-table">
        <thead>
          <tr>
            <th>Session</th>
            <th>Date</th>
            <th>Duration</th>
            <th>RPE</th>
            <th>Load</th>
            <th aria-label="Delete session" />
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>
                <div className="session-title">{session.title}</div>
                {session.notes ? (
                  <div className="session-notes">{session.notes}</div>
                ) : null}
              </td>
              <td>{formatLongDate(session.date)}</td>
              <td>{session.duration ? `${session.duration} min` : 'Custom'}</td>
              <td>{session.rpe ?? 'Custom'}</td>
              <td>{formatLoad(session.load)}</td>
              <td>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onDelete(session.id)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecentRecoveryTable({
  entries,
  onDelete,
}: {
  entries: RecoveryEntry[]
  onDelete: (entryId: string) => void
}) {
  if (!entries.length) {
    return (
      <div className="empty-block">
        <p>No recovery check-ins yet.</p>
        <p>The latest recovery log will appear here once you add your first entry.</p>
      </div>
    )
  }

  return (
    <div className="session-table-wrapper">
      <table className="session-table">
        <thead>
          <tr>
            <th>Check-in</th>
            <th>Score</th>
            <th>Sleep</th>
            <th>HRV</th>
            <th>Energy</th>
            <th>Soreness</th>
            <th>Stress</th>
            <th aria-label="Delete check-in" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>
                <div className="session-title">{formatLongDate(entry.date)}</div>
                {entry.notes ? (
                  <div className="session-notes">{entry.notes}</div>
                ) : null}
              </td>
              <td>{formatRecoveryScore(entry.score)}</td>
              <td>{formatSleepHours(entry.sleepHours)}</td>
              <td>{formatHrv(entry.hrv)}</td>
              <td>{entry.energy}/5</td>
              <td>{entry.soreness}/5</td>
              <td>{entry.stress}/5</td>
              <td>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onDelete(entry.id)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NutritionTargetBreakdown({
  entry,
  targets,
}: {
  entry: NutritionEntry | undefined
  targets: NutritionTargets
}) {
  if (!entry) {
    return (
      <div className="empty-block">
        <p>No nutrition days logged yet.</p>
        <p>Your latest intake versus target summary will appear here after the first entry.</p>
      </div>
    )
  }

  const metrics = [
    {
      label: 'Calories',
      value: formatCalories(entry.calories),
      detail: `target ${formatCalories(targets.calories)}`,
    },
    {
      label: 'Protein',
      value: formatGrams(entry.protein),
      detail: `target ${formatGrams(targets.protein)}`,
    },
    {
      label: 'Carbs',
      value: formatGrams(entry.carbs),
      detail: `target ${formatGrams(targets.carbs)}`,
    },
    {
      label: 'Fat',
      value: formatGrams(entry.fat),
      detail: `target ${formatGrams(targets.fat)}`,
    },
    {
      label: 'Hydration',
      value: formatHydration(entry.hydration),
      detail: `target ${formatHydration(targets.hydration)}`,
    },
  ]

  return (
    <div className="recovery-breakdown">
      <div className="nutrition-breakdown-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="recovery-breakdown-item">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>
      {entry.notes ? (
        <p className="recovery-note">Latest note: {entry.notes}</p>
      ) : null}
    </div>
  )
}

function RecentNutritionTable({
  entries,
  onDelete,
}: {
  entries: NutritionEntry[]
  onDelete: (entryId: string) => void
}) {
  if (!entries.length) {
    return (
      <div className="empty-block">
        <p>No nutrition days logged yet.</p>
        <p>The latest nutrition log will appear here once you add your first day.</p>
      </div>
    )
  }

  return (
    <div className="session-table-wrapper">
      <table className="session-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Score</th>
            <th>Calories</th>
            <th>Protein</th>
            <th>Carbs</th>
            <th>Fat</th>
            <th>Hydration</th>
            <th aria-label="Delete day" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>
                <div className="session-title">{formatLongDate(entry.date)}</div>
                {entry.notes ? (
                  <div className="session-notes">{entry.notes}</div>
                ) : null}
              </td>
              <td>{formatNutritionScore(entry.score)}</td>
              <td>{formatCalories(entry.calories)}</td>
              <td>{formatGrams(entry.protein)}</td>
              <td>{formatGrams(entry.carbs)}</td>
              <td>{formatGrams(entry.fat)}</td>
              <td>{formatHydration(entry.hydration)}</td>
              <td>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onDelete(entry.id)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Sidebar({
  activeSection,
  onSelect,
  isOpen,
  onClose,
  currentSnapshot,
  ratioBand,
  weeklySessionCount,
  latestRecoveryEntry,
  recoveryAverage,
  recoveryHrvAverage,
  recoveryBand,
  recoveryCheckIns,
  latestNutritionEntry,
  nutritionAverage,
  nutritionBand,
  nutritionLogCount,
  homeEquipment,
  customHomeEquipment,
}: {
  activeSection: AppSectionId
  onSelect: (section: AppSectionId) => void
  isOpen: boolean
  onClose: () => void
  currentSnapshot: DailyLoadPoint | undefined
  ratioBand: RatioBand
  weeklySessionCount: number
  latestRecoveryEntry: RecoveryEntry | undefined
  recoveryAverage: number | null
  recoveryHrvAverage: number | null
  recoveryBand: RecoveryBand
  recoveryCheckIns: number
  latestNutritionEntry: NutritionEntry | undefined
  nutritionAverage: number | null
  nutritionBand: NutritionBand
  nutritionLogCount: number
  homeEquipment: HomeEquipmentId[]
  customHomeEquipment: CustomHomeEquipment[]
}) {
  const isDashboard = activeSection === 'dashboard'
  const isWorkload = activeSection === 'workload'
  const isRecovery = activeSection === 'recovery'
  const isNutrition = activeSection === 'nutrition'
  const isWorkoutGenerator = activeSection === 'workout-generator'
  const isSettings = activeSection === 'settings'

  return (
    <aside
      id="app-sidebar"
      className={`sidebar${isOpen ? ' is-open' : ''}`}
      aria-hidden={!isOpen}
    >
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <p className="eyebrow">Fitness tracker</p>
          <h2>Training OS</h2>
          <p>
            Start with workload management now and grow the rest of the platform
            around it.
          </p>
        </div>
        <button
          type="button"
          className="sidebar-close"
          aria-label="Close menu"
          onClick={onClose}
        >
          <span aria-hidden="true">x</span>
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="App sections">
        {APP_SECTIONS.map((section) => {
          const isActive = section.id === activeSection

          return (
            <button
              key={section.id}
              type="button"
              className={`sidebar-nav-item${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                onSelect(section.id)
                onClose()
              }}
            >
              <span className="sidebar-nav-row">
                <strong>{section.label}</strong>
                <span className="sidebar-badge">{section.badge}</span>
              </span>
              <span className="sidebar-nav-eyebrow">{section.eyebrow}</span>
              <span className="sidebar-nav-summary">{section.summary}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-status">
        <p className="section-kicker">
          {isDashboard
            ? 'Daily snapshot'
            : isWorkload
              ? 'Current workload'
              : isRecovery
                ? 'Current recovery'
                : isNutrition
              ? 'Current nutrition'
              : isSettings
                ? 'Home setup'
                : 'Generator context'}
        </p>
        <div className="sidebar-status-grid">
          {isDashboard ? (
            <>
              <div>
                <span>A:C ratio</span>
                <strong>{formatRatio(currentSnapshot?.ratio ?? null)}</strong>
              </div>
              <div>
                <span>Recovery</span>
                <strong>{formatRecoveryScore(latestRecoveryEntry?.score ?? null)}</strong>
              </div>
              <div>
                <span>Nutrition</span>
                <strong>
                  {formatNutritionScore(latestNutritionEntry?.score ?? null)}
                </strong>
              </div>
              <div>
                <span>Sessions</span>
                <strong>{weeklySessionCount}</strong>
              </div>
            </>
          ) : isSettings ? (
            <>
              <div>
                <span>Selected gear</span>
                <strong>
                  {getTotalHomeEquipmentCount(homeEquipment, customHomeEquipment)}
                </strong>
              </div>
              <div>
                <span>Home mode</span>
                <strong>
                  {getTotalHomeEquipmentCount(homeEquipment, customHomeEquipment)
                    ? 'Ready'
                    : 'Bodyweight'}
                </strong>
              </div>
              <div>
                <span>Quick view</span>
                <strong>
                  {formatHomeEquipmentSummary(
                    homeEquipment,
                    customHomeEquipment,
                  )}
                </strong>
              </div>
              <div>
                <span>Generator</span>
                <strong>Uses this setup</strong>
              </div>
            </>
          ) : isRecovery ? (
            <>
              <div>
                <span>Latest score</span>
                <strong>{formatRecoveryScore(latestRecoveryEntry?.score ?? null)}</strong>
              </div>
              <div>
                <span>7d average</span>
                <strong>{formatRecoveryScore(recoveryAverage)}</strong>
              </div>
              <div>
                <span>Latest HRV</span>
                <strong>{formatHrv(latestRecoveryEntry?.hrv ?? null)}</strong>
              </div>
              <div>
                <span>7d HRV</span>
                <strong>{formatHrv(recoveryHrvAverage)}</strong>
              </div>
            </>
          ) : isNutrition ? (
            <>
              <div>
                <span>Latest score</span>
                <strong>{formatNutritionScore(latestNutritionEntry?.score ?? null)}</strong>
              </div>
              <div>
                <span>7d average</span>
                <strong>{formatNutritionScore(nutritionAverage)}</strong>
              </div>
              <div>
                <span>Calories</span>
                <strong>{formatCalories(latestNutritionEntry?.calories ?? null)}</strong>
              </div>
              <div>
                <span>Protein</span>
                <strong>{formatGrams(latestNutritionEntry?.protein ?? null)}</strong>
              </div>
            </>
          ) : isWorkoutGenerator ? (
            <>
              <div>
                <span>A:C ratio</span>
                <strong>{formatRatio(currentSnapshot?.ratio ?? null)}</strong>
              </div>
              <div>
                <span>Recovery</span>
                <strong>{formatRecoveryScore(latestRecoveryEntry?.score ?? null)}</strong>
              </div>
              <div>
                <span>Nutrition</span>
                <strong>
                  {formatNutritionScore(latestNutritionEntry?.score ?? null)}
                </strong>
              </div>
              <div>
                <span>Sessions</span>
                <strong>{weeklySessionCount}</strong>
              </div>
            </>
          ) : (
            <>
              <div>
                <span>A:C ratio</span>
                <strong>{formatRatio(currentSnapshot?.ratio ?? null)}</strong>
              </div>
              <div>
                <span>Sessions</span>
                <strong>{weeklySessionCount}</strong>
              </div>
            </>
          )}
        </div>
        <p>
          {isDashboard
            ? 'Use the dashboard to scan every section quickly, then jump into the area that needs action.'
            : isRecovery
            ? recoveryBand.detail
            : isNutrition
              ? nutritionBand.detail
              : isWorkoutGenerator
                ? 'The generator uses current load, recovery, and fueling signals to scale the session.'
                : ratioBand.detail}
        </p>
        {isDashboard ? (
          <p>Start broad, then dive into workload, recovery, or nutrition.</p>
        ) : null}
        {isRecovery ? (
          <p>{recoveryCheckIns}/7 morning check-ins logged this week.</p>
        ) : null}
        {isNutrition ? (
          <p>{nutritionLogCount}/7 nutrition days logged this week.</p>
        ) : null}
        {isWorkoutGenerator ? (
          <p>
            Open the generator to turn these signals into session options you can
            save straight into the log.
          </p>
        ) : null}
      </div>
    </aside>
  )
}

function DashboardSnapshotCard({
  section,
  kicker,
  title,
  summary,
  metrics,
  tone,
  actionLabel,
  featured = false,
  onOpen,
}: {
  section: AppSectionId
  kicker: string
  title: string
  summary: string
  metrics: Array<{ label: string; value: string; detail: string }>
  tone: string
  actionLabel: string
  featured?: boolean
  onOpen: (section: AppSectionId) => void
}) {
  return (
    <article
      className={`dashboard-card section-panel${featured ? ' is-featured' : ''}`}
      style={{ '--dashboard-accent': tone } as CSSProperties}
    >
      <div className="dashboard-card-header">
        <p className="section-kicker">{kicker}</p>
        <h2>{title}</h2>
        <p>{summary}</p>
      </div>

      <div className="dashboard-card-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="dashboard-card-metric">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </div>
        ))}
      </div>

      <div className="entry-actions">
        <button
          type="button"
          className={featured ? 'primary-button' : 'secondary-button'}
          onClick={() => onOpen(section)}
        >
          {actionLabel}
        </button>
      </div>
    </article>
  )
}

function DashboardWorkspace({
  currentSnapshot,
  baselineProgress,
  ratioBand,
  weeklySessionCount,
  latestRecoveryEntry,
  recoveryAverage,
  recoveryBand,
  recoveryCheckIns,
  latestNutritionEntry,
  nutritionAverage,
  nutritionBand,
  nutritionLogCount,
  onOpenSection,
}: {
  currentSnapshot: DailyLoadPoint | undefined
  baselineProgress: number
  ratioBand: RatioBand
  weeklySessionCount: number
  latestRecoveryEntry: RecoveryEntry | undefined
  recoveryAverage: number | null
  recoveryBand: RecoveryBand
  recoveryCheckIns: number
  latestNutritionEntry: NutritionEntry | undefined
  nutritionAverage: number | null
  nutritionBand: NutritionBand
  nutritionLogCount: number
  onOpenSection: (section: AppSectionId) => void
}) {
  return (
    <div className="content-shell">
      <header className="content-header">
        <p className="eyebrow">Dashboard</p>
        <h1>See every training signal in one place.</h1>
        <p className="content-summary">
          Use this overview as your daily starting point, then jump straight
          into workload, recovery, or nutrition from the section that needs
          attention.
        </p>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <div>
            <p className="section-kicker">Daily snapshot</p>
            <h2>Current training picture</h2>
          </div>
          <div className="hero-metadata">
            <div>
              <span>Workload</span>
              <strong>{formatRatio(currentSnapshot?.ratio ?? null)}</strong>
              <small>{ratioBand.label.toLowerCase()}</small>
            </div>
            <div>
              <span>Recovery</span>
              <strong>{formatRecoveryScore(latestRecoveryEntry?.score ?? null)}</strong>
              <small>{recoveryBand.label.toLowerCase()}</small>
            </div>
            <div>
              <span>Nutrition</span>
              <strong>
                {formatNutritionScore(latestNutritionEntry?.score ?? null)}
              </strong>
              <small>{nutritionBand.label.toLowerCase()}</small>
            </div>
          </div>
        </div>

        <aside className="hero-focus">
          <div className="dashboard-focus">
            <p className="section-kicker">Tracking coverage</p>
            <h2>Keep the baseline and daily logs current</h2>
            <p className="hero-focus-summary">
              {baselineProgress < 28
                ? `${baselineProgress}/28 baseline days collected so far.`
                : 'Four-week workload baseline is ready.'}
            </p>
            <p className="hero-focus-detail">
              {weeklySessionCount} sessions, {recoveryCheckIns}/7 recovery
              check-ins, and {nutritionLogCount}/7 nutrition logs tracked this
              week.
            </p>
            <div className="entry-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => onOpenSection('workload')}
              >
                Open workload
              </button>
            </div>
          </div>
        </aside>
      </section>

      <section className="dashboard-grid">
        <DashboardSnapshotCard
          section="workload"
          kicker="Workload"
          title="Acute to chronic workload"
          summary={getRatioSummary(
            currentSnapshot?.ratio ?? null,
            ratioBand,
            baselineProgress,
          )}
          metrics={[
            {
              label: 'Acute load',
              value: formatLoad(currentSnapshot?.acuteLoad ?? 0),
              detail: 'last 7 days',
            },
            {
              label: 'Chronic load',
              value: formatLoad(currentSnapshot?.chronicLoad ?? null),
              detail: '28-day weekly baseline',
            },
            {
              label: 'Sessions',
              value: `${weeklySessionCount}`,
              detail: 'logged this week',
            },
          ]}
          tone={ratioBand.color}
          actionLabel="Open workload"
          featured
          onOpen={onOpenSection}
        />

        <DashboardSnapshotCard
          section="recovery"
          kicker="Recovery"
          title="Morning readiness"
          summary={getRecoverySummary(
            latestRecoveryEntry?.score ?? null,
            recoveryAverage,
            recoveryBand,
          )}
          metrics={[
            {
              label: 'Latest score',
              value: formatRecoveryScore(latestRecoveryEntry?.score ?? null),
              detail: latestRecoveryEntry
                ? formatShortDate(latestRecoveryEntry.date)
                : 'no check-in yet',
            },
            {
              label: '7d average',
              value: formatRecoveryScore(recoveryAverage),
              detail: recoveryBand.label.toLowerCase(),
            },
            {
              label: 'Check-ins',
              value: `${recoveryCheckIns}/7`,
              detail: 'days logged this week',
            },
          ]}
          tone={recoveryBand.color}
          actionLabel="Open recovery"
          onOpen={onOpenSection}
        />

        <DashboardSnapshotCard
          section="nutrition"
          kicker="Nutrition"
          title="Fueling and hydration"
          summary={getNutritionSummary(
            latestNutritionEntry?.score ?? null,
            nutritionAverage,
            nutritionBand,
          )}
          metrics={[
            {
              label: 'Latest score',
              value: formatNutritionScore(latestNutritionEntry?.score ?? null),
              detail: latestNutritionEntry
                ? formatShortDate(latestNutritionEntry.date)
                : 'no log yet',
            },
            {
              label: 'Calories',
              value: formatCalories(latestNutritionEntry?.calories ?? null),
              detail: latestNutritionEntry
                ? 'latest day'
                : 'waiting for first entry',
            },
            {
              label: 'Logged days',
              value: `${nutritionLogCount}/7`,
              detail: 'days tracked this week',
            },
          ]}
          tone={nutritionBand.color}
          actionLabel="Open nutrition"
          onOpen={onOpenSection}
        />
      </section>
    </div>
  )
}

function WorkloadWorkspace({
  currentSnapshot,
  baselineProgress,
  ratioBand,
  weeklySessionCount,
  formState,
  onInputChange,
  onAddSession,
  onLoadDemoData,
  onClearAll,
  sessions,
  errorMessage,
  sessionLoadPreview,
  dailySeries,
  weeklyPoints,
  recentSessions,
  onDeleteSession,
}: {
  currentSnapshot: DailyLoadPoint | undefined
  baselineProgress: number
  ratioBand: RatioBand
  weeklySessionCount: number
  formState: SessionFormState
  onInputChange: (field: keyof SessionFormState, value: string) => void
  onAddSession: (event: FormEvent<HTMLFormElement>) => void
  onLoadDemoData: () => void
  onClearAll: () => void
  sessions: WorkloadSession[]
  errorMessage: string
  sessionLoadPreview: number | null
  dailySeries: DailyLoadPoint[]
  weeklyPoints: DailyLoadPoint[]
  recentSessions: WorkloadSession[]
  onDeleteSession: (sessionId: string) => void
}) {
  return (
    <div className="content-shell">
      <header className="content-header">
        <p className="eyebrow">Workload</p>
        <h1>Track acute to chronic workload ratio from day one.</h1>
        <p className="content-summary">
          Log each training session, calculate load from session RPE, and
          monitor how your current week compares with your rolling four-week
          average.
        </p>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <div>
            <p className="section-kicker">ACWR overview</p>
            <h2>Current training load</h2>
          </div>
          <div className="hero-metadata">
            <div>
              <span>Acute load</span>
              <strong>{formatLoad(currentSnapshot?.acuteLoad ?? 0)}</strong>
              <small>last 7 days</small>
            </div>
            <div>
              <span>Chronic load</span>
              <strong>{formatLoad(currentSnapshot?.chronicLoad ?? null)}</strong>
              <small>28-day average week</small>
            </div>
            <div>
              <span>Sessions</span>
              <strong>{weeklySessionCount}</strong>
              <small>in the last week</small>
            </div>
          </div>
        </div>

        <aside className="hero-focus">
          <RatioDial
            ratio={currentSnapshot?.ratio ?? null}
            baselineReady={currentSnapshot?.baselineReady ?? false}
            baselineProgress={baselineProgress}
            band={ratioBand}
          />
          <p className="hero-focus-summary">
            {getRatioSummary(
              currentSnapshot?.ratio ?? null,
              ratioBand,
              baselineProgress,
            )}
          </p>
          <p className="hero-focus-detail">{ratioBand.detail}</p>
        </aside>
      </section>

      <main className="workspace">
        <section className="entry-panel section-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Training input</p>
              <h2>Log a session</h2>
            </div>
            <p>
              Session load defaults to <code>duration x RPE</code>, but you can
              also enter a custom load.
            </p>
          </div>

          <form className="entry-form" onSubmit={onAddSession}>
            <label>
              Session name
              <input
                type="text"
                placeholder="Long run, strength, intervals..."
                value={formState.title}
                onChange={(event) =>
                  onInputChange('title', event.currentTarget.value)
                }
              />
            </label>

            <div className="entry-grid">
              <label>
                Date
                <input
                  type="date"
                  value={formState.date}
                  onChange={(event) =>
                    onInputChange('date', event.currentTarget.value)
                  }
                />
              </label>

              <label>
                Duration (min)
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={formState.duration}
                  onChange={(event) =>
                    onInputChange('duration', event.currentTarget.value)
                  }
                />
              </label>

              <label>
                Session RPE
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  max="10"
                  step="0.5"
                  value={formState.rpe}
                  onChange={(event) =>
                    onInputChange('rpe', event.currentTarget.value)
                  }
                />
              </label>

              <label>
                Custom load
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  placeholder="Optional"
                  value={formState.loadOverride}
                  onChange={(event) =>
                    onInputChange('loadOverride', event.currentTarget.value)
                  }
                />
              </label>
            </div>

            <label>
              Notes
              <textarea
                rows={3}
                placeholder="Optional context: deload week, travel fatigue, race prep..."
                value={formState.notes}
                onChange={(event) =>
                  onInputChange('notes', event.currentTarget.value)
                }
              />
            </label>

            <div className="entry-footer">
              <div className="load-preview">
                <span>Session load preview</span>
                <strong>{formatLoad(sessionLoadPreview)}</strong>
              </div>
              <div className="entry-actions">
                <button type="submit" className="primary-button">
                  Add session
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onLoadDemoData}
                >
                  {sessions.length ? 'Replace with demo data' : 'Load demo data'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={onClearAll}
                  disabled={!sessions.length}
                >
                  Clear all
                </button>
              </div>
            </div>

            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          </form>
        </section>

        <section className="section-panel trend-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Trend</p>
              <h2>Six-week workload view</h2>
            </div>
            <p>
              Acute load is the last 7 days. Chronic load is the last 28 days
              divided by four to create a weekly baseline.
            </p>
          </div>
          <RatioTrendChart points={dailySeries.slice(-42)} />
        </section>

        <section className="section-panel load-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Last week</p>
              <h2>Daily contribution</h2>
            </div>
            <p>See which days are driving the current acute load total.</p>
          </div>
          <WorkloadStrip points={weeklyPoints} />
        </section>

        <section className="section-panel sessions-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Training log</p>
              <h2>Recent sessions</h2>
            </div>
            <p>Entries are saved in this browser so you can keep building the baseline.</p>
          </div>
          <RecentSessionTable
            sessions={recentSessions}
            onDelete={onDeleteSession}
          />
        </section>
      </main>
    </div>
  )
}

function RecoveryWorkspace({
  latestRecoveryEntry,
  recoveryAverage,
  recoveryHrvAverage,
  recoveryCheckIns,
  recoveryBand,
  recoveryFormState,
  onInputChange,
  onAddEntry,
  onLoadDemoData,
  onClearAll,
  recoveryEntries,
  errorMessage,
  scorePreview,
  recoverySeries,
  recentRecoveryEntries,
  onDeleteEntry,
}: {
  latestRecoveryEntry: RecoveryEntry | undefined
  recoveryAverage: number | null
  recoveryHrvAverage: number | null
  recoveryCheckIns: number
  recoveryBand: RecoveryBand
  recoveryFormState: RecoveryFormState
  onInputChange: (field: keyof RecoveryFormState, value: string) => void
  onAddEntry: (event: FormEvent<HTMLFormElement>) => void
  onLoadDemoData: () => void
  onClearAll: () => void
  recoveryEntries: RecoveryEntry[]
  errorMessage: string
  scorePreview: number | null
  recoverySeries: RecoveryDailyPoint[]
  recentRecoveryEntries: RecoveryEntry[]
  onDeleteEntry: (entryId: string) => void
}) {
  return (
    <div className="content-shell">
      <header className="content-header">
        <p className="eyebrow">Recovery</p>
        <h1>Capture how ready the body feels before training.</h1>
        <p className="content-summary">
          Log one short morning check-in, watch the recovery score trend, and
          use it as context alongside workload instead of guessing how fresh you are.
        </p>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <div>
            <p className="section-kicker">Recovery overview</p>
            <h2>Current readiness snapshot</h2>
          </div>
          <div className="hero-metadata">
            <div>
              <span>Latest score</span>
              <strong>{formatRecoveryScore(latestRecoveryEntry?.score ?? null)}</strong>
              <small>
                {latestRecoveryEntry
                  ? formatLongDate(latestRecoveryEntry.date)
                  : 'no check-in yet'}
              </small>
            </div>
            <div>
              <span>7-day average</span>
              <strong>{formatRecoveryScore(recoveryAverage)}</strong>
              <small>rolling short-term baseline</small>
            </div>
            <div>
              <span>Latest HRV</span>
              <strong>{formatHrv(latestRecoveryEntry?.hrv ?? null)}</strong>
              <small>
                {recoveryHrvAverage === null
                  ? 'optional device metric'
                  : `${formatHrv(recoveryHrvAverage)} 7d average`}
              </small>
            </div>
          </div>
        </div>

        <aside className="hero-focus">
          <RecoveryScoreDial
            score={latestRecoveryEntry?.score ?? null}
            band={recoveryBand}
          />
          <p className="hero-focus-summary">
            {getRecoverySummary(
              latestRecoveryEntry?.score ?? null,
              recoveryAverage,
              recoveryBand,
            )}
          </p>
          <p className="hero-focus-detail">
            {recoveryBand.detail} {recoveryCheckIns}/7 check-ins logged in the last week.
          </p>
        </aside>
      </section>

      <main className="workspace">
        <section className="entry-panel section-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Morning input</p>
              <h2>Log a recovery check-in</h2>
            </div>
            <p>
              This first version assumes one short daily check-in and rolls the
              markers into a simple readiness score. HRV is tracked separately
              so you can compare it against your own baseline.
            </p>
          </div>

          <form className="entry-form" onSubmit={onAddEntry}>
            <div className="entry-grid">
              <label>
                Date
                <input
                  type="date"
                  value={recoveryFormState.date}
                  onChange={(event) =>
                    onInputChange('date', event.currentTarget.value)
                  }
                />
              </label>

              <label>
                Sleep hours
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="14"
                  step="0.1"
                  value={recoveryFormState.sleepHours}
                  onChange={(event) =>
                    onInputChange('sleepHours', event.currentTarget.value)
                  }
                />
              </label>

              <label>
                HRV (ms)
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  placeholder="Optional"
                  value={recoveryFormState.hrv}
                  onChange={(event) =>
                    onInputChange('hrv', event.currentTarget.value)
                  }
                />
              </label>
            </div>

            <div className="recovery-metric-grid">
              {RECOVERY_METRICS.map((metric) => (
                <RecoveryMetricField
                  key={metric.field}
                  config={metric}
                  value={recoveryFormState[metric.field]}
                  onChange={onInputChange}
                />
              ))}
            </div>

            <label>
              Notes
              <textarea
                rows={3}
                placeholder="Optional context: bad travel sleep, race nerves, soreness from lifting..."
                value={recoveryFormState.notes}
                onChange={(event) =>
                  onInputChange('notes', event.currentTarget.value)
                }
              />
            </label>

            <div className="entry-footer">
              <div className="load-preview">
                <span>Recovery score preview</span>
                <strong>{formatRecoveryScore(scorePreview)}</strong>
              </div>
              <div className="entry-actions">
                <button type="submit" className="primary-button">
                  Save check-in
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onLoadDemoData}
                >
                  {recoveryEntries.length
                    ? 'Replace with demo data'
                    : 'Load demo data'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={onClearAll}
                  disabled={!recoveryEntries.length}
                >
                  Clear all
                </button>
              </div>
            </div>

            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          </form>
        </section>

        <section className="section-panel trend-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Trend</p>
              <h2>Two-week recovery view</h2>
            </div>
            <p>
              Score and normalized HRV share the same view, while the columns
              still show sleep hours for quick pattern checks.
            </p>
          </div>
          <RecoveryTrendChart
            points={recoverySeries}
            hrvAverage={recoveryHrvAverage}
          />
        </section>

        <section className="section-panel load-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Latest check-in</p>
              <h2>Signal breakdown</h2>
            </div>
            <p>Use the underlying markers to explain why the score moved.</p>
          </div>
          <RecoveryBreakdown entry={latestRecoveryEntry} />
        </section>

        <section className="section-panel sessions-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Recovery log</p>
              <h2>Recent check-ins</h2>
            </div>
            <p>Saving a new entry for the same date replaces the older one.</p>
          </div>
          <RecentRecoveryTable
            entries={recentRecoveryEntries}
            onDelete={onDeleteEntry}
          />
        </section>
      </main>
    </div>
  )
}

function NutritionWorkspace({
  latestNutritionEntry,
  nutritionAverage,
  nutritionAverageCalories,
  nutritionLogCount,
  nutritionBand,
  nutritionTargets,
  nutritionFormState,
  nutritionTargetsFormState,
  onNutritionInputChange,
  onNutritionTargetsInputChange,
  onAddEntry,
  onSaveTargets,
  onLoadDemoData,
  onClearAll,
  nutritionEntries,
  errorMessage,
  targetsErrorMessage,
  scorePreview,
  nutritionSeries,
  recentNutritionEntries,
  onDeleteEntry,
}: {
  latestNutritionEntry: NutritionEntry | undefined
  nutritionAverage: number | null
  nutritionAverageCalories: number | null
  nutritionLogCount: number
  nutritionBand: NutritionBand
  nutritionTargets: NutritionTargets
  nutritionFormState: NutritionFormState
  nutritionTargetsFormState: NutritionTargetsFormState
  onNutritionInputChange: (field: keyof NutritionFormState, value: string) => void
  onNutritionTargetsInputChange: (
    field: keyof NutritionTargetsFormState,
    value: string,
  ) => void
  onAddEntry: (event: FormEvent<HTMLFormElement>) => void
  onSaveTargets: (event: FormEvent<HTMLFormElement>) => void
  onLoadDemoData: () => void
  onClearAll: () => void
  nutritionEntries: NutritionEntry[]
  errorMessage: string
  targetsErrorMessage: string
  scorePreview: number | null
  nutritionSeries: NutritionDailyPoint[]
  recentNutritionEntries: NutritionEntry[]
  onDeleteEntry: (entryId: string) => void
}) {
  return (
    <div className="content-shell">
      <header className="content-header">
        <p className="eyebrow">Nutrition</p>
        <h1>Track daily intake against targets that support training.</h1>
        <p className="content-summary">
          Set simple daily targets, log the whole day once, and monitor how
          calories, macros, and hydration are tracking over time.
        </p>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <div>
            <p className="section-kicker">Nutrition overview</p>
            <h2>Current fueling snapshot</h2>
          </div>
          <div className="hero-metadata">
            <div>
              <span>Latest score</span>
              <strong>{formatNutritionScore(latestNutritionEntry?.score ?? null)}</strong>
              <small>
                {latestNutritionEntry
                  ? formatLongDate(latestNutritionEntry.date)
                  : 'no nutrition day yet'}
              </small>
            </div>
            <div>
              <span>Calories</span>
              <strong>{formatCalories(latestNutritionEntry?.calories ?? null)}</strong>
              <small>target {formatCalories(nutritionTargets.calories)}</small>
            </div>
            <div>
              <span>Protein</span>
              <strong>{formatGrams(latestNutritionEntry?.protein ?? null)}</strong>
              <small>target {formatGrams(nutritionTargets.protein)}</small>
            </div>
          </div>
        </div>

        <aside className="hero-focus">
          <NutritionScoreDial
            score={latestNutritionEntry?.score ?? null}
            band={nutritionBand}
          />
          <p className="hero-focus-summary">
            {getNutritionSummary(
              latestNutritionEntry?.score ?? null,
              nutritionAverage,
              nutritionBand,
            )}
          </p>
          <p className="hero-focus-detail">
            {nutritionBand.detail} {nutritionLogCount}/7 days logged, averaging{' '}
            {formatCalories(nutritionAverageCalories)}.
          </p>
        </aside>
      </section>

      <main className="workspace">
        <section className="entry-panel section-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Daily input</p>
              <h2>Log a nutrition day</h2>
            </div>
            <p>
              This first version treats nutrition as one end-of-day entry so
              you can quickly compare totals against your plan.
            </p>
          </div>

          <form className="entry-form" onSubmit={onAddEntry}>
            <div className="entry-grid">
              <label>
                Date
                <input
                  type="date"
                  value={nutritionFormState.date}
                  onChange={(event) =>
                    onNutritionInputChange('date', event.currentTarget.value)
                  }
                />
              </label>

              <label>
                Calories
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={nutritionFormState.calories}
                  onChange={(event) =>
                    onNutritionInputChange('calories', event.currentTarget.value)
                  }
                />
              </label>

              <label>
                Protein (g)
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={nutritionFormState.protein}
                  onChange={(event) =>
                    onNutritionInputChange('protein', event.currentTarget.value)
                  }
                />
              </label>

              <label>
                Carbs (g)
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={nutritionFormState.carbs}
                  onChange={(event) =>
                    onNutritionInputChange('carbs', event.currentTarget.value)
                  }
                />
              </label>

              <label>
                Fat (g)
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={nutritionFormState.fat}
                  onChange={(event) =>
                    onNutritionInputChange('fat', event.currentTarget.value)
                  }
                />
              </label>

              <label>
                Hydration (L)
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={nutritionFormState.hydration}
                  onChange={(event) =>
                    onNutritionInputChange('hydration', event.currentTarget.value)
                  }
                />
              </label>
            </div>

            <label>
              Notes
              <textarea
                rows={3}
                placeholder="Optional context: travel day, missed meal, race fueling, higher appetite..."
                value={nutritionFormState.notes}
                onChange={(event) =>
                  onNutritionInputChange('notes', event.currentTarget.value)
                }
              />
            </label>

            <div className="entry-footer">
              <div className="load-preview">
                <span>Nutrition score preview</span>
                <strong>{formatNutritionScore(scorePreview)}</strong>
              </div>
              <div className="entry-actions">
                <button type="submit" className="primary-button">
                  Save day
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onLoadDemoData}
                >
                  {nutritionEntries.length
                    ? 'Replace with demo data'
                    : 'Load demo data'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={onClearAll}
                  disabled={!nutritionEntries.length}
                >
                  Clear all
                </button>
              </div>
            </div>

            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          </form>
        </section>

        <section className="section-panel trend-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Trend</p>
              <h2>Two-week nutrition view</h2>
            </div>
            <p>
              Bars show calories, the line shows nutrition score, and the
              baseline marks your current calorie target.
            </p>
          </div>
          <NutritionTrendChart
            points={nutritionSeries}
            targets={nutritionTargets}
          />
        </section>

        <section className="section-panel load-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Targets</p>
              <h2>Daily target setup</h2>
            </div>
            <p>Update the default targets the daily nutrition score uses.</p>
          </div>

          <form className="entry-form" onSubmit={onSaveTargets}>
            <div className="entry-grid">
              <label>
                Calories
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={nutritionTargetsFormState.calories}
                  onChange={(event) =>
                    onNutritionTargetsInputChange(
                      'calories',
                      event.currentTarget.value,
                    )
                  }
                />
              </label>

              <label>
                Protein (g)
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={nutritionTargetsFormState.protein}
                  onChange={(event) =>
                    onNutritionTargetsInputChange(
                      'protein',
                      event.currentTarget.value,
                    )
                  }
                />
              </label>

              <label>
                Carbs (g)
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={nutritionTargetsFormState.carbs}
                  onChange={(event) =>
                    onNutritionTargetsInputChange(
                      'carbs',
                      event.currentTarget.value,
                    )
                  }
                />
              </label>

              <label>
                Fat (g)
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={nutritionTargetsFormState.fat}
                  onChange={(event) =>
                    onNutritionTargetsInputChange(
                      'fat',
                      event.currentTarget.value,
                    )
                  }
                />
              </label>

              <label>
                Hydration (L)
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={nutritionTargetsFormState.hydration}
                  onChange={(event) =>
                    onNutritionTargetsInputChange(
                      'hydration',
                      event.currentTarget.value,
                    )
                  }
                />
              </label>
            </div>

            <div className="entry-footer">
              <div className="load-preview">
                <span>Active calories target</span>
                <strong>{formatCalories(nutritionTargets.calories)}</strong>
              </div>
              <div className="entry-actions">
                <button type="submit" className="primary-button">
                  Save targets
                </button>
              </div>
            </div>

            {targetsErrorMessage ? (
              <p className="form-error">{targetsErrorMessage}</p>
            ) : null}
          </form>

          <NutritionTargetBreakdown
            entry={latestNutritionEntry}
            targets={nutritionTargets}
          />
        </section>

        <section className="section-panel sessions-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Nutrition log</p>
              <h2>Recent days</h2>
            </div>
            <p>Saving a new entry for the same date replaces the older one.</p>
          </div>
          <RecentNutritionTable
            entries={recentNutritionEntries}
            onDelete={onDeleteEntry}
          />
        </section>
      </main>
    </div>
  )
}

function WorkoutReadinessDial({
  readiness,
}: {
  readiness: WorkoutGeneratorPlan['readiness']
}) {
  const radius = 82
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0.08, readiness.score / 100)
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="ratio-dial">
      <svg viewBox="0 0 200 200" className="ratio-dial-graphic" aria-hidden="true">
        <circle className="ratio-dial-track" cx="100" cy="100" r={radius} />
        <circle
          className="ratio-dial-progress"
          cx="100"
          cy="100"
          r={radius}
          stroke={readiness.color}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="ratio-dial-copy">
        <span className="ratio-dial-value">{readiness.score}</span>
        <span className="ratio-dial-label">readiness</span>
        <strong className="ratio-dial-band" style={{ color: readiness.color }}>
          {readiness.label}
        </strong>
      </div>
    </div>
  )
}

function WorkoutContextCard({
  kicker,
  value,
  detail,
  tone,
}: {
  kicker: string
  value: string
  detail: string
  tone: string
}) {
  return (
    <article
      className="generator-context-card"
      style={{ '--generator-accent': tone } as CSSProperties}
    >
      <p className="section-kicker">{kicker}</p>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  )
}

function WorkoutGeneratorWorkspace({
  formState,
  onInputChange,
  plan,
  currentSnapshot,
  ratioBand,
  latestRecoveryEntry,
  recoveryBand,
  latestNutritionEntry,
  nutritionBand,
  weeklySessionCount,
  homeEquipment,
  customHomeEquipment,
  onOpenHomeEquipmentSettings,
  onUseSuggestion,
  onRemixSuggestion,
  onSwapSuggestionExercise,
  feedbackMessage,
}: {
  formState: WorkoutGeneratorFormState
  onInputChange: (field: keyof WorkoutGeneratorFormState, value: string) => void
  plan: WorkoutGeneratorPlan
  currentSnapshot: DailyLoadPoint | undefined
  ratioBand: RatioBand
  latestRecoveryEntry: RecoveryEntry | undefined
  recoveryBand: RecoveryBand
  latestNutritionEntry: NutritionEntry | undefined
  nutritionBand: NutritionBand
  weeklySessionCount: number
  homeEquipment: HomeEquipmentId[]
  customHomeEquipment: CustomHomeEquipment[]
  onOpenHomeEquipmentSettings: () => void
  onUseSuggestion: (suggestion: WorkoutSuggestion) => void
  onRemixSuggestion: (suggestion: WorkoutSuggestion) => void
  onSwapSuggestionExercise: (
    suggestion: WorkoutSuggestion,
    exerciseIndex: number,
  ) => void
  feedbackMessage: string
}) {
  const goalOption = getWorkoutGoalOption(formState.goal)
  const modeOption = getWorkoutModeOption(formState.mode)
  const preferredMinutes = parsePositiveNumber(formState.availableMinutes)
  const recommendedSuggestion = plan.suggestions[0]
  const [expandedSuggestionId, setExpandedSuggestionId] =
    useState<WorkoutSuggestion['id']>('recommended')
  const homeEquipmentSummary = formatHomeEquipmentSummary(
    homeEquipment,
    customHomeEquipment,
  )
  const totalHomeEquipmentCount = getTotalHomeEquipmentCount(
    homeEquipment,
    customHomeEquipment,
  )

  return (
    <div className="content-shell">
      <header className="content-header">
        <p className="eyebrow">Workout generator</p>
        <h1>Build a session that matches today's readiness.</h1>
        <p className="content-summary">
          Pick the goal, format, and time you have today. The generator scales
          the session from workload, recovery, and fueling so you can use it
          immediately instead of guessing.
        </p>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <div>
            <p className="section-kicker">Session brief</p>
            <h2>Prescription for {formatLongDate(formState.date)}</h2>
          </div>
          <div className="hero-metadata">
            <div>
              <span>Goal</span>
              <strong>{goalOption.label}</strong>
              <small>{goalOption.summary}</small>
            </div>
            <div>
              <span>Format</span>
              <strong>{modeOption.label}</strong>
              <small>{modeOption.summary}</small>
            </div>
            <div>
              <span>Available time</span>
              <strong>{formatMinutes(preferredMinutes)}</strong>
              <small>recommendation updates instantly</small>
            </div>
          </div>
        </div>

        <aside className="hero-focus">
          <WorkoutReadinessDial readiness={plan.readiness} />
          <p className="hero-focus-summary">{plan.headline}</p>
          <p className="hero-focus-detail">{plan.detail}</p>
        </aside>
      </section>

      <main className="workspace">
        <section className="entry-panel section-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Generator input</p>
              <h2>Shape the session</h2>
            </div>
            <p>
              This first version turns goal, training format, and time available
              into session options you can save straight into the training log.
            </p>
          </div>

          <form className="entry-form" onSubmit={(event) => event.preventDefault()}>
            <div className="entry-grid">
              <label>
                Date
                <input
                  type="date"
                  value={formState.date}
                  onChange={(event) =>
                    onInputChange('date', event.currentTarget.value)
                  }
                />
              </label>

              <label>
                Goal
                <select
                  value={formState.goal}
                  onChange={(event) =>
                    onInputChange('goal', event.currentTarget.value)
                  }
                >
                  {WORKOUT_GOAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Format
                <div className="generator-format-row">
                  <select
                    value={formState.mode}
                    onChange={(event) =>
                      onInputChange('mode', event.currentTarget.value)
                    }
                  >
                    {WORKOUT_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {formState.mode === 'home' ? (
                    <button
                      type="button"
                      className="secondary-button generator-format-shortcut"
                      onClick={onOpenHomeEquipmentSettings}
                    >
                      Home equipment
                    </button>
                  ) : null}
                </div>
              </label>

              <label>
                Available time (min)
                <input
                  type="number"
                  inputMode="decimal"
                  min="20"
                  max="120"
                  step="5"
                  value={formState.availableMinutes}
                  onChange={(event) =>
                    onInputChange('availableMinutes', event.currentTarget.value)
                  }
                />
              </label>
            </div>

            <p className="generator-form-note">
              The generator uses your current ACWR, latest recovery check-in,
              and latest nutrition score to scale today's suggestion.
            </p>

            {formState.mode === 'home' ? (
              <div className="generator-home-setup">
                <div className="generator-home-setup-header">
                  <div>
                    <p className="section-kicker">Home setup</p>
                    <strong>
                      {totalHomeEquipmentCount
                        ? `${totalHomeEquipmentCount} equipment options selected`
                        : 'No equipment selected yet'}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={onOpenHomeEquipmentSettings}
                  >
                    Edit setup
                  </button>
                </div>
                <p>
                  {totalHomeEquipmentCount
                    ? `Home workouts will use ${homeEquipmentSummary}.`
                    : 'Home workouts will default to bodyweight, mobility, and in-place cardio until you add equipment in Settings.'}
                </p>
              </div>
            ) : null}

            <div className="entry-footer">
              <div className="load-preview">
                <span>Recommended session load</span>
                <strong>{formatLoad(recommendedSuggestion?.estimatedLoad ?? null)}</strong>
              </div>
              <p className="generator-inline-note">
                If the warm-up feels worse than expected, switch to the lower-load
                option instead of forcing the day.
              </p>
            </div>

            {feedbackMessage ? <p className="form-success">{feedbackMessage}</p> : null}
          </form>
        </section>

        <section className="section-panel trend-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Readiness signals</p>
              <h2>What is driving the prescription</h2>
            </div>
            <p>
              These signals shape the session intensity before any workout text is
              generated.
            </p>
          </div>

          <div className="generator-context-grid">
            <WorkoutContextCard
              kicker="Load"
              value={`${formatRatio(currentSnapshot?.ratio ?? null)} | ${ratioBand.label}`}
              detail={ratioBand.detail}
              tone={ratioBand.color}
            />
            <WorkoutContextCard
              kicker="Recovery"
              value={`${formatRecoveryScore(latestRecoveryEntry?.score ?? null)} | ${recoveryBand.label}`}
              detail={recoveryBand.detail}
              tone={recoveryBand.color}
            />
            <WorkoutContextCard
              kicker="Nutrition"
              value={`${formatNutritionScore(latestNutritionEntry?.score ?? null)} | ${nutritionBand.label}`}
              detail={nutritionBand.detail}
              tone={nutritionBand.color}
            />
            <WorkoutContextCard
              kicker="Readiness"
              value={`${plan.readiness.score} | ${plan.readiness.label}`}
              detail={plan.readiness.detail}
              tone={plan.readiness.color}
            />
          </div>
        </section>

        <section className="section-panel load-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Coach notes</p>
              <h2>How to use today's recommendation</h2>
            </div>
            <p>
              The rules below explain why the generator is nudging the session up
              or down today.
            </p>
          </div>

          <div className="generator-adjustment-grid">
            {plan.adjustments.map((adjustment) => (
              <article key={adjustment} className="generator-adjustment-card">
                <span className="generator-adjustment-dot" aria-hidden="true" />
                <p>{adjustment}</p>
              </article>
            ))}
          </div>

          <p className="trend-footnote">
            {weeklySessionCount} sessions have been logged over the last 7 days,
            so the generator is treating this as part of the current weekly load
            picture rather than a standalone day.
          </p>
        </section>

        <section className="section-panel sessions-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Session options</p>
              <h2>Choose a session and log it</h2>
            </div>
            <p>
              Every option includes duration, target RPE, estimated load, and a
              specific exercise list once you select it.
            </p>
          </div>

          <div className="generator-card-grid">
            {plan.suggestions.map((suggestion) => {
              const isExpanded = suggestion.id === expandedSuggestionId
              const detailId = `generator-suggestion-${suggestion.id}`
              const exercisePreview = suggestion.exercises
                .slice(0, 2)
                .map((exercise) => exercise.name)
                .join(', ')

              return (
                <article
                  key={suggestion.id}
                  className={`generator-card${
                    suggestion.id === 'recommended' ? ' is-featured' : ''
                  }${isExpanded ? ' is-expanded' : ''}`}
                >
                  <div className="generator-card-header">
                    <span className="generator-card-label">{suggestion.label}</span>
                    <h3>{suggestion.title}</h3>
                    <p>{suggestion.summary}</p>
                  </div>

                  <button
                    type="button"
                    className="generator-card-toggle"
                    onClick={() => setExpandedSuggestionId(suggestion.id)}
                    aria-expanded={isExpanded}
                    aria-controls={detailId}
                  >
                    <span>
                      {isExpanded
                        ? 'Selected workout'
                        : 'Select workout to view specifics'}
                    </span>
                    <span className="generator-card-chevron" aria-hidden="true">
                      {isExpanded ? '-' : '+'}
                    </span>
                  </button>

                  <div className="generator-metric-grid">
                    <div className="generator-metric">
                      <span>Duration</span>
                      <strong>{formatMinutes(suggestion.duration)}</strong>
                    </div>
                    <div className="generator-metric">
                      <span>Target RPE</span>
                      <strong>{formatRpe(suggestion.rpe)}</strong>
                    </div>
                    <div className="generator-metric">
                      <span>Estimated load</span>
                      <strong>{formatLoad(suggestion.estimatedLoad)}</strong>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div id={detailId} className="generator-card-details">
                      <div className="generator-card-toolbar">
                        <button
                          type="button"
                          className="ghost-button generator-inline-action"
                          onClick={() => onRemixSuggestion(suggestion)}
                        >
                          New workout variation
                        </button>
                      </div>

                      <div className="generator-card-section">
                        <p className="generator-card-section-title">
                          Suggested exercises
                        </p>
                        <div className="generator-exercise-list">
                          {suggestion.exercises.map((exercise, exerciseIndex) => (
                            <article
                              key={`${exercise.name}-${exercise.prescription}-${exerciseIndex}`}
                              className="generator-exercise"
                            >
                              <div className="generator-exercise-header">
                                <strong>{exercise.name}</strong>
                                <span className="generator-exercise-prescription">
                                  {exercise.prescription}
                                </span>
                              </div>
                              <p className="generator-exercise-copy">
                                {exercise.detail}
                              </p>
                              <div className="generator-exercise-actions">
                                <button
                                  type="button"
                                  className="ghost-button generator-inline-action"
                                  onClick={() =>
                                    onSwapSuggestionExercise(
                                      suggestion,
                                      exerciseIndex,
                                    )
                                  }
                                >
                                  Change exercise
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div className="generator-card-section">
                        <p className="generator-card-section-title">
                          Session flow
                        </p>
                        <div className="generator-block-list">
                          {suggestion.blocks.map((block) => (
                            <div key={block.label} className="generator-block">
                              <strong>{block.label}</strong>
                              <p>{block.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="generator-card-notes">
                        <p>
                          <strong>Why this fits:</strong> {suggestion.rationale}
                        </p>
                        <p>
                          <strong>Fueling:</strong> {suggestion.fueling}
                        </p>
                        <p>
                          <strong>Caution:</strong> {suggestion.caution}
                        </p>
                      </div>

                      <div className="entry-actions">
                        <button
                          type="button"
                          className={
                            suggestion.id === 'recommended'
                              ? 'primary-button'
                              : 'secondary-button'
                          }
                          onClick={() => onUseSuggestion(suggestion)}
                        >
                          Add to training log
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p id={detailId} className="generator-card-collapsed-copy">
                      Select this option to reveal the specific exercise list
                      {exercisePreview ? `, including ${exercisePreview}` : ''}.
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

function SettingsWorkspace({
  homeEquipment,
  customHomeEquipment,
  customEquipmentFormState,
  onCustomEquipmentInputChange,
  onAddCustomHomeEquipment,
  onRemoveCustomHomeEquipment,
  onToggleHomeEquipment,
  onClearHomeEquipment,
  onOpenWorkoutGenerator,
  errorMessage,
}: {
  homeEquipment: HomeEquipmentId[]
  customHomeEquipment: CustomHomeEquipment[]
  customEquipmentFormState: CustomHomeEquipmentFormState
  onCustomEquipmentInputChange: (
    field: keyof CustomHomeEquipmentFormState,
    value: string,
  ) => void
  onAddCustomHomeEquipment: (event: FormEvent<HTMLFormElement>) => void
  onRemoveCustomHomeEquipment: (equipmentId: string) => void
  onToggleHomeEquipment: (equipmentId: HomeEquipmentId) => void
  onClearHomeEquipment: () => void
  onOpenWorkoutGenerator: () => void
  errorMessage: string
}) {
  const selectedCount = getTotalHomeEquipmentCount(
    homeEquipment,
    customHomeEquipment,
  )
  const selectedEquipment = homeEquipment.map((equipmentId) =>
    getHomeEquipmentOption(equipmentId),
  )

  return (
    <div className="content-shell">
      <header className="content-header">
        <p className="eyebrow">Settings</p>
        <h1>Dial in the equipment you have at home.</h1>
        <p className="content-summary">
          The workout generator uses this list whenever you choose the home
          format, so the suggested exercises match what is actually available.
        </p>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <div>
            <p className="section-kicker">Home setup</p>
            <h2>
              {selectedCount
                ? `${selectedCount} tools ready for home sessions`
                : 'Bodyweight fallback is active'}
            </h2>
          </div>
          <div className="hero-metadata">
            <div>
              <span>Preset gear</span>
              <strong>
                {selectedEquipment.length}
              </strong>
              <small>built-in equipment options you have toggled on</small>
            </div>
            <div>
              <span>Custom gear</span>
              <strong>{customHomeEquipment.length}</strong>
              <small>equipment you added yourself by name and category</small>
            </div>
            <div>
              <span>Categories used</span>
              <strong>
                {
                  new Set([
                    ...selectedEquipment.map((equipment) => equipment.category),
                    ...customHomeEquipment.map((equipment) => equipment.category),
                  ]).size
                }
              </strong>
              <small>the home generator reads all selected categories</small>
            </div>
          </div>
        </div>

        <aside className="hero-focus">
          <p className="section-kicker">Current selection</p>
          <p className="hero-focus-summary">
            {selectedCount
              ? formatHomeEquipmentSummary(
                  homeEquipment,
                  customHomeEquipment,
                )
              : 'No equipment selected yet.'}
          </p>
          <p className="hero-focus-detail">
            {selectedCount
              ? 'You can change this any time and the generator will adapt right away.'
              : 'If you leave this empty, home workouts will stay bodyweight-first and space-efficient.'}
          </p>
        </aside>
      </section>

      <main className="workspace">
        <section className="entry-panel section-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Equipment list</p>
              <h2>Select what is available</h2>
            </div>
            <p>
              Toggle built-in equipment and add your own custom tools below.
            </p>
          </div>

          <div className="settings-category-stack">
            {HOME_EQUIPMENT_CATEGORY_OPTIONS.map((category) => {
              const categoryOptions = HOME_EQUIPMENT_OPTIONS.filter(
                (option) => option.category === category.value,
              )

              return (
                <section key={category.value} className="settings-category-section">
                  <div className="settings-category-heading">
                    <div>
                      <p className="section-kicker">{category.label}</p>
                      <h3>{category.summary}</h3>
                    </div>
                    <span className="settings-category-count">
                      {categoryOptions.filter((option) =>
                        homeEquipment.includes(option.value),
                      ).length +
                        customHomeEquipment.filter(
                          (equipment) => equipment.category === category.value,
                        ).length}
                    </span>
                  </div>

                  <div className="settings-equipment-grid">
                    {categoryOptions.map((option) => {
                      const isSelected = homeEquipment.includes(option.value)

                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`equipment-option${isSelected ? ' is-selected' : ''}`}
                          aria-pressed={isSelected}
                          onClick={() => onToggleHomeEquipment(option.value)}
                        >
                          <div className="equipment-option-header">
                            <strong>{option.label}</strong>
                            <span className="equipment-option-check">
                              {isSelected ? 'Selected' : 'Tap to add'}
                            </span>
                          </div>
                          <span className="equipment-option-category">
                            {category.label}
                          </span>
                          <p>{option.summary}</p>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>

          <section className="settings-custom-section">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Custom equipment</p>
                <h2>Add gear that is not listed yet</h2>
              </div>
              <p>
                Add any tool by name, then tag it with the category that best
                matches how you use it at home.
              </p>
            </div>

            <form className="entry-form" onSubmit={onAddCustomHomeEquipment}>
              <div className="entry-grid settings-custom-grid">
                <label>
                  Equipment name
                  <input
                    type="text"
                    value={customEquipmentFormState.name}
                    placeholder="Example: SkiErg, sandbag, cable tower"
                    onChange={(event) =>
                      onCustomEquipmentInputChange(
                        'name',
                        event.currentTarget.value,
                      )
                    }
                  />
                </label>

                <label>
                  Category
                  <select
                    value={customEquipmentFormState.category}
                    onChange={(event) =>
                      onCustomEquipmentInputChange(
                        'category',
                        event.currentTarget.value,
                      )
                    }
                  >
                    {HOME_EQUIPMENT_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="entry-footer">
                <div className="load-preview">
                  <span>Custom equipment</span>
                  <strong>{customHomeEquipment.length}</strong>
                </div>
                <div className="entry-actions">
                  <button type="submit" className="primary-button">
                    Add custom equipment
                  </button>
                </div>
              </div>

              {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
            </form>

            {customHomeEquipment.length ? (
              <div className="settings-custom-list">
                {customHomeEquipment.map((equipment) => (
                  <article
                    key={equipment.id}
                    className="settings-custom-card"
                  >
                    <div className="settings-custom-card-copy">
                      <span>
                        {getHomeEquipmentCategoryOption(equipment.category).label}
                      </span>
                      <strong>{equipment.name}</strong>
                    </div>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onRemoveCustomHomeEquipment(equipment.id)}
                    >
                      Remove
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="generator-card-collapsed-copy">
                Custom equipment you add here will be saved and included in home
                workout summaries automatically.
              </p>
            )}
          </section>

          <div className="entry-footer">
            <div className="load-preview">
              <span>Selected equipment</span>
              <strong>{selectedCount}</strong>
            </div>
            <div className="entry-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onOpenWorkoutGenerator}
              >
                Open workout generator
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={onClearHomeEquipment}
                disabled={!selectedCount}
              >
                Clear selection
              </button>
            </div>
          </div>
        </section>

        <section className="section-panel trend-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">How it works</p>
              <h2>What changes in home mode</h2>
            </div>
            <p>
              The home generator swaps in exercises that match your selected
              equipment, with bodyweight fallbacks whenever a tool is missing.
            </p>
          </div>

          <div className="generator-adjustment-grid">
            <article className="generator-adjustment-card">
              <span className="generator-adjustment-dot" aria-hidden="true" />
              <p>
                Cardio suggestions prefer your selected machines first, but they
                can also adapt to custom cardio tools you add by name.
              </p>
            </article>
            <article className="generator-adjustment-card">
              <span className="generator-adjustment-dot" aria-hidden="true" />
              <p>
                Strength suggestions now read broader home categories like free
                weights, strength setups, pulling stations, power tools, and
                mobility or recovery gear.
              </p>
            </article>
            <article className="generator-adjustment-card">
              <span className="generator-adjustment-dot" aria-hidden="true" />
              <p>
                If nothing is selected, the generator still works and keeps the
                session practical with bodyweight and mobility options.
              </p>
            </article>
          </div>
        </section>

        <section className="section-panel load-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Selected now</p>
              <h2>Your current home setup</h2>
            </div>
            <p>
              This is the exact equipment list the generator will use for the
              home format today.
            </p>
          </div>

          {selectedCount ? (
            <div className="settings-selected-grid">
              {selectedEquipment.map((equipment) => (
                <article key={equipment.value} className="settings-selected-card">
                  <span>
                    {getHomeEquipmentCategoryOption(equipment.category).label}
                  </span>
                  <strong>{equipment.label}</strong>
                  <p>{equipment.summary}</p>
                </article>
              ))}
              {customHomeEquipment.map((equipment) => (
                <article
                  key={equipment.id}
                  className="settings-selected-card is-custom"
                >
                  <span>
                    {getHomeEquipmentCategoryOption(equipment.category).label}
                  </span>
                  <strong>{equipment.name}</strong>
                  <p>Custom equipment you added for home workout generation.</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="generator-card-collapsed-copy">
              No home equipment is selected yet, so home workouts will default
              to bodyweight, mobility, and in-place conditioning options.
            </p>
          )}
        </section>
      </main>
    </div>
  )
}

function App() {
  const [sessions, setSessions] = useState<WorkloadSession[]>(() =>
    loadStoredSessions(),
  )
  const [recoveryEntries, setRecoveryEntries] = useState<RecoveryEntry[]>(() =>
    loadStoredRecoveryEntries(),
  )
  const [nutritionEntries, setNutritionEntries] = useState<NutritionEntry[]>(() =>
    loadStoredNutritionEntries(),
  )
  const [nutritionTargets, setNutritionTargets] = useState<NutritionTargets>(() =>
    loadStoredNutritionTargets(),
  )
  const [homeEquipment, setHomeEquipment] = useState<HomeEquipmentId[]>(() =>
    loadStoredHomeEquipment(),
  )
  const [customHomeEquipment, setCustomHomeEquipment] = useState<
    CustomHomeEquipment[]
  >(() => loadStoredCustomHomeEquipment())
  const [activeSection, setActiveSection] = useState<AppSectionId>('dashboard')
  const [formState, setFormState] = useState<SessionFormState>(() =>
    createEmptyFormState(),
  )
  const [recoveryFormState, setRecoveryFormState] = useState<RecoveryFormState>(() =>
    createEmptyRecoveryFormState(),
  )
  const [nutritionFormState, setNutritionFormState] = useState<NutritionFormState>(() =>
    createEmptyNutritionFormState(),
  )
  const [workoutGeneratorFormState, setWorkoutGeneratorFormState] =
    useState<WorkoutGeneratorFormState>(() => createEmptyWorkoutGeneratorFormState())
  const [nutritionTargetsFormState, setNutritionTargetsFormState] =
    useState<NutritionTargetsFormState>(() =>
      createNutritionTargetsFormState(loadStoredNutritionTargets()),
    )
  const [customEquipmentFormState, setCustomEquipmentFormState] =
    useState<CustomHomeEquipmentFormState>(() =>
      createEmptyCustomHomeEquipmentFormState(),
    )
  const [errorMessage, setErrorMessage] = useState('')
  const [recoveryErrorMessage, setRecoveryErrorMessage] = useState('')
  const [nutritionErrorMessage, setNutritionErrorMessage] = useState('')
  const [workoutGeneratorMessage, setWorkoutGeneratorMessage] = useState('')
  const [workoutSuggestionOverrideState, setWorkoutSuggestionOverrideState] =
    useState<WorkoutSuggestionOverrideState>({
      contextKey: '',
      suggestions: {},
    })
  const [nutritionTargetsErrorMessage, setNutritionTargetsErrorMessage] =
    useState('')
  const [homeEquipmentErrorMessage, setHomeEquipmentErrorMessage] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const deferredSessions = useDeferredValue(sessions)
  const deferredRecoveryEntries = useDeferredValue(recoveryEntries)
  const deferredNutritionEntries = useDeferredValue(nutritionEntries)
  const dailySeries = buildDailyLoadSeries(deferredSessions)
  const recoverySeries = buildRecoverySeries(deferredRecoveryEntries)
  const nutritionSeries = buildNutritionSeries(deferredNutritionEntries)
  const currentSnapshot = dailySeries.at(-1)
  const baselineProgress = getBaselineProgress(sessions)
  const ratioBand = getRatioBand(
    currentSnapshot?.ratio ?? null,
    currentSnapshot?.baselineReady ?? false,
  )
  const latestRecoveryEntry = recoveryEntries[0]
  const recoveryAverage = getRecoveryAverage(recoveryEntries)
  const recoveryHrvAverage = getRecoveryHrvAverage(recoveryEntries)
  const recoveryCheckIns = getRecoveryCheckIns(recoveryEntries)
  const recoveryBand = getRecoveryBand(latestRecoveryEntry?.score ?? null)
  const latestNutritionEntry = nutritionEntries[0]
  const nutritionAverage = getNutritionAverage(nutritionEntries)
  const nutritionAverageCalories = getNutritionAverageCalories(nutritionEntries)
  const nutritionLogCount = getNutritionLogCount(nutritionEntries)
  const nutritionBand = getNutritionBand(latestNutritionEntry?.score ?? null)
  const sessionLoadPreview =
    parsePositiveNumber(formState.loadOverride) ??
    createSessionLoad(
      parsePositiveNumber(formState.duration),
      parsePositiveNumber(formState.rpe),
    )
  const recoveryScorePreview = (() => {
    const sleepHours = parsePositiveNumber(recoveryFormState.sleepHours)
    const sleepQuality = parseScaleNumber(recoveryFormState.sleepQuality)
    const energy = parseScaleNumber(recoveryFormState.energy)
    const soreness = parseScaleNumber(recoveryFormState.soreness)
    const stress = parseScaleNumber(recoveryFormState.stress)
    const hydration = parseScaleNumber(recoveryFormState.hydration)

    if (
      sleepHours === null ||
      sleepQuality === null ||
      energy === null ||
      soreness === null ||
      stress === null ||
      hydration === null
    ) {
      return null
    }

    return calculateRecoveryScore({
      sleepHours,
      sleepQuality,
      energy,
      soreness,
      stress,
      hydration,
    })
  })()
  const nutritionScorePreview = (() => {
    const calories = parsePositiveNumber(nutritionFormState.calories)
    const protein = parsePositiveNumber(nutritionFormState.protein)
    const carbs = parsePositiveNumber(nutritionFormState.carbs)
    const fat = parsePositiveNumber(nutritionFormState.fat)
    const hydration = parsePositiveNumber(nutritionFormState.hydration)

    if (
      calories === null ||
      protein === null ||
      carbs === null ||
      fat === null ||
      hydration === null
    ) {
      return null
    }

    return calculateNutritionScore(
      { calories, protein, carbs, fat, hydration },
      nutritionTargets,
    )
  })()
  const recentSessions = sessions.slice(0, 8)
  const recentRecoveryEntries = recoveryEntries.slice(0, 8)
  const recentNutritionEntries = nutritionEntries.slice(0, 8)
  const weeklyPoints = dailySeries.slice(-7).toReversed()
  const weeklySessionCount = weeklyPoints.reduce(
    (total, point) => total + point.sessionCount,
    0,
  )
  const workoutGeneratorAvailableMinutes =
    parsePositiveNumber(workoutGeneratorFormState.availableMinutes) ?? 45
  const workoutGeneratorInput: WorkoutGeneratorInput = {
    goal: workoutGeneratorFormState.goal,
    mode: workoutGeneratorFormState.mode,
    availableMinutes: workoutGeneratorAvailableMinutes,
    ratio: currentSnapshot?.ratio ?? null,
    baselineReady: currentSnapshot?.baselineReady ?? false,
    recoveryScore: latestRecoveryEntry?.score ?? null,
    nutritionScore: latestNutritionEntry?.score ?? null,
    weeklySessionCount,
    homeEquipment,
    customHomeEquipment,
  }
  const workoutGeneratorContextKey = JSON.stringify(workoutGeneratorInput)
  const baseWorkoutGeneratorPlan = buildWorkoutGeneratorPlan(workoutGeneratorInput)
  const workoutSuggestionOverrides =
    workoutSuggestionOverrideState.contextKey === workoutGeneratorContextKey
      ? workoutSuggestionOverrideState.suggestions
      : {}
  const workoutGeneratorPlan: WorkoutGeneratorPlan = {
    ...baseWorkoutGeneratorPlan,
    suggestions: baseWorkoutGeneratorPlan.suggestions.map(
      (suggestion) => workoutSuggestionOverrides[suggestion.id] ?? suggestion,
    ),
  }

  useEffect(() => {
    window.localStorage.setItem(WORKLOAD_STORAGE_KEY, JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    window.localStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify(recoveryEntries),
    )
  }, [recoveryEntries])

  useEffect(() => {
    window.localStorage.setItem(
      NUTRITION_STORAGE_KEY,
      JSON.stringify(nutritionEntries),
    )
  }, [nutritionEntries])

  useEffect(() => {
    window.localStorage.setItem(
      NUTRITION_TARGETS_STORAGE_KEY,
      JSON.stringify(nutritionTargets),
    )
  }, [nutritionTargets])

  useEffect(() => {
    window.localStorage.setItem(
      HOME_EQUIPMENT_STORAGE_KEY,
      JSON.stringify(homeEquipment),
    )
  }, [homeEquipment])

  useEffect(() => {
    window.localStorage.setItem(
      CUSTOM_HOME_EQUIPMENT_STORAGE_KEY,
      JSON.stringify(customHomeEquipment),
    )
  }, [customHomeEquipment])

  useEffect(() => {
    if (!isSidebarOpen) {
      document.body.classList.remove('app-drawer-open')
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false)
      }
    }

    document.body.classList.add('app-drawer-open')
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.classList.remove('app-drawer-open')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSidebarOpen])

  const handleInputChange = (field: keyof SessionFormState, value: string) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleRecoveryInputChange = (
    field: keyof RecoveryFormState,
    value: string,
  ) => {
    setRecoveryFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleNutritionInputChange = (
    field: keyof NutritionFormState,
    value: string,
  ) => {
    setNutritionFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleWorkoutGeneratorInputChange = (
    field: keyof WorkoutGeneratorFormState,
    value: string,
  ) => {
    setWorkoutGeneratorMessage('')
    setWorkoutGeneratorFormState((current) => ({
      ...current,
      [field]: value as WorkoutGeneratorFormState[typeof field],
    }))
  }

  const handleRemixWorkoutSuggestion = (suggestion: WorkoutSuggestion) => {
    setWorkoutGeneratorMessage('')
    startTransition(() => {
      setWorkoutSuggestionOverrideState((current) => ({
        contextKey: workoutGeneratorContextKey,
        suggestions: {
          ...(current.contextKey === workoutGeneratorContextKey
            ? current.suggestions
            : {}),
          [suggestion.id]: createWorkoutSuggestionVariation(
            workoutGeneratorInput,
            suggestion,
          ),
        },
      }))
    })
  }

  const handleSwapWorkoutSuggestionExercise = (
    suggestion: WorkoutSuggestion,
    exerciseIndex: number,
  ) => {
    setWorkoutGeneratorMessage('')
    startTransition(() => {
      setWorkoutSuggestionOverrideState((current) => ({
        contextKey: workoutGeneratorContextKey,
        suggestions: {
          ...(current.contextKey === workoutGeneratorContextKey
            ? current.suggestions
            : {}),
          [suggestion.id]: swapWorkoutSuggestionExercise(
            workoutGeneratorInput,
            suggestion,
            exerciseIndex,
          ),
        },
      }))
    })
  }

  const handleNutritionTargetsInputChange = (
    field: keyof NutritionTargetsFormState,
    value: string,
  ) => {
    setNutritionTargetsFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleToggleHomeEquipment = (equipmentId: HomeEquipmentId) => {
    setHomeEquipmentErrorMessage('')
    setHomeEquipment((current) =>
      current.includes(equipmentId)
        ? current.filter((item) => item !== equipmentId)
        : sortHomeEquipmentSelection([...current, equipmentId]),
    )
  }

  const handleCustomHomeEquipmentInputChange = (
    field: keyof CustomHomeEquipmentFormState,
    value: string,
  ) => {
    setHomeEquipmentErrorMessage('')
    setCustomEquipmentFormState((current) => ({
      ...current,
      [field]: value as CustomHomeEquipmentFormState[typeof field],
    }))
  }

  const handleAddCustomHomeEquipment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = customEquipmentFormState.name.trim()

    if (!name) {
      setHomeEquipmentErrorMessage('Give the custom equipment a name first.')
      return
    }

    const normalizedName = name.toLowerCase()
    const duplicatePreset = HOME_EQUIPMENT_OPTIONS.some(
      (option) => option.label.toLowerCase() === normalizedName,
    )
    const duplicateCustom = customHomeEquipment.some(
      (equipment) => equipment.name.toLowerCase() === normalizedName,
    )

    if (duplicatePreset || duplicateCustom) {
      setHomeEquipmentErrorMessage(
        'That equipment is already in your home setup list.',
      )
      return
    }

    const nextCustomEquipment: CustomHomeEquipment = {
      id: createEntryId('custom-equipment'),
      name,
      category: customEquipmentFormState.category,
    }

    setCustomHomeEquipment((current) => [...current, nextCustomEquipment])
    setCustomEquipmentFormState(createEmptyCustomHomeEquipmentFormState())
    setHomeEquipmentErrorMessage('')
  }

  const handleRemoveCustomHomeEquipment = (equipmentId: string) => {
    setHomeEquipmentErrorMessage('')
    setCustomHomeEquipment((current) =>
      current.filter((equipment) => equipment.id !== equipmentId),
    )
  }

  const handleAddSession = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const customLoad = parsePositiveNumber(formState.loadOverride)
    const duration = parsePositiveNumber(formState.duration)
    const rpe = parsePositiveNumber(formState.rpe)
    const computedLoad = customLoad ?? createSessionLoad(duration, rpe)

    if (!formState.title.trim()) {
      setErrorMessage('Add a session name so the training log stays readable.')
      return
    }

    if (!formState.date) {
      setErrorMessage('Pick a training date for the session.')
      return
    }

    if (computedLoad === null) {
      setErrorMessage('Enter duration and RPE, or provide a custom workload.')
      return
    }

    const nextSession: WorkloadSession = {
      id: createEntryId('session'),
      title: formState.title.trim(),
      date: formState.date,
      duration: customLoad === null ? duration : null,
      rpe: customLoad === null ? rpe : null,
      load: computedLoad,
      notes: formState.notes.trim(),
      createdAt: new Date().toISOString(),
    }

    setSessions((current) => sortSessions([nextSession, ...current]))
    setFormState(createEmptyFormState(formState.date))
    setErrorMessage('')
  }

  const handleAddRecoveryEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const sleepHours = parsePositiveNumber(recoveryFormState.sleepHours)
    const hrv = parsePositiveNumber(recoveryFormState.hrv)
    const sleepQuality = parseScaleNumber(recoveryFormState.sleepQuality)
    const energy = parseScaleNumber(recoveryFormState.energy)
    const soreness = parseScaleNumber(recoveryFormState.soreness)
    const stress = parseScaleNumber(recoveryFormState.stress)
    const hydration = parseScaleNumber(recoveryFormState.hydration)

    if (!recoveryFormState.date) {
      setRecoveryErrorMessage('Pick a date for the recovery check-in.')
      return
    }

    if (
      sleepHours === null ||
      sleepQuality === null ||
      energy === null ||
      soreness === null ||
      stress === null ||
      hydration === null
    ) {
      setRecoveryErrorMessage('Complete all recovery markers before saving.')
      return
    }

    const nextEntry: RecoveryEntry = {
      id: createEntryId('recovery'),
      date: recoveryFormState.date,
      sleepHours,
      hrv,
      sleepQuality,
      energy,
      soreness,
      stress,
      hydration,
      notes: recoveryFormState.notes.trim(),
      score: calculateRecoveryScore({
        sleepHours,
        sleepQuality,
        energy,
        soreness,
        stress,
        hydration,
      }),
      createdAt: new Date().toISOString(),
    }

    setRecoveryEntries((current) =>
      sortRecoveryEntries([
        nextEntry,
        ...current.filter((entry) => entry.date !== nextEntry.date),
      ]),
    )
    setRecoveryFormState(createEmptyRecoveryFormState(recoveryFormState.date))
    setRecoveryErrorMessage('')
  }

  const handleAddNutritionEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const calories = parsePositiveNumber(nutritionFormState.calories)
    const protein = parsePositiveNumber(nutritionFormState.protein)
    const carbs = parsePositiveNumber(nutritionFormState.carbs)
    const fat = parsePositiveNumber(nutritionFormState.fat)
    const hydration = parsePositiveNumber(nutritionFormState.hydration)

    if (!nutritionFormState.date) {
      setNutritionErrorMessage('Pick a date for the nutrition day.')
      return
    }

    if (
      calories === null ||
      protein === null ||
      carbs === null ||
      fat === null ||
      hydration === null
    ) {
      setNutritionErrorMessage('Complete all nutrition totals before saving.')
      return
    }

    const nextEntry: NutritionEntry = {
      id: createEntryId('nutrition'),
      date: nutritionFormState.date,
      calories,
      protein,
      carbs,
      fat,
      hydration,
      notes: nutritionFormState.notes.trim(),
      score: calculateNutritionScore(
        { calories, protein, carbs, fat, hydration },
        nutritionTargets,
      ),
      createdAt: new Date().toISOString(),
    }

    setNutritionEntries((current) =>
      sortNutritionEntries([
        nextEntry,
        ...current.filter((entry) => entry.date !== nextEntry.date),
      ]),
    )
    setNutritionFormState(createEmptyNutritionFormState(nutritionFormState.date))
    setNutritionErrorMessage('')
  }

  const handleSaveNutritionTargets = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const calories = parsePositiveNumber(nutritionTargetsFormState.calories)
    const protein = parsePositiveNumber(nutritionTargetsFormState.protein)
    const carbs = parsePositiveNumber(nutritionTargetsFormState.carbs)
    const fat = parsePositiveNumber(nutritionTargetsFormState.fat)
    const hydration = parsePositiveNumber(nutritionTargetsFormState.hydration)

    if (
      calories === null ||
      protein === null ||
      carbs === null ||
      fat === null ||
      hydration === null
    ) {
      setNutritionTargetsErrorMessage('Complete all target values before saving.')
      return
    }

    const nextTargets: NutritionTargets = {
      calories,
      protein,
      carbs,
      fat,
      hydration,
    }

    setNutritionTargets(nextTargets)
    setNutritionEntries((current) =>
      current.map((entry) => ({
        ...entry,
        score: calculateNutritionScore(
          {
            calories: entry.calories,
            protein: entry.protein,
            carbs: entry.carbs,
            fat: entry.fat,
            hydration: entry.hydration,
          },
          nextTargets,
        ),
      })),
    )
    setNutritionTargetsFormState(createNutritionTargetsFormState(nextTargets))
    setNutritionTargetsErrorMessage('')
  }

  const handleUseGeneratedWorkout = (suggestion: WorkoutSuggestion) => {
    const exerciseDetails = suggestion.exercises
      .map(
        (exercise) =>
          `${exercise.name} (${exercise.prescription}): ${exercise.detail}`,
      )
      .join(' | ')

    const nextSession: WorkloadSession = {
      id: createEntryId('session'),
      title: suggestion.title,
      date: workoutGeneratorFormState.date,
      duration: suggestion.duration,
      rpe: suggestion.rpe,
      load: suggestion.estimatedLoad,
      notes: [
        `Format: ${getWorkoutModeOption(workoutGeneratorFormState.mode).label}.`,
        `Generator: ${suggestion.label}.`,
        workoutGeneratorFormState.mode === 'home'
          ? `Home equipment: ${formatHomeEquipmentSummary(
              homeEquipment,
              customHomeEquipment,
            )}.`
          : null,
        ...suggestion.blocks.map((block) => `${block.label}: ${block.detail}`),
        `Exercises: ${exerciseDetails}`,
        `Fueling: ${suggestion.fueling}`,
        `Caution: ${suggestion.caution}`,
      ]
        .filter((note): note is string => Boolean(note))
        .join(' '),
      createdAt: new Date().toISOString(),
    }

    setSessions((current) => sortSessions([nextSession, ...current]))
    setWorkoutGeneratorMessage(
      `${suggestion.title} was added to the training log for ${formatLongDate(
        workoutGeneratorFormState.date,
      )}.`,
    )
  }

  const handleLoadDemoData = () => {
    if (
      sessions.length &&
      !window.confirm('Replace your saved sessions with demo data?')
    ) {
      return
    }

    setSessions(createDemoSessions())
    setErrorMessage('')
  }

  const handleLoadRecoveryDemoData = () => {
    if (
      recoveryEntries.length &&
      !window.confirm('Replace your saved recovery check-ins with demo data?')
    ) {
      return
    }

    setRecoveryEntries(createDemoRecoveryEntries())
    setRecoveryErrorMessage('')
  }

  const handleLoadNutritionDemoData = () => {
    if (
      nutritionEntries.length &&
      !window.confirm('Replace your saved nutrition days with demo data?')
    ) {
      return
    }

    setNutritionEntries(createDemoNutritionEntries(nutritionTargets))
    setNutritionErrorMessage('')
  }

  const handleClearAll = () => {
    if (!sessions.length) {
      return
    }

    if (!window.confirm('Clear every saved workout from this browser?')) {
      return
    }

    setSessions([])
    setErrorMessage('')
  }

  const handleClearRecovery = () => {
    if (!recoveryEntries.length) {
      return
    }

    if (!window.confirm('Clear every saved recovery check-in from this browser?')) {
      return
    }

    setRecoveryEntries([])
    setRecoveryErrorMessage('')
  }

  const handleClearNutrition = () => {
    if (!nutritionEntries.length) {
      return
    }

    if (!window.confirm('Clear every saved nutrition day from this browser?')) {
      return
    }

    setNutritionEntries([])
    setNutritionErrorMessage('')
  }

  const handleDeleteSession = (sessionId: string) => {
    setSessions((current) =>
      current.filter((session) => session.id !== sessionId),
    )
  }

  const handleDeleteRecoveryEntry = (entryId: string) => {
    setRecoveryEntries((current) =>
      current.filter((entry) => entry.id !== entryId),
    )
  }

  const handleDeleteNutritionEntry = (entryId: string) => {
    setNutritionEntries((current) =>
      current.filter((entry) => entry.id !== entryId),
    )
  }

  const handleSelectSection = (section: AppSectionId) => {
    setIsSidebarOpen(false)
    startTransition(() => {
      setActiveSection(section)
    })
  }

  const activeSectionMeta =
    APP_SECTIONS.find((section) => section.id === activeSection) ?? APP_SECTIONS[0]

  return (
    <div className="app-shell">
      <button
        type="button"
        className={`app-menu-button${isSidebarOpen ? ' is-hidden' : ''}`}
        aria-label="Open navigation menu"
        aria-controls="app-sidebar"
        aria-expanded={isSidebarOpen}
        onClick={() => setIsSidebarOpen(true)}
      >
        <span className="app-menu-button-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>{activeSectionMeta.label}</span>
      </button>
      <button
        type="button"
        className={`sidebar-backdrop${isSidebarOpen ? ' is-visible' : ''}`}
        aria-label="Close navigation menu"
        tabIndex={isSidebarOpen ? 0 : -1}
        onClick={() => setIsSidebarOpen(false)}
      />
      <Sidebar
        activeSection={activeSection}
        onSelect={handleSelectSection}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentSnapshot={currentSnapshot}
        ratioBand={ratioBand}
        weeklySessionCount={weeklySessionCount}
        latestRecoveryEntry={latestRecoveryEntry}
        recoveryAverage={recoveryAverage}
        recoveryHrvAverage={recoveryHrvAverage}
        recoveryBand={recoveryBand}
        recoveryCheckIns={recoveryCheckIns}
        latestNutritionEntry={latestNutritionEntry}
        nutritionAverage={nutritionAverage}
        nutritionBand={nutritionBand}
        nutritionLogCount={nutritionLogCount}
        homeEquipment={homeEquipment}
        customHomeEquipment={customHomeEquipment}
      />

      <div className="app-content">
        {activeSection === 'dashboard' ? (
          <DashboardWorkspace
            currentSnapshot={currentSnapshot}
            baselineProgress={baselineProgress}
            ratioBand={ratioBand}
            weeklySessionCount={weeklySessionCount}
            latestRecoveryEntry={latestRecoveryEntry}
            recoveryAverage={recoveryAverage}
            recoveryBand={recoveryBand}
            recoveryCheckIns={recoveryCheckIns}
            latestNutritionEntry={latestNutritionEntry}
            nutritionAverage={nutritionAverage}
            nutritionBand={nutritionBand}
            nutritionLogCount={nutritionLogCount}
            onOpenSection={handleSelectSection}
          />
        ) : activeSection === 'workload' ? (
          <WorkloadWorkspace
            currentSnapshot={currentSnapshot}
            baselineProgress={baselineProgress}
            ratioBand={ratioBand}
            weeklySessionCount={weeklySessionCount}
            formState={formState}
            onInputChange={handleInputChange}
            onAddSession={handleAddSession}
            onLoadDemoData={handleLoadDemoData}
            onClearAll={handleClearAll}
            sessions={sessions}
            errorMessage={errorMessage}
            sessionLoadPreview={sessionLoadPreview}
            dailySeries={dailySeries}
            weeklyPoints={weeklyPoints}
            recentSessions={recentSessions}
            onDeleteSession={handleDeleteSession}
          />
        ) : activeSection === 'recovery' ? (
          <RecoveryWorkspace
            latestRecoveryEntry={latestRecoveryEntry}
            recoveryAverage={recoveryAverage}
            recoveryHrvAverage={recoveryHrvAverage}
            recoveryCheckIns={recoveryCheckIns}
            recoveryBand={recoveryBand}
            recoveryFormState={recoveryFormState}
            onInputChange={handleRecoveryInputChange}
            onAddEntry={handleAddRecoveryEntry}
            onLoadDemoData={handleLoadRecoveryDemoData}
            onClearAll={handleClearRecovery}
            recoveryEntries={recoveryEntries}
            errorMessage={recoveryErrorMessage}
            scorePreview={recoveryScorePreview}
            recoverySeries={recoverySeries}
            recentRecoveryEntries={recentRecoveryEntries}
            onDeleteEntry={handleDeleteRecoveryEntry}
          />
        ) : activeSection === 'nutrition' ? (
          <NutritionWorkspace
            latestNutritionEntry={latestNutritionEntry}
            nutritionAverage={nutritionAverage}
            nutritionAverageCalories={nutritionAverageCalories}
            nutritionLogCount={nutritionLogCount}
            nutritionBand={nutritionBand}
            nutritionTargets={nutritionTargets}
            nutritionFormState={nutritionFormState}
            nutritionTargetsFormState={nutritionTargetsFormState}
            onNutritionInputChange={handleNutritionInputChange}
            onNutritionTargetsInputChange={handleNutritionTargetsInputChange}
            onAddEntry={handleAddNutritionEntry}
            onSaveTargets={handleSaveNutritionTargets}
            onLoadDemoData={handleLoadNutritionDemoData}
            onClearAll={handleClearNutrition}
            nutritionEntries={nutritionEntries}
            errorMessage={nutritionErrorMessage}
            targetsErrorMessage={nutritionTargetsErrorMessage}
            scorePreview={nutritionScorePreview}
            nutritionSeries={nutritionSeries}
            recentNutritionEntries={recentNutritionEntries}
            onDeleteEntry={handleDeleteNutritionEntry}
          />
        ) : activeSection === 'settings' ? (
          <SettingsWorkspace
            homeEquipment={homeEquipment}
            customHomeEquipment={customHomeEquipment}
            customEquipmentFormState={customEquipmentFormState}
            onCustomEquipmentInputChange={handleCustomHomeEquipmentInputChange}
            onAddCustomHomeEquipment={handleAddCustomHomeEquipment}
            onRemoveCustomHomeEquipment={handleRemoveCustomHomeEquipment}
            onToggleHomeEquipment={handleToggleHomeEquipment}
            onClearHomeEquipment={() => {
              setHomeEquipment([])
              setCustomHomeEquipment([])
              setCustomEquipmentFormState(createEmptyCustomHomeEquipmentFormState())
              setHomeEquipmentErrorMessage('')
            }}
            onOpenWorkoutGenerator={() => handleSelectSection('workout-generator')}
            errorMessage={homeEquipmentErrorMessage}
          />
        ) : (
          <WorkoutGeneratorWorkspace
            formState={workoutGeneratorFormState}
            onInputChange={handleWorkoutGeneratorInputChange}
            plan={workoutGeneratorPlan}
            currentSnapshot={currentSnapshot}
            ratioBand={ratioBand}
            latestRecoveryEntry={latestRecoveryEntry}
            recoveryBand={recoveryBand}
            latestNutritionEntry={latestNutritionEntry}
            nutritionBand={nutritionBand}
            weeklySessionCount={weeklySessionCount}
            homeEquipment={homeEquipment}
            customHomeEquipment={customHomeEquipment}
            onOpenHomeEquipmentSettings={() => handleSelectSection('settings')}
            onUseSuggestion={handleUseGeneratedWorkout}
            onRemixSuggestion={handleRemixWorkoutSuggestion}
            onSwapSuggestionExercise={handleSwapWorkoutSuggestionExercise}
            feedbackMessage={workoutGeneratorMessage}
          />
        )}
      </div>
    </div>
  )
}

export default App
