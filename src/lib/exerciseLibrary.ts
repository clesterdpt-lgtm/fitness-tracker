import type { InjuryBodyArea } from './injury'

export type ExerciseStressLevel = 'low' | 'medium' | 'high' | 'load_dependent'

export type ExerciseContraindication = {
  conditionTag: string
  severity: 'absolute' | 'relative'
  note: string
}

export type ExerciseRegression = {
  name: string
  description: string
}

export type ExerciseJointStress = {
  jointName: string
  stressLevel: ExerciseStressLevel
}

export type ExerciseLibraryEntry = {
  name: string
  movementPattern: string
  systemicFatigueRating: number
  jointStresses: ExerciseJointStress[]
  contraindications: ExerciseContraindication[]
  regressions: ExerciseRegression[]
}

export type ExerciseLibrarySelectionContext = {
  activeConditionTags: string[]
  activeBodyAreas: InjuryBodyArea[]
  injuryAvailabilityScore: number | null
  readinessCap: 'low' | 'moderate' | 'high'
}

export type ExerciseLibraryAdjustment = {
  currentEntry: ExerciseLibraryEntry
  replacementEntry: ExerciseLibraryEntry | null
  reasons: string[]
  hasInjuryRisk: boolean
  hasFatigueRisk: boolean
}

export type ExerciseLibrarySelectionGoal =
  | 'endurance'
  | 'speed'
  | 'strength'
  | 'recovery'

export type ExerciseLibrarySelectionMode = 'gym' | 'mixed' | 'home'

export type ExerciseLibrarySelectionRequest = {
  movementPatterns: string[]
  context: ExerciseLibrarySelectionContext
  goal: ExerciseLibrarySelectionGoal
  mode: ExerciseLibrarySelectionMode
  allowedEquipment: string[] | null
  excludedNames?: string[]
}

export type ExerciseLibrarySelection = {
  entry: ExerciseLibraryEntry
  reason: string
}

type ExerciseRiskBreakdown = {
  score: number
  reasons: string[]
  hasAbsoluteContraindication: boolean
  hasInjuryRisk: boolean
  hasFatigueRisk: boolean
}

const STRESS_LEVEL_ORDER: Record<ExerciseStressLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  load_dependent: 4,
}

const BODY_AREA_JOINTS: Record<InjuryBodyArea, string[]> = {
  'neck-shoulder': ['shoulder'],
  'elbow-hand': ['elbow', 'wrist', 'grip'],
  'back-core': ['lumbar_spine'],
  'hip-glute': ['hip', 'hamstring'],
  knee: ['knee'],
  'ankle-foot': ['ankle'],
  other: [],
}

const MANUAL_EXERCISE_ALIASES: Array<{
  pattern: RegExp
  canonicalName: string
}> = [
  {
    pattern:
      /\b(rear foot elevated split squat|weighted vest split squat|tempo split squat|split squat hold)\b/,
    canonicalName: 'Bulgarian Split Squat',
  },
  {
    pattern: /\bsingle leg romanian deadlift\b/,
    canonicalName: 'Single-Leg RDL',
  },
  {
    pattern: /\b(barbell romanian deadlift|dumbbell romanian deadlift)\b/,
    canonicalName: 'Romanian Deadlift',
  },
  {
    pattern: /\b(dumbbell goblet squat|kettlebell goblet squat)\b/,
    canonicalName: 'Goblet Squat',
  },
  {
    pattern: /\b(single arm kettlebell floor press|push up or dumbbell floor press)\b/,
    canonicalName: 'Dumbbell Floor Press',
  },
  {
    pattern: /\b(weighted push up|tempo push up)\b/,
    canonicalName: 'Push-Up',
  },
  {
    pattern: /\bhalf kneeling pallof press\b/,
    canonicalName: 'Pallof Press',
  },
  {
    pattern: /\ba skip march\b/,
    canonicalName: 'A-Skip',
  },
  {
    pattern: /\blateral bounds\b/,
    canonicalName: 'Lateral Bound',
  },
  {
    pattern: /\bsingle leg calf raise\b/,
    canonicalName: 'Calf Raise',
  },
  {
    pattern: /\bhill repeats\b/,
    canonicalName: 'Hill Sprint',
  },
  {
    pattern: /\bmedicine ball scoop toss\b/,
    canonicalName: 'Medicine Ball Chest Pass',
  },
  {
    pattern: /\bpull up or assisted pull up\b/,
    canonicalName: 'Assisted Pull-Up',
  },
  {
    pattern: /\bbench supported one arm row\b/,
    canonicalName: 'Chest-Supported Row',
  },
  {
    pattern: /\bincline plyo push up\b/,
    canonicalName: 'Incline Push-Up',
  },
  {
    pattern: /\b(suitcase carry|suitcase march)\b/,
    canonicalName: 'Farmer Carry',
  },
  {
    pattern: /\b(side plank|shoulder tap plank|suspension plank saw)\b/,
    canonicalName: 'Plank',
  },
  {
    pattern: /\bdumbbell push press\b/,
    canonicalName: 'Overhead Press',
  },
  {
    pattern: /\bdumbbell bench or landmine press\b/,
    canonicalName: 'Landmine Press',
  },
  {
    pattern: /\bdumbbell bench press\b/,
    canonicalName: 'Barbell Bench Press',
  },
  {
    pattern: /\bmedicine ball slam\b/,
    canonicalName: 'Medicine Ball Slam',
  },
  {
    pattern: /\bsled push or easy bike block\b/,
    canonicalName: 'Sled Push',
  },
  {
    pattern: /\b(kettlebell deadlift|kettlebell deadlift or swing)\b/,
    canonicalName: 'Kettlebell Romanian Deadlift',
  },
  {
    pattern: /\btrap bar deadlift or goblet squat\b/,
    canonicalName: 'Goblet Squat',
  },
  {
    pattern: /\bbent over barbell row\b/,
    canonicalName: 'Barbell Row',
  },
  {
    pattern: /\b(bent over dumbbell row|band row|band or suspension row|suspension row|towel row iso)\b/,
    canonicalName: 'Inverted Row',
  },
]

