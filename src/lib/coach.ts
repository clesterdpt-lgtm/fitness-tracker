import { getNutritionBand, type NutritionEntry, type NutritionTargets } from './nutrition'
import { getRecoveryBand, type RecoveryEntry } from './recovery'
import {
  createWorkoutSuggestionVariation,
  type WorkoutExerciseSuggestion,
  type WorkoutGeneratorInput,
  type WorkoutGeneratorPlan,
  type WorkoutReadiness,
  type WorkoutSuggestion,
  type WorkoutSuggestionBlock,
} from './workoutGenerator'
import { getRatioBand, type WorkloadSession } from './workload'

const COACH_REQUEST_VERSION = 1
const MIN_TIMEOUT_MS = 3_000
const MAX_TIMEOUT_MS = 60_000

export type AthleteTrainingAge = 'beginner' | 'intermediate' | 'advanced'

export type AthletePrimaryGoal =
  | 'general-fitness'
  | 'fat-loss'
  | 'muscle-gain'
  | 'endurance'
  | 'strength'
  | 'return-to-training'

export type AthleteProfile = {
  name: string
  trainingAge: AthleteTrainingAge
  primaryGoal: AthletePrimaryGoal
  weeklyAvailability: number
  sessionPreference: string
  limitations: string
  preferences: string
  notes: string
}

export type CoachConfig = {
  assistantName: string
  endpointUrl: string
  requestTimeoutMs: number
}

export type CoachRequestIntent = 'full-plan' | 'variation'

type CoachMetricSnapshot = {
  value: string
  label: string
  detail: string
}

type CoachSessionSummary = Pick<
  WorkloadSession,
  'date' | 'title' | 'duration' | 'rpe' | 'load' | 'notes'
>

type CoachRecoverySnapshot = Pick<
  RecoveryEntry,
  'date' | 'score' | 'sleepHours' | 'hrv' | 'notes'
>

type CoachNutritionSnapshot = Pick<
  NutritionEntry,
  'date' | 'score' | 'calories' | 'protein' | 'hydration' | 'notes'
>

export type CoachVariationTarget = {
  suggestionId: WorkoutSuggestion['id']
  label: string
  title: string
  summary: string
  duration: number
  rpe: number
  estimatedLoad: number
  rationale: string
  blocks: WorkoutSuggestionBlock[]
  exercises: WorkoutExerciseSuggestion[]
}

type CoachRequestContext = {
  intent: CoachRequestIntent
  objective: string
  variationTarget: CoachVariationTarget | null
}

type CoachIntensityGuardrail = {
  suggestionId: WorkoutSuggestion['id']
  label: string
  maxDuration: number
  maxRpe: number
  maxEstimatedLoad: number
}

type CoachIntensityProfile = {
  readinessScore: number
  readinessLabel: string
  readinessCap: WorkoutReadiness['cap']
  targetDuration: number
  maxDuration: number
  maxRpe: number
  maxEstimatedLoad: number
  loadLabel: string
  recoveryLabel: string
  nutritionLabel: string
  weeklySessionCount: number
  guidance: string[]
  suggestionGuardrails: CoachIntensityGuardrail[]
}

export type CoachContext = {
  generatedAt: string
  athleteProfile: AthleteProfile
  athleteSummary: string
  workoutInput: WorkoutGeneratorInput
  equipmentSummary: string
  request: CoachRequestContext
  intensityProfile: CoachIntensityProfile
  metrics: {
    load: CoachMetricSnapshot
    recovery: CoachMetricSnapshot
    nutrition: CoachMetricSnapshot
    weeklySessionCount: number
  }
  recentSessions: CoachSessionSummary[]
  latestRecovery: CoachRecoverySnapshot | null
  latestNutrition: CoachNutritionSnapshot | null
  nutritionTargets: NutritionTargets
  basePlan: WorkoutGeneratorPlan
  guidelines: string[]
}

export type CoachPlanSource = 'openclaw' | 'fallback'

