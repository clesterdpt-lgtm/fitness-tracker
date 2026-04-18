import { createSessionLoad } from './workload'

export type WorkoutGeneratorGoal =
  | 'endurance'
  | 'speed'
  | 'strength'
  | 'recovery'

export type WorkoutGeneratorMode = 'run' | 'bike' | 'gym' | 'mixed'

type WorkoutIntensityCap = 'low' | 'moderate' | 'high'

export type WorkoutSuggestionBlock = {
  label: string
  detail: string
}

export type WorkoutSuggestion = {
  id: 'recommended' | 'lighter' | 'support'
  label: string
  title: string
  summary: string
  duration: number
  rpe: number
  estimatedLoad: number
  rationale: string
  fueling: string
  caution: string
  blocks: WorkoutSuggestionBlock[]
}

export type WorkoutReadiness = {
  score: number
  label: string
  detail: string
  color: string
  cap: WorkoutIntensityCap
  reasons: string[]
}

export type WorkoutGeneratorPlan = {
  readiness: WorkoutReadiness
  headline: string
  detail: string
  adjustments: string[]
  suggestions: WorkoutSuggestion[]
}

export type WorkoutGeneratorInput = {
  goal: WorkoutGeneratorGoal
  mode: WorkoutGeneratorMode
  availableMinutes: number
  ratio: number | null
  baselineReady: boolean
  recoveryScore: number | null
  nutritionScore: number | null
  weeklySessionCount: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundToNearestFive(value: number) {
  return Math.max(5, Math.round(value / 5) * 5)
}

function normalizeDuration(value: number) {
  return clamp(roundToNearestFive(value), 20, 120)
}

function splitDuration(
  total: number,
  warmupShare = 0.2,
  cooldownShare = 0.15,
) {
  const warmup = roundToNearestFive(total * warmupShare)
  const cooldown = roundToNearestFive(total * cooldownShare)
  const main = Math.max(10, total - warmup - cooldown)

  return { warmup, main, cooldown }
}

function getReadiness(input: WorkoutGeneratorInput): WorkoutReadiness {
  let score = 62
  const reasons: string[] = []

  if (!input.baselineReady || input.ratio === null) {
    score -= 4
    reasons.push('load baseline is still building')
  } else if (input.ratio > 1.5) {
    score -= 20
    reasons.push('current workload is spiking above baseline')
  } else if (input.ratio > 1.3) {
    score -= 11
    reasons.push('current load is climbing above the recent baseline')
  } else if (input.ratio < 0.8) {
    score += 4
    reasons.push('current load is lighter than the recent baseline')
  } else {
    score += 10
    reasons.push('current load is sitting in the target zone')
  }

  if (input.recoveryScore !== null) {
    if (input.recoveryScore >= 80) {
      score += 16
      reasons.push('recovery markers look strong')
    } else if (input.recoveryScore >= 65) {
      score += 8
      reasons.push('recovery markers are stable')
    } else if (input.recoveryScore >= 50) {
      reasons.push('recovery is usable but not fully topped up')
    } else {
      score -= 18
      reasons.push('recovery markers are low')
    }
  }

  if (input.nutritionScore !== null) {
    if (input.nutritionScore >= 85) {
      score += 10
      reasons.push('fueling has been on target')
    } else if (input.nutritionScore >= 70) {
      score += 5
      reasons.push('fueling has been mostly steady')
    } else if (input.nutritionScore < 55) {
      score -= 8
      reasons.push('fueling has been inconsistent')
    }
  }

  if (input.weeklySessionCount >= 6) {
    score -= 4
    reasons.push('the week already carries a decent training count')
  } else if (input.weeklySessionCount <= 2) {
    score += 3
    reasons.push('there is room to add a productive session')
  }

  const normalizedScore = clamp(Math.round(score), 22, 95)

  if (normalizedScore >= 78) {
    return {
      score: normalizedScore,
      label: 'Green light',
      detail: 'Context supports a higher-quality session if the warm-up feels normal.',
      color: '#2f7d69',
      cap: 'high',
      reasons,
    }
  }

  if (normalizedScore >= 58) {
    return {
      score: normalizedScore,
      label: 'Controlled build',
      detail: 'Today looks better for productive work than maximal work.',
      color: '#4f7a86',
      cap: 'moderate',
      reasons,
    }
  }

  return {
    score: normalizedScore,
    label: 'Reset day',
    detail: 'Keep the session restorative and avoid stacking more fatigue.',
    color: '#b56b21',
    cap: 'low',
    reasons,
  }
}

function buildFuelingNote(
  goal: WorkoutGeneratorGoal,
  nutritionScore: number | null,
  duration: number,
) {
  if (nutritionScore !== null && nutritionScore < 55) {
    return 'Fuel before you train today, then follow with protein, carbs, and fluids afterward.'
  }

  if ((goal === 'endurance' || goal === 'speed') && duration >= 60) {
    return 'Bring fluids, and add a carbohydrate source if the main work pushes past the one-hour mark.'
  }

  if (goal === 'strength') {
    return 'Pair the session with protein and fluids within an hour after lifting.'
  }

  return 'Keep hydration simple and make the next meal recovery-friendly.'
}

function buildCautionNote(readiness: WorkoutReadiness) {
  if (readiness.cap === 'high') {
    return 'Keep the hard work controlled. This is a quality day, not a maximal test.'
  }

  if (readiness.cap === 'moderate') {
    return 'If effort drifts early, trim one block rather than forcing the planned duration.'
  }

  return 'If the warm-up feels flat, keep everything easy and finish with mobility instead of chasing load.'
}

function createSuggestion(
  suggestion: Omit<WorkoutSuggestion, 'estimatedLoad'>,
): WorkoutSuggestion {
  return {
    ...suggestion,
    estimatedLoad: createSessionLoad(suggestion.duration, suggestion.rpe) ?? 0,
  }
}

function buildEndurancePrimary(
  input: WorkoutGeneratorInput,
  readiness: WorkoutReadiness,
) {
  const duration = normalizeDuration(input.availableMinutes)
  const { warmup, main, cooldown } = splitDuration(duration)
  const rpe = readiness.cap === 'high' ? 6 : readiness.cap === 'moderate' ? 5 : 4

  switch (input.mode) {
    case 'run':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low' ? 'Easy aerobic reset run' : 'Aerobic builder run',
        summary:
          readiness.cap === 'high'
            ? 'Steady aerobic running with a small touch of speed at the end.'
            : readiness.cap === 'moderate'
              ? 'Controlled aerobic volume that keeps the day productive without overshooting.'
              : 'A low-stress aerobic session to keep rhythm without adding fatigue.',
        duration,
        rpe,
        rationale:
          'Best match for an endurance goal while respecting your current workload and readiness.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min easy jog, then ankle, calf, and hip mobility.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min steady aerobic running. Finish with 4 x 20 sec relaxed strides with full easy jog recoveries.`
                : readiness.cap === 'moderate'
                  ? `${main} min conversational Zone 2 running. Keep breathing relaxed and cadence smooth.`
                  : `${main} min easy run or run-walk. Skip any faster work and keep it fully conversational.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min easy jog or walk, then 5 min gentle mobility.`,
          },
        ],
      })

    case 'bike':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low'
            ? 'Easy aerobic reset ride'
            : 'Aerobic builder ride',
        summary:
          readiness.cap === 'high'
            ? 'Steady endurance riding with a few cadence lifts late in the session.'
            : readiness.cap === 'moderate'
              ? 'Controlled aerobic time in the saddle with no need to press the pace.'
              : 'A simple low-stress ride to keep momentum while protecting recovery.',
        duration,
        rpe,
        rationale:
          'This keeps endurance work moving without creating a sharper load spike today.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min easy spin, gradually lifting cadence.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min steady endurance riding. In the final third, add 5 x 30 sec high-cadence spins with 90 sec easy between.`
                : readiness.cap === 'moderate'
                  ? `${main} min aerobic riding at a pace you could sustain while talking in phrases.`
                  : `${main} min easy spin. Keep torque low and stay patient with the effort.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min easy spinning and light hip flexor mobility.`,
          },
        ],
      })

    case 'gym':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low'
            ? 'Low-stress engine circuit'
            : 'Strength-endurance circuit',
        summary:
          readiness.cap === 'low'
            ? 'A smoother circuit session that keeps you moving without digging a hole.'
            : 'Gym-based endurance support for days when you want aerobic work without repetitive impact.',
        duration,
        rpe,
        rationale:
          'This turns the endurance goal into steady whole-body work that still respects fatigue.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min row, bike, or treadmill plus dynamic prep.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min continuous circuit: squat, hinge, row, split squat, and carry for smooth rounds at moderate effort.`
                : readiness.cap === 'moderate'
                  ? `${main} min controlled circuit with smooth pacing and longer breaths between movements.`
                  : `${main} min light circuit: goblet squat, band row, hinge pattern, and carries at easy effort.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min easy bike or walk, then mobility for hips and thoracic spine.`,
          },
        ],
      })

    case 'mixed':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low'
            ? 'Easy mixed aerobic reset'
            : 'Mixed aerobic builder',
        summary:
          readiness.cap === 'high'
            ? 'Blend cardio and bodyweight work to build the engine without needing a maximal session.'
            : readiness.cap === 'moderate'
              ? 'A balanced mixed session that keeps the work steady and efficient.'
              : 'A light mixed session that restores rhythm more than it chases volume.',
        duration,
        rpe,
        rationale:
          'A mixed session gives you endurance value while spreading stress across different movement patterns.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min brisk walk, easy bike, or jump rope plus mobility.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min alternating easy cardio blocks with bodyweight circuits, keeping transitions tight and effort controlled.`
                : readiness.cap === 'moderate'
                  ? `${main} min relaxed cardio and bodyweight work in even chunks. Stay smooth instead of competitive.`
                  : `${main} min easy cardio with short mobility stops and simple bodyweight movements.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min easy breathing, walking, and lower-body mobility.`,
          },
        ],
      })
  }
}

