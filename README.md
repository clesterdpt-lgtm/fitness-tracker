# Fitness Tracker

A Vite + React training dashboard for workload, recovery, nutrition, and workout generation.

## Local development

```bash
npm install
npm run dev
```

## Coach integration

The app now supports an API-backed coaching layer on top of the built-in workout generator.

- The existing rules-based generator still calculates readiness and provides the safe fallback plan.
- The coach can generate a full workout plan or a variation for a selected session option.
- Athlete profile and coach connection settings are stored in browser `localStorage`.
- If no external endpoint is configured, the app uses a built-in coaching fallback so the feature still works on GitHub Pages.

## Local proxy

You can run a local coach endpoint immediately:

```bash
npm run coach-proxy
```

Then set the app's endpoint URL in Settings to:

```text
http://localhost:8787/coach
```

What the local proxy does:

- `mock` mode is the default and returns a coach response built from the app's local generator context.
- `minimax` mode translates the app request into a MiniMax chat completion call and normalizes the response back into the app's coach contract.
- `openai` mode translates the app request into an OpenAI `POST /v1/responses` call and normalizes the response back into the app's coach contract.
- `upstream` mode forwards the request to any custom HTTP service you want to use instead.

The health endpoint shows which mode is active:

```text
http://localhost:8787/health
```

### OpenAI API mode

If you want to use the OpenAI Responses API through the local proxy, run it like this:

```bash
OPENAI_API_KEY="replace-with-your-api-key" \
npm run coach-proxy:openai
```

OpenAI mode notes:

- `OPENAI_API_KEY` is required for real API calls.
- `OPENAI_MODEL` defaults to `gpt-5.4-mini`.
- `OPENAI_RESPONSES_URL` defaults to `https://api.openai.com/v1/responses`.
- `OPENAI_MAX_OUTPUT_TOKENS` lets you cap the response budget if needed.
- `OPENAI_REASONING_EFFORT` is optional. Supported values depend on the model you choose.
- `OPENAI_ORGANIZATION` and `OPENAI_PROJECT` are optional if you need to target a specific org or project.
- The proxy requests JSON output and then validates the result against the app's expected coach contract.

The Settings screen includes a `Use local preset` action that fills `http://localhost:8787/coach` and a longer timeout for you.

If you use the `ftcoach` launcher or the background LaunchAgent, store your key in:

```text
~/.config/fitness-tracker-coach.env
```

Example:

```bash
mkdir -p ~/.config
cp ./fitness-tracker-coach.env.example ~/.config/fitness-tracker-coach.env
```

### MiniMax API mode

MiniMax exposes an official OpenAI-compatible API on `https://api.minimax.io/v1`, so the local proxy can use it directly.

```bash
COACH_PROXY_MODE=minimax \
MINIMAX_API_KEY="replace-with-your-api-key" \
npm run coach-proxy:minimax
```

MiniMax mode notes:

- `MINIMAX_API_KEY` is required for real MiniMax API calls.
- `MINIMAX_BASE_URL` defaults to `https://api.minimax.io/v1`.
- `MINIMAX_MODEL` defaults to `MiniMax-M2.7`.
- `MINIMAX_MAX_TOKENS` caps the completion token budget.
- `MINIMAX_TEMPERATURE` defaults to `0.2`. MiniMax documents the valid range as `(0.0, 1.0]`.
- `MINIMAX_REASONING_SPLIT` defaults to `true`, which helps keep reasoning content separate from the final text output.
- If both OpenAI and MiniMax keys are present, set `COACH_PROXY_MODE` explicitly so the proxy uses the provider you want.

### Custom upstream mode

If you want to keep using your own backend shape, the proxy still supports a generic passthrough mode:

```bash
COACH_PROXY_MODE=upstream \
COACH_UPSTREAM_URL="https://your-api-coach-service.example.com/coach" \
COACH_UPSTREAM_AUTH_TOKEN="Bearer replace-me" \
npm run coach-proxy
```

The one place to customize that upstream payload shape is `buildUpstreamPayload()` in [scripts/coach-proxy.mjs](/Users/chrislester/Documents/Fitness-tracker/scripts/coach-proxy.mjs).

If you do not set `COACH_PROXY_MODE`, the proxy automatically picks `minimax` when `MINIMAX_API_KEY` is present, `openai` when `OPENAI_API_KEY` is present, `upstream` when `COACH_UPSTREAM_URL` is present, and otherwise falls back to `mock`.

## Important hosting note

This project is deployed as a static site on GitHub Pages. That means the browser calls any configured coach endpoint directly.

