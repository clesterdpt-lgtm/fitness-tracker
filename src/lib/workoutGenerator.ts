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

export type WorkoutExerciseSuggestion = {
  name: string
  prescription: string
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
  exercises: WorkoutExerciseSuggestion[]
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

function createExercise(
  name: string,
  prescription: string,
  detail: string,
): WorkoutExerciseSuggestion {
  return { name, prescription, detail }
}

function getExerciseMainMinutes(duration: number) {
  return Math.max(10, duration - 15)
}

function buildRunExercises(
  goal: WorkoutGeneratorGoal,
  suggestionId: WorkoutSuggestion['id'],
  duration: number,
  readiness: WorkoutReadiness | null,
) {
  const mainMinutes = getExerciseMainMinutes(duration)

  if (suggestionId === 'lighter') {
    return [
      createExercise(
        'Brisk walk warm-up',
        '5-8 min',
        'Walk until breathing settles and cadence feels natural.',
      ),
      createExercise(
        'Ankle rocks + calf raises',
        '2 rounds',
        'Prep the lower legs before any running starts.',
      ),
      createExercise(
        'Easy run-walk',
        `${mainMinutes} min`,
        'Stay fully conversational and insert walk breaks any time the stride gets heavy.',
      ),
      createExercise(
        'Side plank',
        '2 x 20 sec each side',
        'Finish with a small trunk touch instead of more running load.',
      ),
    ]
  }

  if (suggestionId === 'support') {
    if (goal === 'strength') {
      return [
        createExercise(
          'Easy jog or incline walk',
          `${Math.max(15, duration - 10)} min`,
          'Keep the effort easy enough that it helps recovery from lifting.',
        ),
        createExercise(
          'Strides',
          '4 x 15 sec relaxed',
          'Optional rhythm touch only if the legs feel fresh.',
        ),
        createExercise(
          'Hip airplanes',
          '2 x 4 each side',
          'Use control rather than speed to restore hip position.',
        ),
        createExercise(
          '90/90 breathing',
          '2 x 5 breaths',
          'Finish with a downshift instead of extra load.',
        ),
      ]
    }

    return [
      createExercise(
        'Rear-foot-elevated split squat',
        '3 x 6 each leg',
        'Build unilateral strength that supports running posture and stiffness.',
      ),
      createExercise(
        'Single-leg calf raise',
        '3 x 10 each side',
        'Build lower-leg capacity for foot strike and hill work.',
      ),
      createExercise(
        'Single-leg Romanian deadlift',
        '3 x 8 each side',
        'Own the hinge pattern without needing heavy load.',
      ),
      createExercise(
        'Dead bug',
        '2 x 8 each side',
        'Keep the trunk quiet so the stride can stay efficient.',
      ),
    ]
  }

  switch (goal) {
    case 'endurance':
      return [
        createExercise(
          'A-skip march',
          '2 x 20 m',
          'Prime rhythm and posture before the aerobic work starts.',
        ),
        createExercise(
          'Steady aerobic run',
          `${mainMinutes} min`,
          readiness?.cap === 'low'
            ? 'Keep it fully conversational and switch to run-walk if the legs feel flat.'
            : 'Sit in a smooth aerobic groove that you could repeat tomorrow.',
        ),
        createExercise(
          'Strides',
          readiness?.cap === 'high' ? '4 x 20 sec' : '2-4 x 15 sec',
          'Only use them if they make the run feel better, not harder.',
        ),
        createExercise(
          'Walking calf stretch',
          '2 x 30 sec each side',
          'Bring the lower legs back down before finishing.',
        ),
      ]
    case 'speed':
      return [
        createExercise(
          'Drill series',
          'A-skip, B-skip, high knees x 2 rounds',
          'Use drills to lift posture and cadence before the faster work.',
        ),
        createExercise(
          'Progressive strides',
          '4 x 20 sec',
          'Build smoothly so the first fast rep never feels abrupt.',
        ),
        createExercise(
          'Quality run set',
          readiness?.cap === 'high'
            ? '5-6 x 2 min strong / 2 min easy jog'
            : readiness?.cap === 'moderate'
              ? '4 x 4 min controlled tempo / 2 min easy jog'
              : `${mainMinutes} min easy run with 6 x 20 sec relaxed pickups`,
          'Keep the fast work technically smooth instead of chasing top speed.',
        ),
        createExercise(
          'Single-leg calf raise',
          '2 x 12 each side',
          'A small durability piece after the faster running.',
        ),
      ]
    case 'strength':
      return [
        createExercise(
          'Hill march + skips',
          '2 rounds on a short hill',
          'Use posture and knee drive to prep for uphill work.',
        ),
        createExercise(
          'Hill repeats',
          readiness?.cap === 'high'
            ? '8-10 x 45 sec uphill'
            : readiness?.cap === 'moderate'
              ? '6-8 x 30-45 sec uphill'
              : '4-6 short hill strides',
          'Stay tall and punch the ground, but never turn the hill into a sprint.',
        ),
        createExercise(
          'Walking lunge',
          '2 x 10 each leg',
          'Keep the legs honest after the uphill work.',
        ),
        createExercise(
          'Soleus wall sit',
          '2 x 30 sec',
          'Build ankle stiffness for climbing and force transfer.',
        ),
      ]
    case 'recovery':
      return [
        createExercise(
          'Brisk walk',
          '5-8 min',
          'Let the body ease into the session before you jog.',
        ),
        createExercise(
          'Toe yoga + ankle circles',
          '2 rounds',
          'Wake up the feet and lower legs without adding strain.',
        ),
        createExercise(
          'Easy recovery jog',
          `${mainMinutes} min`,
          'Stay nasal-breathing easy or switch to run-walk whenever needed.',
        ),
        createExercise(
          '90/90 breathing',
          '2 x 5 breaths',
          'Finish by downshifting the nervous system.',
        ),
      ]
  }
}

function buildBikeExercises(
  goal: WorkoutGeneratorGoal,
  suggestionId: WorkoutSuggestion['id'],
  duration: number,
  readiness: WorkoutReadiness | null,
) {
  const mainMinutes = getExerciseMainMinutes(duration)

  if (suggestionId === 'lighter') {
    return [
      createExercise(
        'Easy spin warm-up',
        '8 min',
        'Bring heart rate up gradually and keep torque low.',
      ),
      createExercise(
        'Cadence builds',
        '3 x 30 sec',
        'Use quick but relaxed spin-ups to smooth the pedal stroke.',
      ),
      createExercise(
        'Easy aerobic spin',
        `${mainMinutes} min`,
        'Stay in a gear that keeps the legs feeling loose.',
      ),
      createExercise(
        'Hip flexor stretch',
        '2 x 30 sec each side',
        'Reset the front of the hips after the ride.',
      ),
    ]
  }

  if (suggestionId === 'support') {
    if (goal === 'strength') {
      return [
        createExercise(
          'Easy endurance ride',
          `${Math.max(15, duration - 10)} min`,
          'Support lifting with extra aerobic work that stays clearly easy.',
        ),
        createExercise(
          'High-cadence spin-up',
          '3 x 20 sec',
          'Optional rhythm touch only if the legs feel good.',
        ),
        createExercise(
          'Glute bridge',
          '2 x 12',
          'Restore hip extension after the ride.',
        ),
        createExercise(
          'Tall-kneeling breathing',
          '2 x 5 breaths',
          'Downshift before you leave the session.',
        ),
      ]
    }

    return [
      createExercise(
        'Glute bridge',
        '3 x 10',
        'Support hip extension without creating a heavy leg day.',
      ),
      createExercise(
        'Rear-foot-elevated split squat',
        '3 x 6 each leg',
        'Unilateral strength support for smoother pedaling under load.',
      ),
      createExercise(
        'Hamstring slider curl',
        '2 x 10',
        'Add posterior-chain support without big equipment demands.',
      ),
      createExercise(
        'Pallof press',
        '2 x 10 each side',
        'Build trunk stiffness for better seated control.',
      ),
    ]
  }

  switch (goal) {
    case 'endurance':
      return [
        createExercise(
          'Progressive spin-up',
          '3 x 1 min',
          'Lift cadence each minute while keeping effort easy.',
        ),
        createExercise(
          'Single-leg pedal focus',
          '2 x 30 sec each side',
          'Use a light gear and smooth out dead spots in the stroke.',
        ),
        createExercise(
          'Endurance ride block',
          readiness?.cap === 'high'
            ? `${mainMinutes} min steady ride + 5 x 30 sec cadence lifts`
            : `${mainMinutes} min steady aerobic riding`,
          'Aim for smooth pressure through the whole pedal circle.',
        ),
        createExercise(
          'Half-kneeling hip flexor stretch',
          '2 x 30 sec each side',
          'Open the front of the hips before finishing.',
        ),
      ]
    case 'speed':
      return [
        createExercise(
          'Cadence spin-ups',
          '3 x 20 sec',
          'Prime the nervous system before the harder set begins.',
        ),
        createExercise(
          'Seated accelerations',
          '3 x 30 sec',
          'Build pressure smoothly without spiking tension.',
        ),
        createExercise(
          'Quality interval set',
          readiness?.cap === 'high'
            ? '5 x 3 min strong / 3 min easy'
            : readiness?.cap === 'moderate'
              ? '3 x 6 min controlled hard / 3 min easy'
              : `${mainMinutes} min easy ride with 6 x 15 sec high-cadence spin-ups`,
          'Stay technically clean and resist the urge to sprint early.',
        ),
        createExercise(
          'Dead bug',
          '2 x 8 each side',
          'Restore trunk control after the harder pedaling.',
        ),
      ]
    case 'strength':
      return [
        createExercise(
          'Low-cadence primer',
          '3 x 1 min',
          'Use seated pressure to prep the legs without grinding.',
        ),
        createExercise(
          'Glute bridge',
          '2 x 12',
          'Turn the hips on before the strength-endurance work.',
        ),
        createExercise(
          'Torque intervals',
          readiness?.cap === 'high'
            ? '5 x 4 min low cadence / 3 min easy'
            : readiness?.cap === 'moderate'
              ? '4 x 4 min controlled torque / full easy recovery'
              : `${mainMinutes} min easy ride with short low-cadence touches`,
          'Stay seated and keep every rep muscular, not maximal.',
        ),
        createExercise(
          'Side plank',
          '2 x 20 sec each side',
          'Keep the trunk switched on without extra fatigue.',
        ),
      ]
    case 'recovery':
      return [
        createExercise(
          'Easy spin',
          '8 min',
          'Let cadence and breathing settle before you think about anything else.',
        ),
        createExercise(
          'Open-book rotation',
          '2 x 5 each side',
          'Restore thoracic rotation after being on the bike.',
        ),
        createExercise(
          'Recovery ride',
          `${mainMinutes} min`,
          'Stay seated, keep torque low, and avoid every urge to push the pace.',
        ),
        createExercise(
          'Hip flexor + quad stretch',
          '2 x 30 sec each side',
          'Finish with range of motion, not more work.',
        ),
      ]
  }
}

function buildGymExercises(
  goal: WorkoutGeneratorGoal,
  suggestionId: WorkoutSuggestion['id'],
  duration: number,
  readiness: WorkoutReadiness | null,
) {
  if (suggestionId === 'lighter') {
    return [
      createExercise(
        'Rower or bike warm-up',
        '5-8 min',
        'Bring temperature up without adding fatigue.',
      ),
      createExercise(
        'Dead bug',
        '2 x 8 each side',
        'Get the trunk on before any loaded work.',
      ),
      createExercise(
        'Goblet squat',
        '2 x 8',
        'Stay light and smooth rather than chasing load.',
      ),
      createExercise(
        'Farmer carry',
        '3 x 20 m',
        'Finish with posture and breathing instead of more volume.',
      ),
    ]
  }

  if (suggestionId === 'support') {
    if (goal === 'strength') {
      return [
        createExercise(
          'Bike or row',
          `${Math.max(15, duration - 10)} min easy`,
          'Use easy cyclical work to support recovery from lifting.',
        ),
        createExercise(
          'Incline treadmill walk',
          '5-10 min',
          'Optional aerobic top-up if you want a little more time moving.',
        ),
        createExercise(
          'Thoracic opener',
          '2 x 5 each side',
          'Undo desk posture or lifting stiffness before leaving.',
        ),
        createExercise(
          '90/90 breathing',
          '2 x 5 breaths',
          'Finish by downshifting the session.',
        ),
      ]
    }

    return [
      createExercise(
        'Rear-foot-elevated split squat',
        '3 x 6 each leg',
        'Support single-leg force production for running and riding.',
      ),
      createExercise(
        'Dumbbell Romanian deadlift',
        '3 x 8',
        'Build hinge strength without a full heavy day.',
      ),
      createExercise(
        'Chest-supported row',
        '3 x 10',
        'Give the upper back some work without frying grip or low back.',
      ),
      createExercise(
        'Pallof press',
        '2 x 10 each side',
        'Lock in trunk control to support the main sport work.',
      ),
    ]
  }

  switch (goal) {
    case 'endurance':
      return [
        createExercise(
          'Bike erg warm-up',
          '8 min',
          'Ease into a rhythm before the circuit begins.',
        ),
        createExercise(
          'Goblet squat',
          '3 x 10',
          'Keep reps smooth and leave a little in reserve.',
        ),
        createExercise(
          'Dumbbell Romanian deadlift',
          '3 x 10',
          'Build posterior-chain endurance without grinding.',
        ),
        createExercise(
          'Chest-supported row',
          '3 x 12',
          'Balance out pressing and posture in the circuit.',
        ),
        createExercise(
          'Farmer carry',
          '3 x 30 m',
          'Finish each round with full-body tension and breathing control.',
        ),
      ]
    case 'speed':
      return [
        createExercise(
          'Medicine-ball scoop toss',
          '4 x 4',
          'Use intent and crisp reps rather than max effort.',
        ),
        createExercise(
          'Kettlebell swing',
          '4 x 8',
          'Drive the hinge sharply, then reset every rep.',
        ),
        createExercise(
          'Explosive step-up',
          '3 x 6 each leg',
          'Move fast up and stay controlled down.',
        ),
        createExercise(
          'Incline plyo push-up',
          '3 x 5',
          'Keep it snappy and stop when speed fades.',
        ),
      ]
    case 'strength':
      return [
        createExercise(
          'Trap-bar deadlift or goblet squat',
          readiness?.cap === 'high' ? '4 x 4-6' : '3 x 5-6',
          'Use the main lift as the anchor and keep a couple reps in reserve.',
        ),
        createExercise(
          'Rear-foot-elevated split squat',
          '3 x 6 each leg',
          'Pair unilateral control with the main lift.',
        ),
        createExercise(
          'Dumbbell bench or landmine press',
          '3 x 6-8',
          'Press hard without turning the set into a grind.',
        ),
        createExercise(
          'Chest-supported row',
          '3 x 8',
          'Keep upper-back work strong and stable.',
        ),
        createExercise(
          'Farmer carry',
          '3 x 30 m',
          'Finish with posture and trunk stiffness.',
        ),
      ]
    case 'recovery':
      return [
        createExercise(
          'Easy row or bike',
          '8 min',
          'Move enough to loosen up, not enough to feel trained.',
        ),
        createExercise(
          "World's greatest stretch",
          '2 rounds',
          'Open the hips, hamstrings, and thoracic spine.',
        ),
        createExercise(
          'Sled push or easy bike block',
          '6 x 20 m sled or 10 min easy bike',
          'Choose the option that feels most restorative today.',
        ),
        createExercise(
          'Dead bug',
          '2 x 8 each side',
          'Give the trunk a little support without creating fatigue.',
        ),
      ]
  }
}

function buildMixedExercises(
  goal: WorkoutGeneratorGoal,
  suggestionId: WorkoutSuggestion['id'],
  duration: number,
  readiness: WorkoutReadiness | null,
) {
  const mainMinutes = getExerciseMainMinutes(duration)

  if (suggestionId === 'lighter') {
    return [
      createExercise(
        'Easy cardio opener',
        '5-8 min',
        'Walk, bike, or rope skip at an easy effort.',
      ),
      createExercise(
        'Mobility flow',
        '2 rounds',
        'Move through hips, ankles, thoracic spine, and shoulders.',
      ),
      createExercise(
        'Bodyweight circuit',
        '2-3 easy rounds',
        'Use squat, hinge, row, and trunk patterns with no urgency.',
      ),
      createExercise(
        'Easy flush',
        '8-10 min',
        'Finish with light cyclical work if it helps you feel better.',
      ),
    ]
  }

  if (suggestionId === 'support') {
    if (goal === 'strength') {
      return [
        createExercise(
          'Easy cardio block',
          `${Math.max(15, duration - 10)} min`,
          'Use a pace that feels repeatable even on a tired day.',
        ),
        createExercise(
          'Nasal-breathing walk',
          '5 min',
          'Stay relaxed and let the breath control the pace.',
        ),
        createExercise(
          'Hip mobility flow',
          '2 rounds',
          'Keep the tissues moving after the aerobic work.',
        ),
        createExercise(
          'Breathing reset',
          '2 x 5 breaths',
          'End the session calmer than you started it.',
        ),
      ]
    }

    return [
      createExercise(
        'Walking lunge',
        '3 x 8 each leg',
        'Simple unilateral strength that carries into most sports.',
      ),
      createExercise(
        'Push-up or dumbbell floor press',
        '3 x 8',
        'Keep pressing strength topped up without a full gym day.',
      ),
      createExercise(
        'Band or suspension row',
        '3 x 10',
        'Balance the shoulders and upper back.',
      ),
      createExercise(
        'Suitcase carry',
        '3 x 20 m each side',
        'Make the trunk and posture work a little harder.',
      ),
    ]
  }

  switch (goal) {
    case 'endurance':
      return [
        createExercise(
          'Jump rope or easy bike',
          '5 min',
          'Open the session with light elastic work or easy spin.',
        ),
        createExercise(
          'Step-up',
          '3 x 10 each leg',
          'Build simple aerobic strength through the legs.',
        ),
        createExercise(
          'Kettlebell deadlift',
          '3 x 10',
          'Keep the hinge pattern smooth and sustainable.',
        ),
        createExercise(
          'Row or brisk walk block',
          '3 x 6 min',
          'Use steady chunks of cardio to anchor the main work.',
        ),
        createExercise(
          'Bear crawl',
          '3 x 20 m',
          'Finish with trunk and shoulder integration.',
        ),
      ]
    case 'speed':
      return [
        createExercise(
          'Fast-feet rope skip',
          '4 x 20 sec',
          'Wake up foot speed and rhythm without fatigue.',
        ),
        createExercise(
          'Lateral bounds',
          '3 x 5 each side',
          'Stay crisp and stick each landing.',
        ),
        createExercise(
          'Rower or bike intervals',
          readiness?.cap === 'high'
            ? '6 x 45 sec strong / 75 sec easy'
            : readiness?.cap === 'moderate'
              ? '5 x 60 sec controlled hard / 90 sec easy'
              : `${mainMinutes} min easy cardio with short fast touches`,
          'Use quality reps, not desperate ones.',
        ),
        createExercise(
          'Medicine-ball slam',
          '4 x 6',
          'Drive power down and recover fully.',
        ),
      ]
    case 'strength':
      return [
        createExercise(
          'Rear-foot-elevated split squat',
          '3 x 8 each leg',
          'Lead with single-leg strength before fatigue builds.',
        ),
        createExercise(
          'Push-up or dumbbell floor press',
          '3 x 8',
          'Keep reps smooth and positions honest.',
        ),
        createExercise(
          'Band row or suspension row',
          '3 x 10',
          'Balance the pressing and support posture.',
        ),
        createExercise(
          'Kettlebell Romanian deadlift',
          '3 x 10',
          'Build hinge strength with a moderate fatigue cost.',
        ),
        createExercise(
          'Suitcase carry',
          '3 x 20 m each side',
          'Finish with full-body stiffness and control.',
        ),
      ]
    case 'recovery':
      return [
        createExercise(
          'Easy bike or walk',
          '6 min',
          'Start by simply moving and relaxing the breath.',
        ),
        createExercise(
          'Cat-camel + thoracic rotation',
          '2 rounds',
          'Restore spinal movement before the flow begins.',
        ),
        createExercise(
          'Glute bridge',
          '2 x 10',
          'Switch on the posterior chain without stress.',
        ),
        createExercise(
          'Dead bug',
          '2 x 8 each side',
          'Add a little trunk control to the recovery day.',
        ),
      ]
  }
}

function buildWorkoutExercises(
  input: WorkoutGeneratorInput,
  suggestionId: WorkoutSuggestion['id'],
  duration: number,
  readiness: WorkoutReadiness | null,
) {
  switch (input.mode) {
    case 'run':
      return buildRunExercises(input.goal, suggestionId, duration, readiness)
    case 'bike':
      return buildBikeExercises(input.goal, suggestionId, duration, readiness)
    case 'gym':
      return buildGymExercises(input.goal, suggestionId, duration, readiness)
    case 'mixed':
      return buildMixedExercises(input.goal, suggestionId, duration, readiness)
  }
}

function createSuggestion(
  input: WorkoutGeneratorInput,
  suggestion: Omit<WorkoutSuggestion, 'estimatedLoad' | 'exercises'>,
  readiness: WorkoutReadiness | null = null,
): WorkoutSuggestion {
  return {
    ...suggestion,
    estimatedLoad: createSessionLoad(suggestion.duration, suggestion.rpe) ?? 0,
    exercises: buildWorkoutExercises(
      input,
      suggestion.id,
      suggestion.duration,
      readiness,
    ),
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
      return createSuggestion(input, {
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
      }, readiness)

    case 'bike':
      return createSuggestion(input, {
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
      }, readiness)

    case 'gym':
      return createSuggestion(input, {
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
      }, readiness)

    case 'mixed':
      return createSuggestion(input, {
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
      }, readiness)
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
      return createSuggestion(input, {
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
      }, readiness)

    case 'bike':
      return createSuggestion(input, {
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
      }, readiness)

    case 'gym':
      return createSuggestion(input, {
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
      }, readiness)

    case 'mixed':
      return createSuggestion(input, {
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
      }, readiness)
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
      return createSuggestion(input, {
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
      }, readiness)

    case 'bike':
      return createSuggestion(input, {
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
      }, readiness)

    case 'gym':
      return createSuggestion(input, {
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
      }, readiness)

    case 'mixed':
      return createSuggestion(input, {
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
      }, readiness)
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
      return createSuggestion(input, {
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
      }, readiness)

    case 'bike':
      return createSuggestion(input, {
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
      }, readiness)

    case 'gym':
      return createSuggestion(input, {
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
      }, readiness)

    case 'mixed':
      return createSuggestion(input, {
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
      }, readiness)
  }
}

function buildReducedLoadSuggestion(
  input: WorkoutGeneratorInput,
  readiness: WorkoutReadiness,
) {
  const duration = normalizeDuration(input.availableMinutes * 0.75)
  const { warmup, main, cooldown } = splitDuration(duration, 0.2, 0.2)

  return createSuggestion(input, {
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
  }, readiness)
}

function buildSupportSuggestion(input: WorkoutGeneratorInput) {
  const duration = normalizeDuration(input.availableMinutes * 0.6)

  if (input.goal === 'strength') {
    return createSuggestion(input, {
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

  return createSuggestion(input, {
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