export type CoachPlanResult = {
  source: CoachPlanSource
  coachName: string
  generatedAt: string
  plan: WorkoutGeneratorPlan
  insights: string[]
  recoveryRecommendations: string[]
  nutritionRecommendations: string[]
  weeklyFocus: string
  warnings: string[]
}

type BuildCoachContextInput = {
  athleteProfile: AthleteProfile
  workoutInput: WorkoutGeneratorInput
  basePlan: WorkoutGeneratorPlan
  currentRatio: number | null
  baselineReady: boolean
  recentSessions: WorkloadSession[]
  latestRecoveryEntry: RecoveryEntry | undefined
  latestNutritionEntry: NutritionEntry | undefined
  nutritionTargets: NutritionTargets
  equipmentSummary: string
  requestIntent?: CoachRequestIntent
  variationTarget?: WorkoutSuggestion | null
}

export const DEFAULT_ATHLETE_PROFILE: AthleteProfile = {
  name: '',
  trainingAge: 'intermediate',
  primaryGoal: 'general-fitness',
  weeklyAvailability: 4,
  sessionPreference: '',
  limitations: '',
  preferences: '',
  notes: '',
}

export const DEFAULT_COACH_CONFIG: CoachConfig = {
  assistantName: 'OpenClaw Coach',
  endpointUrl: '',
  requestTimeoutMs: 15_000,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function readJoinedString(value: unknown, fallback = '') {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    const nextValue = value
      .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      .join(' ')

    return nextValue || fallback
  }

  return fallback
}

function readFiniteNumber(
  value: unknown,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
) {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback
}

function readStringArray(value: unknown, fallback: string[] = []) {
  if (typeof value === 'string' && value.trim()) {
    return [value]
  }

  if (!Array.isArray(value)) {
    return fallback
  }

  const nextValues = value.filter((item): item is string => typeof item === 'string')

  return nextValues.length ? nextValues : fallback
}

function isAthleteTrainingAge(value: unknown): value is AthleteTrainingAge {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced'
}

function isAthletePrimaryGoal(value: unknown): value is AthletePrimaryGoal {
  return (
    value === 'general-fitness' ||
    value === 'fat-loss' ||
    value === 'muscle-gain' ||
    value === 'endurance' ||
    value === 'strength' ||
    value === 'return-to-training'
  )
}

function isSuggestionId(value: unknown): value is WorkoutSuggestion['id'] {
  return value === 'recommended' || value === 'lighter' || value === 'support'
}

function isReadinessCap(value: unknown): value is WorkoutReadiness['cap'] {
  return value === 'low' || value === 'moderate' || value === 'high'
}

function formatMetricValue(value: number | null, suffix = '') {
  return value === null ? 'Not logged' : `${value}${suffix}`
}

function getReadinessCapRank(cap: WorkoutReadiness['cap']) {
  switch (cap) {
    case 'low':
      return 0
    case 'moderate':
      return 1
    case 'high':
      return 2
  }
}

function clampReadinessCap(
  value: WorkoutReadiness['cap'],
  fallback: WorkoutReadiness['cap'],
) {
  return getReadinessCapRank(value) > getReadinessCapRank(fallback) ? fallback : value
}

function toVariationTarget(
  suggestion: WorkoutSuggestion | null | undefined,
): CoachVariationTarget | null {
  if (!suggestion) {
    return null
  }

  return {
    suggestionId: suggestion.id,
    label: suggestion.label,
    title: suggestion.title,
    summary: suggestion.summary,
    duration: suggestion.duration,
    rpe: suggestion.rpe,
    estimatedLoad: suggestion.estimatedLoad,
    rationale: suggestion.rationale,
    blocks: suggestion.blocks,
    exercises: suggestion.exercises,
  }
}

function buildCoachRequestContext(
  intent: CoachRequestIntent,
  variationTarget: WorkoutSuggestion | null | undefined,
): CoachRequestContext {
  const normalizedTarget = toVariationTarget(variationTarget)

  return {
    intent,
    objective:
      intent === 'variation' && normalizedTarget
        ? `Create a fresh variation of ${normalizedTarget.title} that stays at or below the same intensity and duration guardrails.`
        : "Generate a coach-authored workout plan with distinct options that respect today's intensity guardrails.",
    variationTarget: intent === 'variation' ? normalizedTarget : null,
  }
}