function buildSpeedPrimary(
  input: WorkoutGeneratorInput,
  readiness: WorkoutReadiness,
) {
  const duration = normalizeDuration(input.availableMinutes)
  const { warmup, main, cooldown } = splitDuration(duration, 0.25, 0.15)
  const rpe = readiness.cap === 'high' ? 7 : readiness.cap === 'moderate' ? 6 : 4.5

  switch (input.mode) {
    case 'run':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low'
            ? 'Run primer instead of speed day'
            : readiness.cap === 'moderate'
              ? 'Controlled cruise interval run'
              : 'Speed session run',
        summary:
          readiness.cap === 'low'
            ? 'Keep the neuromuscular touch, but downgrade true intensity into rhythm work.'
            : readiness.cap === 'moderate'
              ? 'Use controlled threshold-style efforts instead of all-out speed.'
              : 'A true quality running session with enough readiness to handle structured work.',
        duration,
        rpe,
        rationale:
          readiness.cap === 'low'
            ? 'Today does not look good for a full speed session, so the generator protects the week.'
            : 'This gives you quality without guessing at how hard to press the day.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min easy jog, drills, and progressive strides.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min quality set: 5-6 x 2 min strong with 2 min easy jog recoveries. Keep the reps smooth, not all-out.`
                : readiness.cap === 'moderate'
                  ? `${main} min controlled tempo fragments: 4 x 4 min at comfortably hard effort with 2 min easy jog recoveries.`
                  : `${main} min easy running with 6 x 20 sec relaxed strides spread through the back half.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min easy jog and calf, hamstring, and hip mobility.`,
          },
        ],
      })

    case 'bike':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low'
            ? 'Cadence primer ride'
            : readiness.cap === 'moderate'
              ? 'Controlled threshold ride'
              : 'Quality interval ride',
        summary:
          readiness.cap === 'low'
            ? 'A light neuromuscular tune-up instead of a true hard day.'
            : readiness.cap === 'moderate'
              ? 'Use controlled threshold work to build quality without overreaching.'
              : 'Structured high-quality bike work with enough readiness to tolerate it.',
        duration,
        rpe,
        rationale:
          'Bike intervals let you scratch the quality itch while keeping the session tightly structured.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min easy spin with 3 short cadence buildups.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min quality set: 5 x 3 min strong with 3 min easy spinning between reps.`
                : readiness.cap === 'moderate'
                  ? `${main} min steady threshold fragments: 3 x 6 min controlled hard with 3 min easy between.`
                  : `${main} min easy aerobic riding with 6 x 15 sec high-cadence spin-ups.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min light spin and easy lower-body mobility.`,
          },
        ],
      })

    case 'gym':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low'
            ? 'Movement-speed primer'
            : readiness.cap === 'moderate'
              ? 'Controlled power circuit'
              : 'Power and speed gym session',
        summary:
          readiness.cap === 'low'
            ? 'Stay crisp without forcing high outputs.'
            : readiness.cap === 'moderate'
              ? 'Power-focused gym work with plenty of control and rest.'
              : 'A faster, more explosive gym session that still stays submaximal.',
        duration,
        rpe,
        rationale:
          'Power work is easier to meter indoors when readiness is mixed.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min bike or row, then jumps, skips, and dynamic mobility.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min alternating med-ball throws, kettlebell swings, step-ups, and explosive push work with full control.`
                : readiness.cap === 'moderate'
                  ? `${main} min controlled power circuit with lower rep counts and generous recovery.`
                  : `${main} min crisp bodyweight and light power drills with full recovery between sets.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min easy breathing and mobility for hips, ankles, and shoulders.`,
          },
        ],
      })

    case 'mixed':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low'
            ? 'Speed-support primer'
            : readiness.cap === 'moderate'
              ? 'Controlled mixed quality session'
              : 'Mixed quality session',
        summary:
          readiness.cap === 'low'
            ? 'Keep the nervous system awake without making the day costly.'
            : readiness.cap === 'moderate'
              ? 'Blend cardio and fast bodyweight work in controlled pieces.'
              : 'A quality mixed session that keeps variety high and fatigue predictable.',
        duration,
        rpe,
        rationale:
          'Mixed format lets you train quality while spreading the stress.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min dynamic prep plus easy cardio.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min alternating quick cardio efforts with short strength or plyometric blocks.`
                : readiness.cap === 'moderate'
                  ? `${main} min tempo-style cardio mixed with crisp bodyweight power sets.`
                  : `${main} min easy cardio and drills with only brief faster touches.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min walk, breathing reset, and mobility.`,
          },
        ],
      })
  }
}

