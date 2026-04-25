import { formatDateInput, shiftDate, compareDateInputs } from './workload'

export type MuscleGroupRole = 'primary' | 'secondary' | 'stabilizer'

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export type ExerciseMuscleAssignment = {
  muscle: MuscleGroup
  role: MuscleGroupRole
}

export type MuscleVolumeEntry = {
  id: string
  date: string
  muscleGroup: MuscleGroup
  sets: number
  source: 'manual' | 'workout-generator'
  note: string
  createdAt: string
}

/* ===========================================================
   Volume targets based on meta-analytic evidence
   Sources:
   - Pelland et al. (2025) dose-response meta-regression
   - Baz-Valle et al. (2022) moderate vs high volume
   - Schoenfeld et al. (2017) volume meta-analysis
   - Menno Henselmans / Examine fractional set approach
   - JMax Fitness fiber-type guidelines

   Fractional counting rule:
   - Primary movers = 1.0 set
   - Secondary movers = 0.5 set
   - Stabilizers = 0.25 set
   This aligns with the "fractional" quantification method
   used in the 2025 Sports Medicine meta-analysis.

   Notes:
   - Targets are weekly (7-day rolling).
   - Ranges account for both training status and
     whether a muscle is a high-responder or needs
     extra stimulus (e.g., triceps benefit >20 sets).
   - Core targets are intentionally lower because
     core also receives stabilizer volume from
     nearly every compound movement.
   =========================================================== */

export type MuscleVolumeTarget = {
  muscle: MuscleGroup
  minSets: number      // minimum effective volume (MEV)
  optimalSets: number  // maximum recoverable / diminishing-returns start (MRV-ish)
  maintenanceSets: number
  note: string
}

export const MUSCLE_VOLUME_TARGETS: MuscleVolumeTarget[] = [
  {
    muscle: 'Chest',
    minSets: 6,
    optimalSets: 16,
    maintenanceSets: 4,
    note: 'Bench press counts as 1.0 for chest and 0.5 for triceps/front delts.',
  },
  {
    muscle: 'Back',
    minSets: 8,
    optimalSets: 20,
    maintenanceSets: 5,
    note: 'Large surface area; vertical/horizontal pulls give ~0.5 biceps credit each.',
  },
  {
    muscle: 'Shoulders',
    minSets: 6,
    optimalSets: 14,
    maintenanceSets: 4,
    note: 'Rear delts often undertrained; presses add 0.5 front-delt credit.',
  },
  {
    muscle: 'Biceps',
    minSets: 6,
    optimalSets: 14,
    maintenanceSets: 4,
    note: 'Rows/pullups count as ~0.5 per set. Direct curl work still important.',
  },
  {
    muscle: 'Triceps',
    minSets: 8,
    optimalSets: 20,    // Baz-Valle 2022: triceps uniquely benefit >20 sets
    maintenanceSets: 5,
    note: 'Bench/OHP = 0.5 per set. Long head needs overhead extension isolation.',
  },
  {
    muscle: 'Quadriceps',
    minSets: 6,
    optimalSets: 16,
    maintenanceSets: 4,
    note: 'Baz-Valle: no extra benefit >20 sets. Mixed fiber types = varied reps help.',
  },
  {
    muscle: 'Hamstrings',
    minSets: 6,
    optimalSets: 14,
    maintenanceSets: 4,
    note: 'RDL/deadlift = direct. Very fast-twitch dominant; lower reps work well.',
  },
  {
    muscle: 'Glutes',
    minSets: 6,
    optimalSets: 16,
    maintenanceSets: 4,
    note: 'Slightly slow-twitch dominant. Hip thrusts and squats both contribute.',
  },
  {
    muscle: 'Calves',
    minSets: 8,
    optimalSets: 16,
    maintenanceSets: 4,
    note: 'Extremely slow-twitch. High frequency (3-6x/week) and higher reps preferred.',
  },
  {
    muscle: 'Core',
    minSets: 4,
    optimalSets: 10,
    maintenanceSets: 3,
    note: 'Receives heavy indirect volume from squats, deadlifts, presses, carries.',
  },
]