function buildCoachIntensityProfile(
  basePlan: WorkoutGeneratorPlan,
  workoutInput: WorkoutGeneratorInput,
  loadLabel: string,
  recoveryLabel: string,
  nutritionLabel: string,
): CoachIntensityProfile {
  const suggestionGuardrails = basePlan.suggestions.map((suggestion) => ({
    suggestionId: suggestion.id,
    label: suggestion.label,
    maxDuration: suggestion.duration,
    maxRpe: suggestion.rpe,
    maxEstimatedLoad: suggestion.estimatedLoad,
  }))
  const maxDuration = suggestionGuardrails.reduce(
    (highest, suggestion) => Math.max(highest, suggestion.maxDuration),
    Math.min(workoutInput.availableMinutes, 20),
  )
  const maxRpe = suggestionGuardrails.reduce(
    (highest, suggestion) => Math.max(highest, suggestion.maxRpe),
    1,
  )
  const maxEstimatedLoad = suggestionGuardrails.reduce(
    (highest, suggestion) => Math.max(highest, suggestion.maxEstimatedLoad),
    0,
  )
  const guidance = [
    `Do not exceed the ${basePlan.readiness.label.toLowerCase()} cap (${basePlan.readiness.cap}).`,
    ...basePlan.readiness.reasons.map((reason) => `Intensity reason: ${reason}.`),
    `Keep the session inside ${workoutInput.availableMinutes} available minutes.`,
    `Target the current load picture: ${loadLabel.toLowerCase()}, ${recoveryLabel.toLowerCase()}, ${nutritionLabel.toLowerCase()}.`,
  ]

  return {
    readinessScore: basePlan.readiness.score,
    readinessLabel: basePlan.readiness.label,
    readinessCap: basePlan.readiness.cap,
    targetDuration: basePlan.suggestions[0]?.duration ?? workoutInput.availableMinutes,
    maxDuration,
    maxRpe,
    maxEstimatedLoad,
    loadLabel,
    recoveryLabel,
    nutritionLabel,
    weeklySessionCount: workoutInput.weeklySessionCount,
    guidance,
    suggestionGuardrails,
  }
}

function describeTrainingAge(trainingAge: AthleteTrainingAge) {
  switch (trainingAge) {
    case 'beginner':
      return 'newer to structured training'
    case 'advanced':
      return 'used to structured training'
    default:
      return 'comfortable with consistent training'
  }
}

function describePrimaryGoal(primaryGoal: AthletePrimaryGoal) {
  switch (primaryGoal) {
    case 'fat-loss':
      return 'fat loss'
    case 'muscle-gain':
      return 'muscle gain'
    case 'endurance':
      return 'endurance development'
    case 'strength':
      return 'strength development'
    case 'return-to-training':
      return 'a steady return to training'
    default:
      return 'general fitness'
  }
}

function buildAthleteSummary(profile: AthleteProfile) {
  const lines = [
    profile.name.trim()
      ? `${profile.name.trim()} is ${describeTrainingAge(profile.trainingAge)}.`
      : `The athlete is ${describeTrainingAge(profile.trainingAge)}.`,
    `Primary goal is ${describePrimaryGoal(profile.primaryGoal)} with about ${profile.weeklyAvailability} sessions available each week.`,
  ]

  if (profile.sessionPreference.trim()) {
    lines.push(`Session preference: ${profile.sessionPreference.trim()}.`)
  }

  if (profile.preferences.trim()) {
    lines.push(`Exercise preferences: ${profile.preferences.trim()}.`)
  }

  if (profile.limitations.trim()) {
    lines.push(`Limitations or injuries: ${profile.limitations.trim()}.`)
  }

  if (profile.notes.trim()) {
    lines.push(`Extra coaching notes: ${profile.notes.trim()}.`)
  }

  return lines.join(' ')
}