function buildStrengthPrimary(
  input: WorkoutGeneratorInput,
  readiness: WorkoutReadiness,
) {
  const duration = normalizeDuration(input.availableMinutes)
  const { warmup, main, cooldown } = splitDuration(duration, 0.2, 0.15)
  const rpe = readiness.cap === 'high' ? 7 : readiness.cap === 'moderate' ? 6 : 4.5

  switch (input.mode) {
    case 'run':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low'
            ? 'Hill mechanics primer'
            : readiness.cap === 'moderate'
              ? 'Controlled hill strength run'
              : 'Hill strength session',
        summary:
          readiness.cap === 'low'
            ? 'Use short hills for posture and mechanics, not for a hard workout.'
            : 'A run-based strength session that leans on hills instead of pure speed.',
        duration,
        rpe,
        rationale:
          'Hills build force production and posture while keeping the session specific to running.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min easy jog plus drills and 2 short hill strides.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min session built around 8-10 x 45 sec uphill at strong but smooth effort with walk-back recoveries.`
                : readiness.cap === 'moderate'
                  ? `${main} min session built around 6-8 x 30-45 sec uphill at controlled effort with full walk-back recoveries.`
                  : `${main} min easy running with 4-6 short hill strides focused on posture and rhythm.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min easy jog and lower-leg mobility.`,
          },
        ],
      })

    case 'bike':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low'
            ? 'Torque primer ride'
            : readiness.cap === 'moderate'
              ? 'Controlled strength-endurance ride'
              : 'Strength-endurance bike session',
        summary:
          readiness.cap === 'low'
            ? 'Touch low-cadence work without letting the ride get grindy.'
            : 'Use lower-cadence work to build strength without turning the day into a race.',
        duration,
        rpe,
        rationale:
          'This format gives you bike-specific strength with tightly controlled intensity.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min easy spin with a few short cadence lifts.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min session built around 5 x 4 min low-cadence, seated strength work with 3 min easy spin recoveries.`
                : readiness.cap === 'moderate'
                  ? `${main} min session built around 4 x 4 min controlled torque work with full easy recoveries.`
                  : `${main} min easy spinning with a few short low-cadence segments kept well below strain.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min easy spin and hip mobility.`,
          },
        ],
      })

    case 'gym':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low'
            ? 'Movement-quality lift'
            : readiness.cap === 'moderate'
              ? 'Controlled full-body strength'
              : 'Full-body strength session',
        summary:
          readiness.cap === 'low'
            ? 'Pattern the main lifts and leave plenty in reserve.'
            : readiness.cap === 'moderate'
              ? 'Get a strong lift in while stopping short of grindy reps.'
              : 'A true strength session with enough readiness to handle meaningful work.',
        duration,
        rpe,
        rationale:
          'Strength work stays useful even when it is capped below maximal loading.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min easy cardio, dynamic prep, and ramp-up sets.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min full-body lift: squat or trap-bar pattern, hinge, press, row, and carries for controlled work sets.`
                : readiness.cap === 'moderate'
                  ? `${main} min controlled strength work with 2-4 reps left in reserve on each main lift.`
                  : `${main} min technique-focused full-body session with lighter loads, slower tempos, and clean positions.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min easy breathing and mobility for hips, shoulders, and thoracic spine.`,
          },
        ],
      })

    case 'mixed':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title:
          readiness.cap === 'low'
            ? 'Bodyweight strength reset'
            : readiness.cap === 'moderate'
              ? 'Controlled mixed strength circuit'
              : 'Mixed strength session',
        summary:
          readiness.cap === 'low'
            ? 'Use simple strength patterns without pushing fatigue.'
            : 'Blend resistance and trunk work for a productive strength day.',
        duration,
        rpe,
        rationale:
          'A mixed session makes it easier to keep strength work accessible and scalable.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: buildCautionNote(readiness),
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min dynamic prep plus easy cardio.`,
          },
          {
            label: 'Main set',
            detail:
              readiness.cap === 'high'
                ? `${main} min mixed circuit: split squat, push, pull, hinge, trunk, and carry patterns for steady strong rounds.`
                : readiness.cap === 'moderate'
                  ? `${main} min controlled resistance circuit with form-first pacing.`
                  : `${main} min bodyweight and light-resistance work with extra mobility between rounds.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min walk and full-body mobility.`,
          },
        ],
      })
  }
}

function buildRecoveryPrimary(
  input: WorkoutGeneratorInput,
  readiness: WorkoutReadiness,
) {
  const duration = normalizeDuration(input.availableMinutes)
  const { warmup, main, cooldown } = splitDuration(duration, 0.15, 0.2)
  const rpe = readiness.cap === 'high' ? 4 : 3

  switch (input.mode) {
    case 'run':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title: 'Recovery jog and mobility',
        summary: 'A low-stress run that keeps blood moving and lets the body absorb recent work.',
        duration,
        rpe,
        rationale:
          'Recovery days should feel like energy deposits rather than another performance test.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: 'Walk whenever needed. Recovery pace should feel almost too easy.',
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min brisk walk and lower-leg mobility.`,
          },
          {
            label: 'Main set',
            detail: `${main} min easy jog or run-walk with fully conversational breathing.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min walk and mobility for hips, calves, and feet.`,
          },
        ],
      })

    case 'bike':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title: 'Recovery spin',
        summary: 'An easy spin to flush the legs without stacking more fatigue.',
        duration,
        rpe,
        rationale:
          'Recovery rides should leave you feeling better when you finish than when you started.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: 'Keep torque low and stay seated. The goal is circulation, not fitness gain.',
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min easy spin and gentle breathing reset.`,
          },
          {
            label: 'Main set',
            detail: `${main} min light spinning with relaxed cadence and no hard surges.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min very easy spin and hip mobility.`,
          },
        ],
      })

    case 'gym':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title: 'Recovery mobility circuit',
        summary: 'A gym-based reset built around mobility, easy carries, and tissue-friendly movement.',
        duration,
        rpe,
        rationale:
          'This keeps you in the routine without creating meaningful new fatigue.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: 'Treat every rep as restoration work. Stop well before anything feels demanding.',
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min easy cardio and joint prep.`,
          },
          {
            label: 'Main set',
            detail: `${main} min alternating mobility flows, light carries, core stability, and easy sled or bike work.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min down-regulation breathing and gentle stretching.`,
          },
        ],
      })

    case 'mixed':
      return createSuggestion({
        id: 'recommended',
        label: 'Recommended',
        title: 'Recovery flow session',
        summary: 'Light cardio, mobility, and trunk work to help you bounce back.',
        duration,
        rpe,
        rationale:
          'A mixed recovery session is often easier to stick with because it never feels repetitive.',
        fueling: buildFuelingNote(input.goal, input.nutritionScore, duration),
        caution: 'Nothing in this session should feel like a workout benchmark.',
        blocks: [
          {
            label: 'Warm-up',
            detail: `${warmup} min walk, easy bike, or jump rope at a very light effort.`,
          },
          {
            label: 'Main set',
            detail: `${main} min mobility flow with easy cardio and trunk stability blended throughout.`,
          },
          {
            label: 'Cool-down',
            detail: `${cooldown} min breathing reset and full-body mobility.`,
          },
        ],
      })
  }
}