const EXERCISE_EQUIPMENT_BY_NAME: Record<string, string> = {
  'A-Skip': 'bodyweight',
  'Assisted Pull-Up': 'machine',
  'Barbell Back Squat': 'barbell',
  'Barbell Bench Press': 'barbell',
  'Barbell Row': 'barbell',
  'Box Jump': 'bodyweight',
  'Box Squat': 'barbell',
  'Broad Jump': 'bodyweight',
  'Bulgarian Split Squat': 'dumbbell',
  'Calf Raise': 'machine',
  'Chest-Supported Row': 'machine',
  'Chin-Up': 'bodyweight',
  'Conventional Deadlift': 'barbell',
  'Dead Bug': 'bodyweight',
  'Dumbbell Floor Press': 'dumbbell',
  'Face Pull': 'cable',
  'Farmer Carry': 'dumbbell',
  'Goblet Squat': 'dumbbell',
  'Hill Sprint': 'bodyweight',
  'Hip Thrust': 'barbell',
  'Incline Push-Up': 'bodyweight',
  'Inverted Row': 'bodyweight',
  'Kettlebell Romanian Deadlift': 'kettlebell',
  'Landmine Press': 'barbell',
  'Lateral Bound': 'bodyweight',
  'Leg Curl': 'machine',
  'Leg Press': 'machine',
  'Medicine Ball Chest Pass': 'medicine_ball',
  'Medicine Ball Overhead Throw': 'medicine_ball',
  'Medicine Ball Slam': 'medicine_ball',
  'Overhead Carry': 'dumbbell',
  'Overhead Press': 'barbell',
  'Pallof Press': 'band',
  'Plank': 'bodyweight',
  'Pogo Jump': 'bodyweight',
  'Pull-Up': 'bodyweight',
  'Push-Up': 'bodyweight',
  'Romanian Deadlift': 'barbell',
  'Single-Leg Pogo': 'bodyweight',
  'Single-Leg RDL': 'dumbbell',
  'Skater Hop': 'bodyweight',
  'Sled Push': 'sled',
  Sprint: 'bodyweight',
  'T-Drill': 'bodyweight',
}