export function hydrateAthleteProfile(value: unknown): AthleteProfile {
  if (!isRecord(value)) {
    return DEFAULT_ATHLETE_PROFILE
  }

  return {
    name: readString(value.name, DEFAULT_ATHLETE_PROFILE.name),
    trainingAge: isAthleteTrainingAge(value.trainingAge)
      ? value.trainingAge
      : DEFAULT_ATHLETE_PROFILE.trainingAge,
    primaryGoal: isAthletePrimaryGoal(value.primaryGoal)
      ? value.primaryGoal
      : DEFAULT_ATHLETE_PROFILE.primaryGoal,
    weeklyAvailability: Math.round(
      readFiniteNumber(
        value.weeklyAvailability,
        DEFAULT_ATHLETE_PROFILE.weeklyAvailability,
        1,
        14,
      ),
    ),
    sessionPreference: readString(
      value.sessionPreference,
      DEFAULT_ATHLETE_PROFILE.sessionPreference,
    ),
    limitations: readString(value.limitations, DEFAULT_ATHLETE_PROFILE.limitations),
    preferences: readString(value.preferences, DEFAULT_ATHLETE_PROFILE.preferences),
    notes: readString(value.notes, DEFAULT_ATHLETE_PROFILE.notes),
  }
}

export function hydrateCoachConfig(value: unknown): CoachConfig {
  if (!isRecord(value)) {
    return DEFAULT_COACH_CONFIG
  }

  return {
    assistantName: readString(value.assistantName, DEFAULT_COACH_CONFIG.assistantName),
    endpointUrl: readString(value.endpointUrl, DEFAULT_COACH_CONFIG.endpointUrl),
    requestTimeoutMs: Math.round(
      readFiniteNumber(
        value.requestTimeoutMs,
        DEFAULT_COACH_CONFIG.requestTimeoutMs,
        MIN_TIMEOUT_MS,
        MAX_TIMEOUT_MS,
      ),
    ),
  }
}

export function buildCoachContext({
  athleteProfile,
  workoutInput,
  basePlan,
  currentRatio,
  baselineReady,
  recentSessions,
  latestRecoveryEntry,
  latestNutritionEntry,
  nutritionTargets,
  equipmentSummary,
  requestIntent = 'full-plan',
  variationTarget = null,
}: BuildCoachContextInput): CoachContext {
  const loadBand = getRatioBand(currentRatio, baselineReady)
  const recoveryBand = getRecoveryBand(latestRecoveryEntry?.score ?? null)
  const nutritionBand = getNutritionBand(latestNutritionEntry?.score ?? null)

  return {
    generatedAt: new Date().toISOString(),
    athleteProfile,
    athleteSummary: buildAthleteSummary(athleteProfile),
    workoutInput,
    equipmentSummary,
    request: buildCoachRequestContext(requestIntent, variationTarget),
    intensityProfile: buildCoachIntensityProfile(
      basePlan,
      workoutInput,
      loadBand.label,
      recoveryBand.label,
      nutritionBand.label,
    ),
    metrics: {
      load: {
        value: currentRatio === null ? 'Baseline building' : currentRatio.toFixed(2),
        label: loadBand.label,
        detail: loadBand.detail,
      },
      recovery: {
        value: formatMetricValue(latestRecoveryEntry?.score ?? null),
        label: recoveryBand.label,
        detail: recoveryBand.detail,
      },
      nutrition: {
        value: formatMetricValue(latestNutritionEntry?.score ?? null),
        label: nutritionBand.label,
        detail: nutritionBand.detail,
      },
      weeklySessionCount: workoutInput.weeklySessionCount,
    },
    recentSessions: recentSessions.map((session) => ({
      date: session.date,
      title: session.title,
      duration: session.duration,
      rpe: session.rpe,
      load: session.load,
      notes: session.notes,
    })),
    latestRecovery: latestRecoveryEntry
      ? {
          date: latestRecoveryEntry.date,
          score: latestRecoveryEntry.score,
          sleepHours: latestRecoveryEntry.sleepHours,
          hrv: latestRecoveryEntry.hrv,
          notes: latestRecoveryEntry.notes,
        }
      : null,
    latestNutrition: latestNutritionEntry
      ? {
          date: latestNutritionEntry.date,
          score: latestNutritionEntry.score,
          calories: latestNutritionEntry.calories,
          protein: latestNutritionEntry.protein,
          hydration: latestNutritionEntry.hydration,
          notes: latestNutritionEntry.notes,
        }
      : null,
    nutritionTargets,
    basePlan,
    guidelines: [
      'Stay inside the availableMinutes window and do not exceed the current readiness cap.',
      'Respect the athlete profile, stated limitations, and listed home equipment.',
      'Treat the provided basePlan as the safe floor if the context is ambiguous.',
      requestIntent === 'variation'
        ? 'Return a distinct variation for the targeted suggestion without increasing duration, RPE, or estimated load.'
        : 'Generate distinct workout options rather than paraphrasing the base plan.',
      'Return JSON only, using the response contract documented by the caller.',
    ],
  }
}