function buildReducedLoadSuggestion(
  input: WorkoutGeneratorInput,
  readiness: WorkoutReadiness,
) {
  const duration = normalizeDuration(input.availableMinutes * 0.75)
  const { warmup, main, cooldown } = splitDuration(duration, 0.2, 0.2)

  return createSuggestion({
    id: 'lighter',
    label: 'Lower-load swap',
    title:
      input.mode === 'gym'
        ? 'Mobility-led gym reset'
        : input.mode === 'bike'
          ? 'Easy spin swap'
          : input.mode === 'run'
            ? 'Easy aerobic swap'
            : 'Low-stress mixed swap',
    summary:
      'Use this if the warm-up feels worse than expected or if the day needs to stay lighter than planned.',
    duration,
    rpe: readiness.cap === 'high' ? 4 : 3,
    rationale:
      'A ready-made fallback keeps you from forcing the original session when the body says no.',
    fueling: buildFuelingNote('recovery', input.nutritionScore, duration),
    caution: 'This option should leave you feeling fresher, not merely less tired.',
    blocks: [
      {
        label: 'Warm-up',
        detail: `${warmup} min easy movement and mobility.`,
      },
      {
        label: 'Main set',
        detail:
          input.mode === 'gym'
            ? `${main} min light circuit: mobility, trunk stability, carries, and easy cyclical work.`
            : `${main} min easy conversational work with no structured hard segments.`,
      },
      {
        label: 'Cool-down',
        detail: `${cooldown} min easy downshift and longer mobility.`,
      },
    ],
  })
}