- Do not put private API secrets in this repo or in the browser app.
- If your API-backed coach needs secrets, expose it through your own backend or proxy and point the app at that URL.
- Your endpoint must allow cross-origin requests from the site where this app is hosted.

The included local proxy is a good starting point if you want to host a thin adapter somewhere other than GitHub Pages.

## Request contract

When you click `Generate workout with ...` or ask for a coach variation in the workout generator, the app sends:

```json
{
  "version": 1,
  "type": "fitness-tracker-coach-request",
  "context": {
    "generatedAt": "2026-04-18T20:30:00.000Z",
    "athleteProfile": {},
    "athleteSummary": "...",
    "workoutInput": {},
    "equipmentSummary": "Dumbbells, bench, yoga mat",
    "request": {
      "intent": "full-plan",
      "objective": "Generate a coach-authored workout plan...",
      "variationTarget": null
    },
    "intensityProfile": {
      "readinessCap": "moderate",
      "maxDuration": 45,
      "maxRpe": 7,
      "maxEstimatedLoad": 315,
      "suggestionGuardrails": []
    },
    "metrics": {
      "load": {},
      "recovery": {},
      "nutrition": {},
      "weeklySessionCount": 4
    },
    "recentSessions": [],
    "latestRecovery": null,
    "latestNutrition": null,
    "nutritionTargets": {},
    "basePlan": {},
    "guidelines": []
  }
}
```

Notes:

- `request.intent` is `full-plan` for a fresh coach-built workout and `variation` when the user asks the coach to rewrite one specific option.
- `request.variationTarget` contains the suggestion being varied when `intent` is `variation`.
- `intensityProfile` and `basePlan` are hard guardrails. The app clamps duration, RPE, estimated load, and readiness so the coach cannot exceed the safe local prescription.

## Response contract

Your API coach endpoint should return JSON. The easiest shape is:

```json
{
  "coachName": "AI Coach",
  "generatedAt": "2026-04-18T20:31:00.000Z",
  "plan": {
    "readiness": {
      "score": 74,
      "label": "Controlled build",
      "detail": "Today looks better for productive work than maximal work.",
      "color": "#4f7a86",
      "cap": "moderate",
      "reasons": ["current load is sitting in the target zone"]
    },
    "headline": "Use a controlled quality session today.",
    "detail": "Keep the work productive, not maximal.",
    "adjustments": ["Keep one block in reserve if the warm-up feels off."],
    "suggestions": [
      {
        "id": "recommended",
        "label": "Coach pick",
        "title": "Tempo run + lower-leg support",
        "summary": "A moderate quality run that fits today's readiness.",
        "duration": 45,
        "rpe": 6,
        "estimatedLoad": 270,
        "rationale": "Matches the current readiness picture.",
        "fueling": "Use fluids and a simple carbohydrate source beforehand.",
        "caution": "Do not turn the tempo block into a race effort.",
        "blocks": [{ "label": "Warm-up", "detail": "10 min easy + drills" }],
        "exercises": [
          {
            "name": "Tempo run",
            "prescription": "3 x 6 min controlled / 2 min easy",
            "detail": "Stay smooth and repeatable."
          }
        ]
      },
      {
        "id": "lighter",
        "label": "Lighter option",
        "title": "Easy aerobic run",
        "summary": "Use this if the warm-up feels flat.",
        "duration": 35,
        "rpe": 4,
        "estimatedLoad": 140,
        "rationale": "Keeps the day useful without adding too much fatigue.",
        "fueling": "Hydrate and eat normally afterward.",
        "caution": "Stay conversational throughout.",
        "blocks": [],
        "exercises": []
      },
      {
        "id": "support",
        "label": "Support option",
        "title": "Strength support circuit",
        "summary": "Compliment the run goal with low-complexity strength work.",
        "duration": 30,
        "rpe": 5,
        "estimatedLoad": 150,
        "rationale": "Builds support capacity without overshooting the day.",
        "fueling": "Pair with protein and fluids after the session.",
        "caution": "Leave a few reps in reserve on each movement.",
        "blocks": [],
        "exercises": []
      }
    ]
  },
  "insights": [
    "Recovery looks stable enough for productive work.",
    "Fueling should be tightened up before the session."
  ],
  "recoveryRecommendations": [
    "Add a longer cooldown and prioritize sleep tonight."
  ],
  "nutritionRecommendations": [
    "Use a pre-session carb source and hydrate early."
  ],
  "weeklyFocus": "Keep today's session repeatable so the next quality day still lands well.",
  "warnings": []
}
```

You can also return only the targeted suggestion during a variation request as long as the JSON still includes `plan.suggestions`; the app will merge it with the current plan and keep the untouched fallback suggestions.

The app validates this response and falls back to the local generator if fields are missing or malformed.