function buildCoachInsights(context: CoachContext) {
  const insights = [
    `${context.metrics.load.label}: ${context.metrics.load.detail}`,
    `${context.metrics.recovery.label}: ${context.metrics.recovery.detail}`,
  ]

  if (context.metrics.nutrition.value !== 'Not logged') {
    insights.push(`${context.metrics.nutrition.label}: ${context.metrics.nutrition.detail}`)
  }

  if (context.athleteProfile.limitations.trim()) {
    insights.push(
      `Protect the session around this limitation: ${context.athleteProfile.limitations.trim()}.`,
    )
  } else if (context.athleteProfile.preferences.trim()) {
    insights.push(
      `Lean into preferred training styles where possible: ${context.athleteProfile.preferences.trim()}.`,
    )
  }

  return insights
}

function buildRecoveryRecommendations(context: CoachContext) {
  const latestRecovery = context.latestRecovery

  if (!latestRecovery) {
    return [
      'Log a short morning recovery check-in so future coach recommendations can scale intensity more precisely.',
      'Keep the warm-up honest today and downgrade to the lighter option if you feel flatter than expected.',
    ]
  }

  if (latestRecovery.score < 50) {
    return [
      'Bias today toward easy movement, down-regulation, and earlier sleep rather than chasing extra load.',
      'Use a longer cooldown and keep the next hard session contingent on a better morning check-in.',
    ]
  }

  if (latestRecovery.score < 65) {
    return [
      'Hold 1-2 reps or a full interval in reserve even if the session starts to feel better midstream.',
      'Add simple post-session recovery work: fluids, protein, and 5-10 minutes of easy mobility.',
    ]
  }

  return [
    'Recovery markers support productive work today, but keep the first block conservative until the warm-up confirms it.',
    'Plan a simple recovery anchor afterward so the next session starts from a good place.',
  ]
}

function buildNutritionRecommendations(context: CoachContext) {
  const latestNutrition = context.latestNutrition

  if (!latestNutrition) {
    return [
      `Use the saved targets as the default today: ${context.nutritionTargets.calories} kcal, ${context.nutritionTargets.protein} g protein, and ${context.nutritionTargets.hydration} L fluids.`,
      'Log today after training so the coach can start linking fueling patterns to session quality.',
    ]
  }

  if (latestNutrition.score < 55) {
    return [
      'Prioritize a pre-session carbohydrate source and a recovery meal with protein and fluids afterward.',
      'Use today to tighten the basics rather than stacking extra intensity on inconsistent fueling.',
    ]
  }

  if (latestNutrition.score < 70) {
    return [
      'Keep protein and hydration intentional today so the session feels better supported than the recent average.',
      'If the workout runs longer than an hour, bring fluids and a simple carbohydrate source.',
    ]
  }

  return [
    'Fueling looks steady enough to support the current training prescription.',
    'Stay consistent with hydration and use your next meal to reinforce recovery rather than improvising afterward.',
  ]
}