function buildSupportSuggestion(input: WorkoutGeneratorInput) {
  const duration = normalizeDuration(input.availableMinutes * 0.6)

  if (input.goal === 'strength') {
    return createSuggestion({
      id: 'support',
      label: 'Support session',
      title: 'Easy aerobic support',
      summary: 'A short aerobic session to support recovery, work capacity, and consistency around strength training.',
      duration,
      rpe: 4,
      rationale:
        'Strength work benefits from easy aerobic support when the main lift is not the best option today.',
      fueling: buildFuelingNote('endurance', input.nutritionScore, duration),
      caution: 'Keep the effort easy enough that it helps recovery instead of competing with it.',
      blocks: [
        {
          label: 'Start',
          detail: '5-10 min easy warm-up on a modality you enjoy.',
        },
        {
          label: 'Main work',
          detail: `${Math.max(15, duration - 10)} min easy aerobic work at a pace that feels repeatable any day of the week.`,
        },
        {
          label: 'Finish',
          detail: 'Mobility for hips, ankles, and thoracic spine.',
        },
      ],
    })
  }

  return createSuggestion({
    id: 'support',
    label: 'Support session',
    title: 'Strength and trunk support',
    summary: 'A short strength-support block to complement the main endurance or speed goal.',
    duration,
    rpe: 5,
    rationale:
      'A support lift gives you a productive alternative when you want useful work without another big cardio day.',
    fueling: buildFuelingNote('strength', input.nutritionScore, duration),
    caution: 'Keep form clean and stop each set with reps still in reserve.',
    blocks: [
      {
        label: 'Prep',
        detail: 'Dynamic warm-up, glute activation, and trunk prep.',
      },
      {
        label: 'Main work',
        detail: `${Math.max(20, duration - 10)} min of split squat, hinge, row, push, and anti-rotation trunk work for controlled sets.`,
      },
      {
        label: 'Finish',
        detail: 'Carries or easy cyclical cooldown plus mobility.',
      },
    ],
  })
}