export function getMuscleVolumeTarget(muscle: MuscleGroup): MuscleVolumeTarget | undefined {
  return MUSCLE_VOLUME_TARGETS.find((t) => t.muscle === muscle)
}

export type MuscleVolumeGoalStatus =
  | { label: 'Optimal'; color: '#2f7d69'; reachedMin: true; reachedOptimal: true }
  | { label: 'Minimum'; color: '#4f7a86'; reachedMin: true; reachedOptimal: false }
  | { label: 'Under'; color: '#b56b21'; reachedMin: false; reachedOptimal: false }
  | { label: 'None';  color: '#8b6c4a'; reachedMin: false; reachedOptimal: false }

export function getMuscleVolumeGoalStatus(
  sets: number,
  target: MuscleVolumeTarget,
): MuscleVolumeGoalStatus {
  if (sets >= target.optimalSets) {
    return { label: 'Optimal', color: '#2f7d69', reachedMin: true, reachedOptimal: true }
  }
  if (sets >= target.minSets) {
    return { label: 'Minimum', color: '#4f7a86', reachedMin: true, reachedOptimal: false }
  }
  if (sets > 0) {
    return { label: 'Under', color: '#b56b21', reachedMin: false, reachedOptimal: false }
  }
  return { label: 'None', color: '#8b6c4a', reachedMin: false, reachedOptimal: false }
}

/* ===========================================================
   Exercise → muscle map using fractional (0.5) rule
   for indirect sets. This matches the quantification
   validated in the 2025 dose-response meta-regression.
   =========================================================== */