function buildWeeklyFocus(context: CoachContext) {
  if (context.workoutInput.weeklySessionCount >= context.athleteProfile.weeklyAvailability) {
    return 'The week is already close to the planned session count, so treat today as a quality-control day instead of an opportunity to pile on extra work.'
  }

  if (context.workoutInput.weeklySessionCount <= 2) {
    return 'The week still has room for productive work, so a solid session today can help build consistency without needing to force volume later.'
  }

  return 'Today should fit into the rest of the week cleanly, so keep the plan repeatable and leave enough headroom for the next key session.'
}

function buildFallbackPlan(context: CoachContext) {
  if (context.request.intent !== 'variation' || !context.request.variationTarget) {
    return context.basePlan
  }

  const targetSuggestion = context.basePlan.suggestions.find(
    (suggestion) => suggestion.id === context.request.variationTarget?.suggestionId,
  )

  if (!targetSuggestion) {
    return context.basePlan
  }

  const remixedSuggestion = createWorkoutSuggestionVariation(
    context.workoutInput,
    targetSuggestion,
  )

  return {
    ...context.basePlan,
    detail: `Variation requested for ${targetSuggestion.title}. The exercise list was remixed while keeping the same intensity ceiling.`,
    adjustments: [
      ...context.basePlan.adjustments,
      'Variation guardrail: keep the new option at or below the original duration, RPE, and estimated load.',
    ],
    suggestions: context.basePlan.suggestions.map((suggestion) =>
      suggestion.id === targetSuggestion.id ? remixedSuggestion : suggestion,
    ),
  }
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function isDistinctVariation(
  suggestion: WorkoutSuggestion,
  target: CoachVariationTarget,
) {
  if (normalizeText(suggestion.title) !== normalizeText(target.title)) {
    return true
  }

  const suggestionExercises = suggestion.exercises.map((exercise) =>
    normalizeText(exercise.name),
  )
  const targetExercises = target.exercises.map((exercise) => normalizeText(exercise.name))

  if (suggestionExercises.length !== targetExercises.length) {
    return true
  }

  return suggestionExercises.some((exerciseName, index) => exerciseName !== targetExercises[index])
}

function ensureVariationResult(
  result: CoachPlanResult,
  context: CoachContext,
): CoachPlanResult {
  const target = context.request.variationTarget

  if (context.request.intent !== 'variation' || !target) {
    return result
  }

  const coachSuggestion = result.plan.suggestions.find(
    (suggestion) => suggestion.id === target.suggestionId,
  )

  if (coachSuggestion && isDistinctVariation(coachSuggestion, target)) {
    return result
  }

  const fallbackPlan = buildFallbackPlan(context)
  const fallbackSuggestion = fallbackPlan.suggestions.find(
    (suggestion) => suggestion.id === target.suggestionId,
  )

  if (!fallbackSuggestion) {
    return result
  }

  return {
    ...result,
    plan: {
      ...result.plan,
      detail: fallbackPlan.detail,
      adjustments: Array.from(
        new Set([
          ...result.plan.adjustments,
          'Variation guardrail: the targeted option was locally remixed because the coach result stayed too close to the original session.',
        ]),
      ),
      suggestions: result.plan.suggestions.map((suggestion) =>
        suggestion.id === target.suggestionId ? fallbackSuggestion : suggestion,
      ),
    },
    warnings: [
      ...result.warnings,
      `${result.coachName} returned a variation that was too close to the original ${target.title}, so the app substituted a locally remixed version for that option.`,
    ],
  }
}

export function createFallbackCoachPlan(
  context: CoachContext,
  config: CoachConfig,
): CoachPlanResult {
  const endpointConfigured = Boolean(config.endpointUrl.trim())

  return {
    source: 'fallback',
    coachName: config.assistantName,
    generatedAt: new Date().toISOString(),
    plan: buildFallbackPlan(context),
    insights: [
      ...buildCoachInsights(context),
      ...(context.request.intent === 'variation' && context.request.variationTarget
        ? [
            `Variation request: ${context.request.variationTarget.title} was remixed while keeping the same intensity guardrails.`,
          ]
        : []),
    ],
    recoveryRecommendations: buildRecoveryRecommendations(context),
    nutritionRecommendations: buildNutritionRecommendations(context),
    weeklyFocus: buildWeeklyFocus(context),
    warnings: endpointConfigured
      ? []
      : [
          'No external OpenClaw endpoint is configured yet, so this overlay is using the built-in coaching fallback.',
        ],
  }
}

function mergeReadiness(
  value: unknown,
  fallback: WorkoutReadiness,
): WorkoutReadiness {
  if (!isRecord(value)) {
    return fallback
  }

  return {
    score: Math.min(
      fallback.score,
      Math.round(readFiniteNumber(value.score, fallback.score, 0, 100)),
    ),
    label: readString(value.label, fallback.label),
    detail: readString(value.detail, fallback.detail),
    color: readString(value.color, fallback.color),
    cap: isReadinessCap(value.cap)
      ? clampReadinessCap(value.cap, fallback.cap)
      : fallback.cap,
    reasons: readStringArray(value.reasons, fallback.reasons),
  }
}

function mergeBlocks(
  value: unknown,
  fallback: WorkoutSuggestionBlock[],
): WorkoutSuggestionBlock[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  const blocks = value.flatMap((item, index) => {
    if (typeof item === 'string' && item.trim()) {
      return [
        {
          label: item.trim(),
          detail: fallback[index]?.detail ?? 'Use this block as a focused section of the session.',
        },
      ]
    }

    if (!isRecord(item)) {
      return []
    }

    const fallbackBlock = fallback[index]
    const exerciseList = Array.isArray(item.exercises)
      ? item.exercises
          .filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
          .join(', ')
      : ''

    return [
      {
        label: readString(item.label, fallbackBlock?.label ?? ''),
        detail: readString(
          item.detail,
          exerciseList || fallbackBlock?.detail || '',
        ),
      },
    ].filter((block) => Boolean(block.label && block.detail))
  })

  return blocks.length ? blocks : fallback
}

function mergeExercises(
  value: unknown,
  fallback: WorkoutExerciseSuggestion[],
): WorkoutExerciseSuggestion[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  const exercises = value.flatMap((item, index) => {
    if (!isRecord(item)) {
      return []
    }

    const fallbackExercise = fallback[index]
    const timeboxMinutes =
      typeof item.timeboxMinutes === 'number' && Number.isFinite(item.timeboxMinutes)
        ? item.timeboxMinutes
        : fallbackExercise?.timeboxMinutes
    const sets =
      typeof item.sets === 'number' && Number.isFinite(item.sets) ? item.sets : null
    const reps =
      typeof item.reps === 'string' || typeof item.reps === 'number'
        ? String(item.reps)
        : ''
    const rest =
      typeof item.rest === 'string' || typeof item.rest === 'number'
        ? String(item.rest)
        : ''
    const derivedPrescriptionParts = [
      sets ? `${sets} sets` : '',
      reps ? `${reps} reps` : '',
      rest ? `rest ${rest}` : '',
    ].filter(Boolean)
    const derivedPrescription = derivedPrescriptionParts.join(', ')

    return [
      {
        name: readString(item.name, fallbackExercise?.name ?? ''),
        prescription: readString(
          item.prescription,
          derivedPrescription || fallbackExercise?.prescription || '',
        ),
        detail: readString(
          item.detail,
          readString(item.notes, fallbackExercise?.detail ?? ''),
        ),
        ...(timeboxMinutes ? { timeboxMinutes } : {}),
      },
    ].filter((exercise) =>
      Boolean(exercise.name && exercise.prescription && exercise.detail),
    )
  })

  return exercises.length ? exercises : fallback
}

function mergeSuggestion(
  value: Record<string, unknown>,
  fallback: WorkoutSuggestion,
): WorkoutSuggestion {
  return {
    id: fallback.id,
    label: readString(value.label, fallback.label),
    title: readString(value.title, fallback.title),
    summary: readString(value.summary, fallback.summary),
    duration: Math.min(
      fallback.duration,
      Math.round(readFiniteNumber(value.duration, fallback.duration, 5, 180)),
    ),
    rpe: Math.min(fallback.rpe, readFiniteNumber(value.rpe, fallback.rpe, 1, 10)),
    estimatedLoad: Math.min(
      fallback.estimatedLoad,
      Math.round(
        readFiniteNumber(value.estimatedLoad, fallback.estimatedLoad, 0, 2_000),
      ),
    ),
    rationale: readString(value.rationale, fallback.rationale),
    fueling: readString(value.fueling, fallback.fueling),
    caution: readString(value.caution, fallback.caution),
    blocks: mergeBlocks(value.blocks, fallback.blocks),
    exercises: mergeExercises(value.exercises, fallback.exercises),
  }
}

function mergeSuggestions(
  value: unknown,
  fallback: WorkoutSuggestion[],
): WorkoutSuggestion[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  const fallbackById = new Map(fallback.map((suggestion) => [suggestion.id, suggestion]))
  const mergedSuggestions = new Map<WorkoutSuggestion['id'], WorkoutSuggestion>()

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      return
    }

    const fallbackSuggestion = isSuggestionId(item.id)
      ? fallbackById.get(item.id)
      : fallback[index]

    if (!fallbackSuggestion) {
      return
    }

    mergedSuggestions.set(
      fallbackSuggestion.id,
      mergeSuggestion(item, fallbackSuggestion),
    )
  })

  return fallback.map(
    (suggestion) => mergedSuggestions.get(suggestion.id) ?? suggestion,
  )
}