function buildPrimarySuggestion(
  input: WorkoutGeneratorInput,
  readiness: WorkoutReadiness,
) {
  switch (input.goal) {
    case 'endurance':
      return buildEndurancePrimary(input, readiness)
    case 'speed':
      return buildSpeedPrimary(input, readiness)
    case 'strength':
      return buildStrengthPrimary(input, readiness)
    case 'recovery':
      return buildRecoveryPrimary(input, readiness)
  }
}

function buildHeadline(goal: WorkoutGeneratorGoal, readiness: WorkoutReadiness) {
  if (goal === 'recovery') {
    return 'Make today a recovery deposit rather than another stressor.'
  }

  if (readiness.cap === 'high') {
    return `You have enough readiness to train ${goal} with intent today.`
  }

  if (readiness.cap === 'moderate') {
    return `Keep the ${goal} work productive, but controlled.`
  }

  return `Protect the week and keep ${goal} work lighter than planned today.`
}

function buildDetail(readiness: WorkoutReadiness) {
  const topReasons = readiness.reasons.slice(0, 3)

  if (!topReasons.length) {
    return readiness.detail
  }

  return `${readiness.detail} Right now, ${topReasons.join(', ')}.`
}

function buildAdjustments(
  input: WorkoutGeneratorInput,
  readiness: WorkoutReadiness,
) {
  const adjustments = [
    readiness.cap === 'high'
      ? 'Keep the hard work technically clean and stop before the session turns into a race effort.'
      : readiness.cap === 'moderate'
        ? 'Favor controlled work and leave a little room in reserve instead of chasing the top end.'
        : 'Cap the day at easy effort and let consistency beat intensity.',
  ]

  if (!input.baselineReady || input.ratio === null) {
    adjustments.push(
      'Because the ACWR baseline is still building, the generator favors simple, repeatable sessions over aggressive progressions.',
    )
  } else if (input.ratio > 1.3) {
    adjustments.push(
      'Current load is above the recent baseline, so total work is kept tighter than a typical build day.',
    )
  } else {
    adjustments.push(
      'Current load is close enough to baseline to tolerate a normal training dose if the warm-up feels right.',
    )
  }

  if (input.recoveryScore !== null && input.recoveryScore < 65) {
    adjustments.push(
      'Recovery is not fully topped up, so stay willing to swap to the lower-load option at the first sign of flatness.',
    )
  } else if (input.nutritionScore !== null && input.nutritionScore < 70) {
    adjustments.push(
      'Fueling is a little behind target, so avoid turning this into a deep glycogen-cost session.',
    )
  } else {
    adjustments.push(
      'If you finish feeling like you could do a little more, that is a sign the session landed where it should.',
    )
  }

  return adjustments
}

export function buildWorkoutGeneratorPlan(
  input: WorkoutGeneratorInput,
): WorkoutGeneratorPlan {
  const normalizedInput = {
    ...input,
    availableMinutes: normalizeDuration(input.availableMinutes),
  }
  const readiness = getReadiness(normalizedInput)

  return {
    readiness,
    headline: buildHeadline(normalizedInput.goal, readiness),
    detail: buildDetail(readiness),
    adjustments: buildAdjustments(normalizedInput, readiness),
    suggestions: [
      buildPrimarySuggestion(normalizedInput, readiness),
      buildReducedLoadSuggestion(normalizedInput, readiness),
      buildSupportSuggestion(normalizedInput),
    ],
  }
}