const EXERCISE_MUSCLE_MAP: Record<string, ExerciseMuscleAssignment[]> = {
  'Barbell Back Squat': [
    { muscle: 'Quadriceps', role: 'primary' },
    { muscle: 'Glutes', role: 'primary' },
    { muscle: 'Core', role: 'secondary' },
    { muscle: 'Hamstrings', role: 'secondary' },
  ],
  'Goblet Squat': [
    { muscle: 'Quadriceps', role: 'primary' },
    { muscle: 'Glutes', role: 'primary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Box Squat': [
    { muscle: 'Quadriceps', role: 'primary' },
    { muscle: 'Glutes', role: 'primary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Leg Press': [
    { muscle: 'Quadriceps', role: 'primary' },
    { muscle: 'Glutes', role: 'primary' },
    { muscle: 'Hamstrings', role: 'secondary' },
  ],
  'Bulgarian Split Squat': [
    { muscle: 'Quadriceps', role: 'primary' },
    { muscle: 'Glutes', role: 'primary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Conventional Deadlift': [
    { muscle: 'Hamstrings', role: 'primary' },
    { muscle: 'Glutes', role: 'primary' },
    { muscle: 'Back', role: 'primary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Romanian Deadlift': [
    { muscle: 'Hamstrings', role: 'primary' },
    { muscle: 'Glutes', role: 'primary' },
    { muscle: 'Back', role: 'secondary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Kettlebell Romanian Deadlift': [
    { muscle: 'Hamstrings', role: 'primary' },
    { muscle: 'Glutes', role: 'primary' },
    { muscle: 'Back', role: 'secondary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Single-Leg RDL': [
    { muscle: 'Hamstrings', role: 'primary' },
    { muscle: 'Glutes', role: 'primary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Hip Thrust': [
    { muscle: 'Glutes', role: 'primary' },
    { muscle: 'Hamstrings', role: 'secondary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Barbell Bench Press': [
    { muscle: 'Chest', role: 'primary' },
    { muscle: 'Triceps', role: 'primary' },
    { muscle: 'Shoulders', role: 'secondary' },
  ],
  'Dumbbell Floor Press': [
    { muscle: 'Chest', role: 'primary' },
    { muscle: 'Triceps', role: 'primary' },
    { muscle: 'Shoulders', role: 'secondary' },
  ],
  'Push-Up': [
    { muscle: 'Chest', role: 'primary' },
    { muscle: 'Triceps', role: 'primary' },
    { muscle: 'Core', role: 'secondary' },
    { muscle: 'Shoulders', role: 'secondary' },
  ],
  'Incline Push-Up': [
    { muscle: 'Chest', role: 'primary' },
    { muscle: 'Triceps', role: 'secondary' },
    { muscle: 'Shoulders', role: 'secondary' },
  ],
  'Overhead Press': [
    { muscle: 'Shoulders', role: 'primary' },
    { muscle: 'Triceps', role: 'primary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Landmine Press': [
    { muscle: 'Shoulders', role: 'primary' },
    { muscle: 'Chest', role: 'secondary' },
    { muscle: 'Triceps', role: 'secondary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Pull-Up': [
    { muscle: 'Back', role: 'primary' },
    { muscle: 'Biceps', role: 'primary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Assisted Pull-Up': [
    { muscle: 'Back', role: 'primary' },
    { muscle: 'Biceps', role: 'primary' },
  ],
  'Chin-Up': [
    { muscle: 'Back', role: 'primary' },
    { muscle: 'Biceps', role: 'primary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Barbell Row': [
    { muscle: 'Back', role: 'primary' },
    { muscle: 'Biceps', role: 'secondary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Chest-Supported Row': [
    { muscle: 'Back', role: 'primary' },
    { muscle: 'Biceps', role: 'secondary' },
  ],
  'Inverted Row': [
    { muscle: 'Back', role: 'primary' },
    { muscle: 'Biceps', role: 'secondary' },
    { muscle: 'Core', role: 'secondary' },
  ],
  'Face Pull': [
    { muscle: 'Shoulders', role: 'primary' },
    { muscle: 'Back', role: 'secondary' },
  ],
  'Pallof Press': [
    { muscle: 'Core', role: 'primary' },
    { muscle: 'Shoulders', role: 'secondary' },
  ],
  'Plank': [
    { muscle: 'Core', role: 'primary' },
    { muscle: 'Shoulders', role: 'secondary' },
  ],
  'Farmer Carry': [
    { muscle: 'Core', role: 'primary' },
    { muscle: 'Back', role: 'secondary' },
    { muscle: 'Shoulders', role: 'secondary' },
    { muscle: 'Calves', role: 'secondary' },
  ],
  'Calf Raise': [
    { muscle: 'Calves', role: 'primary' },
  ],
  'Leg Curl': [
    { muscle: 'Hamstrings', role: 'primary' },
  ],
}

const ROLE_MULTIPLIER: Record<MuscleGroupRole, number> = {
  primary: 1,
  secondary: 0.5,
  stabilizer: 0.25,
}

export function parseSetsFromPrescription(prescription: string): number | null {
  const match = prescription.match(/^(\d+)(?:-\d+)?\s*x\s+/i)
  if (match) return Number(match[1])

  const roundsMatch = prescription.match(/^(\d+)\s+(?:rounds?|rounds?\s+of)/i)
  if (roundsMatch) return Number(roundsMatch[1])

  const timeMatch = prescription.match(/(\d+)\s*min/i)
  if (timeMatch) {
    const minutes = Number(timeMatch[1])
    return minutes <= 5 ? 1 : minutes <= 10 ? 2 : 3
  }

  const circuitMatch = prescription.match(/(\d+)\s*rounds\s+of/i)
  if (circuitMatch) return Number(circuitMatch[1])

  return null
}

export function estimateMuscleSetsFromExercise(
  name: string,
  prescription: string,
): Array<{ muscle: MuscleGroup; sets: number }> {
  const rawSets = parseSetsFromPrescription(prescription)
  const sets = rawSets ?? 1

  const assignments = EXERCISE_MUSCLE_MAP[name]
  if (!assignments) return []

  return assignments.map(({ muscle, role }) => ({
    muscle,
    sets: sets * ROLE_MULTIPLIER[role],
  }))
}

export type WeeklyMuscleSummary = {
  date: string
  totalSets: number
  byMuscle: Record<MuscleGroup, number>
}

export function getWeeklyMuscleSummary(
  entries: MuscleVolumeEntry[],
  referenceDate?: string,
): WeeklyMuscleSummary {
  const endDate = referenceDate ?? formatDateInput()
  const startDate = shiftDate(endDate, -6)

  const filtered = entries.filter(
    (entry) =>
      compareDateInputs(entry.date, startDate) >= 0 &&
      compareDateInputs(entry.date, endDate) <= 0,
  )

  const byMuscle: Record<MuscleGroup, number> = MUSCLE_GROUPS.reduce(
    (acc, muscle) => {
      acc[muscle] = 0
      return acc
    },
    {} as Record<MuscleGroup, number>,
  )

  for (const entry of filtered) {
    byMuscle[entry.muscleGroup] += entry.sets
  }

  const totalSets = Object.values(byMuscle).reduce((sum, val) => sum + val, 0)

  return { date: endDate, totalSets, byMuscle }
}

export function createMuscleVolumeEntry(
  date: string,
  muscleGroup: MuscleGroup,
  sets: number,
  note = '',
  source: 'manual' | 'workout-generator' = 'manual',
): MuscleVolumeEntry {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `mv-${crypto.randomUUID()}`
      : `mv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date,
    muscleGroup,
    sets: Math.round(sets * 10) / 10,
    source,
    note,
    createdAt: new Date().toISOString(),
  }
}

export function sortMuscleVolumeEntries(entries: MuscleVolumeEntry[]) {
  return [...entries].sort(
    (left, right) =>
      compareDateInputs(right.date, left.date) ||
      right.createdAt.localeCompare(left.createdAt),
  )
}

export function estimateMuscleSetsFromWorkout(
  _workoutName: string,
  exercises: Array<{ name: string; prescription: string }>,
): Array<{ muscle: MuscleGroup; sets: number }> {
  const totals: Partial<Record<MuscleGroup, number>> = {}

  for (const exercise of exercises) {
    const exerciseAssignments = estimateMuscleSetsFromExercise(
      exercise.name,
      exercise.prescription,
    )
    for (const assignment of exerciseAssignments) {
      totals[assignment.muscle] =
        (totals[assignment.muscle] ?? 0) + assignment.sets
    }
  }

  return Object.entries(totals)
    .map(([muscle, sets]) => ({
      muscle: muscle as MuscleGroup,
      sets: Math.round((sets ?? 0) * 10) / 10,
    }))
    .filter((item) => item.sets > 0)
}

export function buildMuscleEntriesFromWorkout(
  date: string,
  workoutName: string,
  exercises: Array<{ name: string; prescription: string }>,
): MuscleVolumeEntry[] {
  const muscleSets = estimateMuscleSetsFromWorkout(workoutName, exercises)
  return muscleSets.map(({ muscle, sets }) =>
    createMuscleVolumeEntry(date, muscle, sets, workoutName, 'workout-generator'),
  )
}

export function getMuscleGroupLabel(muscle: MuscleGroup) {
  return muscle
}

/* Legacy banding kept for backward compatibility */
export type MuscleVolumeBand =
  | { label: 'Well covered'; color: '#2f7d69' }
  | { label: 'Good progress'; color: '#4f7a86' }
  | { label: 'Light week'; color: '#b56b21' }
  | { label: 'No volume'; color: '#8b6c4a' }

const VOLUME_THRESHOLDS = [
  { min: 15, band: { label: 'Well covered', color: '#2f7d69' } as MuscleVolumeBand },
  { min: 8, band: { label: 'Good progress', color: '#4f7a86' } as MuscleVolumeBand },
  { min: 1, band: { label: 'Light week', color: '#b56b21' } as MuscleVolumeBand },
  { min: 0, band: { label: 'No volume', color: '#8b6c4a' } as MuscleVolumeBand },
]

export function getMuscleVolumeBand(sets: number): MuscleVolumeBand {
  return VOLUME_THRESHOLDS.find((t) => sets >= t.min)?.band ?? VOLUME_THRESHOLDS[VOLUME_THRESHOLDS.length - 1].band
}