function mergePlan(
  value: unknown,
  fallback: WorkoutGeneratorPlan,
): WorkoutGeneratorPlan {
  if (!isRecord(value)) {
    return fallback
  }

  return {
    readiness: mergeReadiness(value.readiness, fallback.readiness),
    headline: readString(value.headline, fallback.headline),
    detail: readString(value.detail, fallback.detail),
    adjustments: readStringArray(value.adjustments, fallback.adjustments),
    suggestions: mergeSuggestions(value.suggestions, fallback.suggestions),
  }
}

function normalizeCoachPlanResult(
  payload: unknown,
  fallback: CoachPlanResult,
): CoachPlanResult {
  if (!isRecord(payload)) {
    return {
      ...fallback,
      warnings: [
        'The coach response did not return a JSON object, so the built-in plan is still active.',
        ...fallback.warnings,
      ],
    }
  }

  const planPayload = isRecord(payload.plan) ? payload.plan : payload
  const warnings = readStringArray(payload.warnings)

  return {
    source: 'openclaw',
    coachName: readString(payload.coachName, fallback.coachName),
    generatedAt: readString(payload.generatedAt, new Date().toISOString()),
    plan: mergePlan(planPayload, fallback.plan),
    insights: readStringArray(payload.insights, fallback.insights),
    recoveryRecommendations: readStringArray(
      payload.recoveryRecommendations,
      fallback.recoveryRecommendations,
    ),
    nutritionRecommendations: readStringArray(
      payload.nutritionRecommendations,
      fallback.nutritionRecommendations,
    ),
    weeklyFocus: readJoinedString(payload.weeklyFocus, fallback.weeklyFocus),
    warnings,
  }
}

export async function requestCoachPlan(
  config: CoachConfig,
  context: CoachContext,
  signal?: AbortSignal,
): Promise<CoachPlanResult> {
  const fallback = createFallbackCoachPlan(context, config)
  const endpointUrl = config.endpointUrl.trim()

  if (!endpointUrl) {
    return fallback
  }

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: COACH_REQUEST_VERSION,
        type: 'fitness-tracker-coach-request',
        context,
      }),
      signal,
    })

    if (!response.ok) {
      return {
        ...fallback,
        warnings: [
          `The ${config.assistantName} endpoint returned ${response.status}, so the built-in coaching fallback is active.`,
        ],
      }
    }

    const payload: unknown = await response.json()

    return ensureVariationResult(
      normalizeCoachPlanResult(payload, fallback),
      context,
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    return {
      ...fallback,
      warnings: [
        `The app could not reach ${config.assistantName}, so the built-in coaching fallback is active for now.`,
      ],
    }
  }
}