export const EXERCISE_LIBRARY: ExerciseLibraryEntry[] = [
  {
    name: 'Barbell Back Squat',
    movementPattern: 'squat',
    systemicFatigueRating: 5,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'load_dependent' },
      { jointName: 'hip', stressLevel: 'medium' },
      { jointName: 'lumbar_spine', stressLevel: 'load_dependent' },
      { jointName: 'ankle', stressLevel: 'medium' },
    ],
    contraindications: [
      {
        conditionTag: 'lumbar_disc',
        severity: 'absolute',
        note: 'Spinal compression under load directly aggravates disc issues.',
      },
      {
        conditionTag: 'knee_pain',
        severity: 'relative',
        note: 'May flare with deep flexion and valgus collapse; monitor or box squat.',
      },
    ],
    regressions: [
      {
        name: 'Goblet Squat',
        description: 'Front-loaded squat removes spinal compression, easier to learn.',
      },
      {
        name: 'Box Squat',
        description: 'Box controls depth and reduces stretch reflex demand.',
      },
      {
        name: 'Leg Press',
        description: 'Machine removes balance and core demands entirely.',
      },
    ],
  },
  {
    name: 'Goblet Squat',
    movementPattern: 'squat',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'low' },
      { jointName: 'lumbar_spine', stressLevel: 'low' },
      { jointName: 'ankle', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Box Squat',
    movementPattern: 'squat',
    systemicFatigueRating: 4,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'low' },
      { jointName: 'lumbar_spine', stressLevel: 'medium' },
    ],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Leg Press',
    movementPattern: 'squat',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'low' },
      { jointName: 'lumbar_spine', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Bulgarian Split Squat',
    movementPattern: 'lunge',
    systemicFatigueRating: 4,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'medium' },
      { jointName: 'ankle', stressLevel: 'medium' },
      { jointName: 'lumbar_spine', stressLevel: 'low' },
    ],
    contraindications: [
      {
        conditionTag: 'hip_flexor_strain',
        severity: 'relative',
        note: 'Rear hip flexor stretch under load can aggravate.',
      },
    ],
    regressions: [
      {
        name: 'Goblet Squat',
        description: 'Bilateral squat removes single-leg stability requirement.',
      },
    ],
  },
  {
    name: 'Conventional Deadlift',
    movementPattern: 'hinge',
    systemicFatigueRating: 5,
    jointStresses: [
      { jointName: 'lumbar_spine', stressLevel: 'high' },
      { jointName: 'hip', stressLevel: 'medium' },
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'wrist', stressLevel: 'medium' },
      { jointName: 'grip', stressLevel: 'high' },
    ],
    contraindications: [
      {
        conditionTag: 'lumbar_disc',
        severity: 'absolute',
        note: 'Shear and compressive forces are highest here.',
      },
      {
        conditionTag: 'hamstring_strain',
        severity: 'relative',
        note: 'Heavy loading may aggravate; use RDL with lighter loads.',
      },
    ],
    regressions: [
      {
        name: 'Romanian Deadlift',
        description: 'Reduced range and no floor start makes it lower stress.',
      },
      {
        name: 'Kettlebell Romanian Deadlift',
        description: 'Much lighter load to groove hinge pattern.',
      },
    ],
  },
  {
    name: 'Romanian Deadlift',
    movementPattern: 'hinge',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'hip', stressLevel: 'medium' },
      { jointName: 'lumbar_spine', stressLevel: 'medium' },
      { jointName: 'knee', stressLevel: 'low' },
      { jointName: 'wrist', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Kettlebell Romanian Deadlift',
    movementPattern: 'hinge',
    systemicFatigueRating: 2,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Single-Leg RDL',
    movementPattern: 'hinge',
    systemicFatigueRating: 3,
    jointStresses: [],
    contraindications: [],
    regressions: [
      {
        name: 'Kettlebell Romanian Deadlift',
        description: 'Bilateral version removes balance demand.',
      },
    ],
  },
  {
    name: 'Hip Thrust',
    movementPattern: 'hinge',
    systemicFatigueRating: 3,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Barbell Bench Press',
    movementPattern: 'push',
    systemicFatigueRating: 4,
    jointStresses: [
      { jointName: 'shoulder', stressLevel: 'load_dependent' },
      { jointName: 'elbow', stressLevel: 'medium' },
      { jointName: 'wrist', stressLevel: 'medium' },
    ],
    contraindications: [
      {
        conditionTag: 'shoulder_impingement',
        severity: 'relative',
        note: 'Flat barbell can aggravate; dumbbell or neutral grip may help.',
      },
    ],
    regressions: [
      {
        name: 'Push-Up',
        description: 'Bodyweight reduces absolute load; scalable via incline.',
      },
      {
        name: 'Dumbbell Floor Press',
        description:
          'Reduced ROM and dumbbells allow neutral grip, less shoulder stress.',
      },
    ],
  },
  {
    name: 'Dumbbell Floor Press',
    movementPattern: 'push',
    systemicFatigueRating: 2,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Push-Up',
    movementPattern: 'push',
    systemicFatigueRating: 2,
    jointStresses: [],
    contraindications: [],
    regressions: [
      {
        name: 'Incline Push-Up',
        description: 'Hands elevated reduces load on upper body.',
      },
    ],
  },
  {
    name: 'Incline Push-Up',
    movementPattern: 'push',
    systemicFatigueRating: 1,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Overhead Press',
    movementPattern: 'push',
    systemicFatigueRating: 4,
    jointStresses: [
      { jointName: 'shoulder', stressLevel: 'high' },
      { jointName: 'elbow', stressLevel: 'medium' },
      { jointName: 'wrist', stressLevel: 'medium' },
      { jointName: 'lumbar_spine', stressLevel: 'medium' },
    ],
    contraindications: [
      {
        conditionTag: 'shoulder_impingement',
        severity: 'absolute',
        note:
          'Full overhead ROM + heavy load is the worst combo for impingement.',
      },
    ],
    regressions: [
      {
        name: 'Landmine Press',
        description: 'Arced path is easier on shoulders than strict vertical.',
      },
    ],
  },
  {
    name: 'Landmine Press',
    movementPattern: 'push',
    systemicFatigueRating: 2,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Pull-Up',
    movementPattern: 'pull',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'shoulder', stressLevel: 'medium' },
      { jointName: 'elbow', stressLevel: 'medium' },
      { jointName: 'wrist', stressLevel: 'low' },
    ],
    contraindications: [
      {
        conditionTag: 'shoulder_labrum',
        severity: 'relative',
        note:
          'Deep overhead extension can stress labrum; neutral grip or assisted may help.',
      },
    ],
    regressions: [
      {
        name: 'Assisted Pull-Up',
        description: 'Machine counterweight reduces load.',
      },
      {
        name: 'Inverted Row',
        description: 'Horizontal pull is much easier than vertical.',
      },
    ],
  },
  {
    name: 'Chin-Up',
    movementPattern: 'pull',
    systemicFatigueRating: 3,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Inverted Row',
    movementPattern: 'pull',
    systemicFatigueRating: 2,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Assisted Pull-Up',
    movementPattern: 'pull',
    systemicFatigueRating: 2,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Barbell Row',
    movementPattern: 'pull',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'lumbar_spine', stressLevel: 'medium' },
      { jointName: 'shoulder', stressLevel: 'medium' },
      { jointName: 'elbow', stressLevel: 'low' },
      { jointName: 'wrist', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Chest-Supported Row',
    movementPattern: 'pull',
    systemicFatigueRating: 2,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Face Pull',
    movementPattern: 'pull',
    systemicFatigueRating: 1,
    jointStresses: [
      { jointName: 'shoulder', stressLevel: 'medium' },
      { jointName: 'elbow', stressLevel: 'low' },
    ],
    contraindications: [
      {
        conditionTag: 'shoulder_impingement',
        severity: 'relative',
        note:
          'External rotation is generally good, but high elbow position can irritate some.',
      },
    ],
    regressions: [],
  },
  {
    name: 'Plank',
    movementPattern: 'carry',
    systemicFatigueRating: 2,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Dead Bug',
    movementPattern: 'carry',
    systemicFatigueRating: 1,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Pallof Press',
    movementPattern: 'rotation',
    systemicFatigueRating: 2,
    jointStresses: [],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Farmer Carry',
    movementPattern: 'carry',
    systemicFatigueRating: 3,
    jointStresses: [],
    contraindications: [
      {
        conditionTag: 'grip_issue',
        severity: 'absolute',
        note:
          'Grip-intensive exercise should be avoided with active forearm pathology.',
      },
    ],
    regressions: [],
  },
  {
    name: 'Overhead Carry',
    movementPattern: 'carry',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'shoulder', stressLevel: 'high' },
      { jointName: 'wrist', stressLevel: 'medium' },
      { jointName: 'elbow', stressLevel: 'medium' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'Farmer Carry',
        description: 'Arms at sides removes overhead stability demand.',
      },
    ],
  },
  {
    name: 'Leg Curl',
    movementPattern: 'hinge',
    systemicFatigueRating: 2,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Calf Raise',
    movementPattern: 'squat',
    systemicFatigueRating: 1,
    jointStresses: [
      { jointName: 'ankle', stressLevel: 'medium' },
      { jointName: 'knee', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Sprint',
    movementPattern: 'run',
    systemicFatigueRating: 4,
    jointStresses: [
      { jointName: 'hamstring', stressLevel: 'high' },
      { jointName: 'hip', stressLevel: 'medium' },
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'ankle', stressLevel: 'medium' },
      { jointName: 'lumbar_spine', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'Sled Push',
        description:
          'Loaded walking push removes max-velocity hamstring strain risk.',
      },
      {
        name: 'A-Skip',
        description: 'Drill-only rhythm work with no max-effort sprinting.',
      },
    ],
  },
  {
    name: 'Broad Jump',
    movementPattern: 'jump',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'medium' },
      { jointName: 'ankle', stressLevel: 'high' },
      { jointName: 'lumbar_spine', stressLevel: 'medium' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'Box Jump',
        description: 'Box landing removes repeated impact stress on joints.',
      },
      {
        name: 'Pogo Jump',
        description:
          'Continuous low-amplitude jumps reduce per-rep landing forces.',
      },
    ],
  },
  {
    name: 'Box Jump',
    movementPattern: 'jump',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'medium' },
      { jointName: 'ankle', stressLevel: 'medium' },
      { jointName: 'lumbar_spine', stressLevel: 'medium' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'Pogo Jump',
        description:
          'Lower amplitude removes height demand and landing depth.',
      },
    ],
  },
  {
    name: 'Lateral Bound',
    movementPattern: 'jump',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'medium' },
      { jointName: 'ankle', stressLevel: 'high' },
      { jointName: 'lumbar_spine', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'Skater Hop',
        description:
          'Continuous rhythmic hops are lower shock per rep than stick landing.',
      },
      {
        name: 'Single-Leg Pogo',
        description:
          'Remove lateral stress; keep unilateral reactivity but no side-to-side.',
      },
    ],
  },
  {
    name: 'Skater Hop',
    movementPattern: 'jump',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'medium' },
      { jointName: 'ankle', stressLevel: 'high' },
      { jointName: 'lumbar_spine', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'Pogo Jump',
        description:
          'Bilateral vertical hops remove lateral ankle stress and deceleration demand.',
      },
    ],
  },
  {
    name: 'T-Drill',
    movementPattern: 'run',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'low' },
      { jointName: 'ankle', stressLevel: 'medium' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'A-Skip',
        description:
          'Remove all directional changes; pure running mechanics drill.',
      },
    ],
  },
  {
    name: 'Pogo Jump',
    movementPattern: 'jump',
    systemicFatigueRating: 2,
    jointStresses: [
      { jointName: 'ankle', stressLevel: 'high' },
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Single-Leg Pogo',
    movementPattern: 'jump',
    systemicFatigueRating: 2,
    jointStresses: [
      { jointName: 'ankle', stressLevel: 'high' },
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'low' },
      { jointName: 'lumbar_spine', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'Pogo Jump',
        description:
          'Bilateral version removes single-leg balance and ankle stability demand.',
      },
    ],
  },
  {
    name: 'A-Skip',
    movementPattern: 'run',
    systemicFatigueRating: 2,
    jointStresses: [
      { jointName: 'hip', stressLevel: 'low' },
      { jointName: 'knee', stressLevel: 'low' },
      { jointName: 'ankle', stressLevel: 'low' },
      { jointName: 'lumbar_spine', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Medicine Ball Chest Pass',
    movementPattern: 'push',
    systemicFatigueRating: 2,
    jointStresses: [
      { jointName: 'shoulder', stressLevel: 'medium' },
      { jointName: 'elbow', stressLevel: 'medium' },
      { jointName: 'wrist', stressLevel: 'low' },
      { jointName: 'lumbar_spine', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [],
  },
  {
    name: 'Medicine Ball Overhead Throw',
    movementPattern: 'push',
    systemicFatigueRating: 2,
    jointStresses: [
      { jointName: 'shoulder', stressLevel: 'medium' },
      { jointName: 'elbow', stressLevel: 'medium' },
      { jointName: 'lumbar_spine', stressLevel: 'medium' },
      { jointName: 'wrist', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'Medicine Ball Chest Pass',
        description:
          'Horizontal only removes overhead arc and full-body extension complexity.',
      },
    ],
  },
  {
    name: 'Medicine Ball Slam',
    movementPattern: 'rotation',
    systemicFatigueRating: 3,
    jointStresses: [
      { jointName: 'shoulder', stressLevel: 'medium' },
      { jointName: 'lumbar_spine', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'low' },
      { jointName: 'wrist', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'Medicine Ball Chest Pass',
        description:
          'Remove rotation, overhead slam, and impact. Simple horizontal push.',
      },
    ],
  },
  {
    name: 'Sled Push',
    movementPattern: 'run',
    systemicFatigueRating: 4,
    jointStresses: [
      { jointName: 'knee', stressLevel: 'medium' },
      { jointName: 'hip', stressLevel: 'low' },
      { jointName: 'ankle', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'Farmer Carry',
        description:
          'Walking with load removes leg-drive intensity while keeping loaded gait.',
      },
    ],
  },
  {
    name: 'Hill Sprint',
    movementPattern: 'run',
    systemicFatigueRating: 4,
    jointStresses: [
      { jointName: 'hamstring', stressLevel: 'high' },
      { jointName: 'knee', stressLevel: 'high' },
      { jointName: 'hip', stressLevel: 'medium' },
      { jointName: 'ankle', stressLevel: 'medium' },
      { jointName: 'lumbar_spine', stressLevel: 'low' },
    ],
    contraindications: [],
    regressions: [
      {
        name: 'Sprint',
        description:
          'Flat ground sprinting is actually LESS concentric demanding than hill.',
      },
      {
        name: 'A-Skip',
        description: 'Drill removes max-velocity and incline loading entirely.',
      },
    ],
  },
]

const exerciseLibraryByName = new Map(
  EXERCISE_LIBRARY.map((entry) => [entry.name, entry]),
)

const exerciseLibraryByNormalizedName = new Map(
  EXERCISE_LIBRARY.map((entry) => [normalizeExerciseName(entry.name), entry]),
)

function normalizeExerciseName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function humanizeLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function getRelevantJoints(bodyAreas: InjuryBodyArea[]) {
  return Array.from(
    new Set(bodyAreas.flatMap((bodyArea) => BODY_AREA_JOINTS[bodyArea])),
  )
}

function getJointStressThreshold(
  activeBodyAreas: InjuryBodyArea[],
  injuryAvailabilityScore: number | null,
) {
  if (!activeBodyAreas.length) {
    return null
  }

  if (injuryAvailabilityScore === null) {
    return 'high'
  }

  if (injuryAvailabilityScore < 40) {
    return 'low'
  }

  if (injuryAvailabilityScore < 60) {
    return 'medium'
  }

  if (injuryAvailabilityScore < 80) {
    return 'high'
  }

  return 'load_dependent'
}

function matchesJointStressThreshold(
  stressLevel: ExerciseStressLevel,
  threshold: ExerciseStressLevel,
) {
  return STRESS_LEVEL_ORDER[stressLevel] >= STRESS_LEVEL_ORDER[threshold]
}

function buildRiskBreakdown(
  entry: ExerciseLibraryEntry,
  context: ExerciseLibrarySelectionContext,
): ExerciseRiskBreakdown {
  const reasons = new Set<string>()
  let score = 0
  let hasAbsoluteContraindication = false
  let hasInjuryRisk = false
  let hasFatigueRisk = false

  for (const contraindication of entry.contraindications) {
    if (!context.activeConditionTags.includes(contraindication.conditionTag)) {
      continue
    }

    hasInjuryRisk = true
    reasons.add(`${humanizeLabel(contraindication.conditionTag)} risk`)
    score += contraindication.severity === 'absolute' ? 100 : 45
    hasAbsoluteContraindication ||= contraindication.severity === 'absolute'
  }

  const threshold = getJointStressThreshold(
    context.activeBodyAreas,
    context.injuryAvailabilityScore,
  )

  if (threshold) {
    const relevantJoints = getRelevantJoints(context.activeBodyAreas)

    for (const jointStress of entry.jointStresses) {
      if (
        !relevantJoints.includes(jointStress.jointName) ||
        !matchesJointStressThreshold(jointStress.stressLevel, threshold)
      ) {
        continue
      }

      hasInjuryRisk = true
      reasons.add(`${humanizeLabel(jointStress.jointName)} stress`)
      score += 18 + STRESS_LEVEL_ORDER[jointStress.stressLevel] * 6
    }
  }

  if (
    (context.readinessCap === 'low' && entry.systemicFatigueRating >= 4) ||
    (context.readinessCap === 'moderate' && entry.systemicFatigueRating >= 5)
  ) {
    hasFatigueRisk = true
    reasons.add('fatigue cap')
    score +=
      context.readinessCap === 'low'
        ? 20 + (entry.systemicFatigueRating - 4) * 6
        : 12
  }

  return {
    score,
    reasons: Array.from(reasons),
    hasAbsoluteContraindication,
    hasInjuryRisk,
    hasFatigueRisk,
  }
}

function getTargetFatigueRating(
  goal: ExerciseLibrarySelectionGoal,
  context: ExerciseLibrarySelectionContext,
) {
  if (context.readinessCap === 'low' || goal === 'recovery') {
    return 2
  }

  if (context.readinessCap === 'moderate') {
    return goal === 'strength' ? 3 : 2
  }

  switch (goal) {
    case 'strength':
      return 4
    case 'speed':
      return 3
    case 'endurance':
      return 3
  }
}

function getEquipmentScore(
  entry: ExerciseLibraryEntry,
  allowedEquipment: string[] | null,
) {
  const equipment = getExerciseLibraryEquipment(entry)

  if (allowedEquipment === null) {
    return equipment === 'machine' || equipment === 'cable' ? -1 : 0
  }

  if (allowedEquipment.includes(equipment)) {
    return equipment === 'bodyweight' ? -2 : -4
  }

  return 999
}

function getGoalPatternScore(
  entry: ExerciseLibraryEntry,
  request: ExerciseLibrarySelectionRequest,
) {
  if (request.goal === 'speed') {
    return ['jump', 'run', 'rotation'].includes(entry.movementPattern) ? -4 : 0
  }

  if (request.goal === 'recovery') {
    return entry.systemicFatigueRating <= 2 ? -3 : 0
  }

  if (request.goal === 'strength') {
    return ['squat', 'hinge', 'push', 'pull'].includes(entry.movementPattern)
      ? -2
      : 0
  }

  return ['carry', 'rotation'].includes(entry.movementPattern) ? -1 : 0
}

function scoreExerciseLibraryCandidate(
  entry: ExerciseLibraryEntry,
  request: ExerciseLibrarySelectionRequest,
) {
  const breakdown = buildRiskBreakdown(entry, request.context)
  const equipmentScore = getEquipmentScore(entry, request.allowedEquipment)
  const targetFatigue = getTargetFatigueRating(request.goal, request.context)

  return {
    breakdown,
    score:
      breakdown.score * 3 +
      equipmentScore +
      Math.abs(entry.systemicFatigueRating - targetFatigue) * 7 +
      getGoalPatternScore(entry, request),
  }
}

function buildSelectionReason(
  entry: ExerciseLibraryEntry,
  request: ExerciseLibrarySelectionRequest,
  breakdown: ExerciseRiskBreakdown,
) {
  const reasons = [`${humanizeLabel(entry.movementPattern)} pattern`]

  if (request.allowedEquipment !== null) {
    const equipment = EXERCISE_EQUIPMENT_BY_NAME[entry.name] ?? 'bodyweight'
    reasons.push(`${humanizeLabel(equipment)} available`)
  }

  if (breakdown.reasons.length) {
    reasons.push(`screened for ${breakdown.reasons.join(', ')}`)
  } else if (
    request.context.activeBodyAreas.length ||
    request.context.activeConditionTags.length
  ) {
    reasons.push('clearer injury profile')
  }

  if (request.context.readinessCap !== 'high') {
    reasons.push(`${request.context.readinessCap} readiness cap`)
  }

  return reasons.join(', ')
}

function getRegressionEntries(entry: ExerciseLibraryEntry) {
  return entry.regressions
    .map((regression) => exerciseLibraryByName.get(regression.name) ?? null)
    .filter((candidate): candidate is ExerciseLibraryEntry => candidate !== null)
}

function isBetterReplacement(
  candidate: ExerciseLibraryEntry,
  candidateBreakdown: ExerciseRiskBreakdown,
  currentBest: {
    entry: ExerciseLibraryEntry
    breakdown: ExerciseRiskBreakdown
  } | null,
) {
  if (!currentBest) {
    return true
  }

  if (candidateBreakdown.score !== currentBest.breakdown.score) {
    return candidateBreakdown.score < currentBest.breakdown.score
  }

  if (
    candidate.systemicFatigueRating !== currentBest.entry.systemicFatigueRating
  ) {
    return (
      candidate.systemicFatigueRating < currentBest.entry.systemicFatigueRating
    )
  }

  return candidate.name.localeCompare(currentBest.entry.name) < 0
}

export function findExerciseLibraryEntry(exerciseName: string) {
  const normalizedExerciseName = normalizeExerciseName(exerciseName)

  if (!normalizedExerciseName) {
    return null
  }

  const directMatch = exerciseLibraryByNormalizedName.get(normalizedExerciseName)

  if (directMatch) {
    return directMatch
  }

  const aliasMatch = MANUAL_EXERCISE_ALIASES.find(({ pattern }) =>
    pattern.test(normalizedExerciseName),
  )

  if (aliasMatch) {
    return exerciseLibraryByName.get(aliasMatch.canonicalName) ?? null
  }

  const normalizedTokens = normalizedExerciseName.split(' ')

  for (const entry of EXERCISE_LIBRARY) {
    const normalizedEntryName = normalizeExerciseName(entry.name)
    const entryTokens = normalizedEntryName.split(' ')

    if (
      entryTokens.length > 1 &&
      entryTokens.every((token) => normalizedTokens.includes(token))
    ) {
      return entry
    }
  }

  return null
}

export function getExerciseLibraryEquipment(entry: ExerciseLibraryEntry) {
  return EXERCISE_EQUIPMENT_BY_NAME[entry.name] ?? 'bodyweight'
}

export function selectExerciseLibraryEntry(
  request: ExerciseLibrarySelectionRequest,
): ExerciseLibrarySelection | null {
  const normalizedExcludedNames = new Set(
    (request.excludedNames ?? []).map(normalizeExerciseName),
  )

  const candidates = EXERCISE_LIBRARY.filter((entry) =>
    request.movementPatterns.includes(entry.movementPattern),
  )
    .filter(
      (entry) =>
        request.allowedEquipment === null ||
        request.allowedEquipment.includes(getExerciseLibraryEquipment(entry)),
    )
    .filter((entry) => !normalizedExcludedNames.has(normalizeExerciseName(entry.name)))
    .map((entry) => ({
      entry,
      ...scoreExerciseLibraryCandidate(entry, request),
    }))
    .filter(({ breakdown, score }) => {
      if (breakdown.hasAbsoluteContraindication) {
        return false
      }

      return score < 999
    })
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score
      }

      if (
        left.entry.systemicFatigueRating !== right.entry.systemicFatigueRating
      ) {
        return (
          left.entry.systemicFatigueRating -
          right.entry.systemicFatigueRating
        )
      }

      return left.entry.name.localeCompare(right.entry.name)
    })

  const selected = candidates[0]

  if (!selected) {
    return null
  }

  return {
    entry: selected.entry,
    reason: buildSelectionReason(
      selected.entry,
      request,
      selected.breakdown,
    ),
  }
}

export function getExerciseLibraryAdjustment(
  exerciseName: string,
  context: ExerciseLibrarySelectionContext,
): ExerciseLibraryAdjustment | null {
  const currentEntry = findExerciseLibraryEntry(exerciseName)

  if (!currentEntry) {
    return null
  }

  const currentBreakdown = buildRiskBreakdown(currentEntry, context)

  if (!currentBreakdown.score) {
    return null
  }

  let bestReplacement: {
    entry: ExerciseLibraryEntry
    breakdown: ExerciseRiskBreakdown
  } | null = null

  for (const candidate of getRegressionEntries(currentEntry)) {
    const candidateBreakdown = buildRiskBreakdown(candidate, context)

    if (
      candidateBreakdown.hasAbsoluteContraindication ||
      candidateBreakdown.score >= currentBreakdown.score
    ) {
      continue
    }

    if (isBetterReplacement(candidate, candidateBreakdown, bestReplacement)) {
      bestReplacement = {
        entry: candidate,
        breakdown: candidateBreakdown,
      }
    }
  }

  return {
    currentEntry,
    replacementEntry: bestReplacement?.entry ?? null,
    reasons: currentBreakdown.reasons,
    hasInjuryRisk: currentBreakdown.hasInjuryRisk,
    hasFatigueRisk: currentBreakdown.hasFatigueRisk,
  }
}

export function getExerciseLibraryVariationEntries(
  exerciseName: string,
  context: ExerciseLibrarySelectionContext,
) {
  const currentEntry = findExerciseLibraryEntry(exerciseName)

  if (!currentEntry) {
    return []
  }

  const currentBreakdown = buildRiskBreakdown(currentEntry, context)

  return getRegressionEntries(currentEntry)
    .map((candidate) => ({
      entry: candidate,
      breakdown: buildRiskBreakdown(candidate, context),
    }))
    .filter(({ breakdown }) => !breakdown.hasAbsoluteContraindication)
    .filter(
      ({ breakdown }) =>
        !currentBreakdown.score || breakdown.score <= currentBreakdown.score,
    )
    .sort((left, right) => {
      if (left.breakdown.score !== right.breakdown.score) {
        return left.breakdown.score - right.breakdown.score
      }

      if (
        left.entry.systemicFatigueRating !== right.entry.systemicFatigueRating
      ) {
        return (
          left.entry.systemicFatigueRating -
          right.entry.systemicFatigueRating
        )
      }

      return left.entry.name.localeCompare(right.entry.name)
    })
    .map(({ entry }) => entry)
}
