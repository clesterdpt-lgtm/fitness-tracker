# Fitness Tracker

A Vite + React training dashboard for workload, recovery, nutrition, and workout generation.

## Local development

```bash
npm install
npm run dev
```

## Coach integration

The app now supports an OpenClaw-style coaching overlay on top of the built-in workout generator.

- The existing rules-based generator still calculates readiness and provides the safe fallback plan.
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
- `gateway` mode translates the app request into an OpenClaw `POST /v1/responses` call and normalizes the response back into the app's coach contract.
- `upstream` mode forwards the request to any custom HTTP service you want to use instead.

The health endpoint shows which mode is active:

```text
http://localhost:8787/health
```

### OpenClaw Gateway mode

If you want to talk directly to a local OpenClaw Gateway, run the proxy like this:

```bash
OPENCLAW_MODE=gateway \
OPENCLAW_GATEWAY_URL="http://127.0.0.1:18789/v1/responses" \
OPENCLAW_GATEWAY_TOKEN="replace-with-your-gateway-token" \
OPENCLAW_GATEWAY_AGENT_ID="main" \
npm run coach-proxy
```

Gateway notes:

- `OPENCLAW_GATEWAY_URL` defaults to `http://127.0.0.1:18789/v1/responses` if you omit it.
- `OPENCLAW_GATEWAY_TOKEN` is only needed when your gateway uses bearer auth.
- `OPENCLAW_GATEWAY_AGENT_ID` is optional. If you omit it, the proxy targets `openclaw/default`.
- `OPENCLAW_GATEWAY_BACKEND_MODEL` is optional if you want to override the agent's backend model with the `x-openclaw-model` header.
- `OPENCLAW_GATEWAY_MAX_OUTPUT_TOKENS` lets you cap the response budget if needed.
- The proxy sends a strict JSON-only coaching prompt and extracts the coach payload from the OpenResponses output.

Your OpenClaw Gateway must have the Responses endpoint enabled before this works.

### Docker OpenClaw mode

If your OpenClaw gateway is already running in Docker, the easiest path is:

```bash
npm run coach-proxy:docker
```

That launcher:

- inspects the `openclaw-gateway` container by default
- reads the published gateway port and gateway token from the container config
- verifies that the container's `/v1/models` API is reachable
- starts the existing local coach proxy against the containerized gateway

Then point the app to:

```text
http://localhost:8787/coach
```

The Settings screen also includes a `Use Docker preset` action that fills this endpoint and a longer timeout for you.

Optional overrides:

- `OPENCLAW_DOCKER_CONTAINER` if your container is not named `openclaw-gateway`
- `OPENCLAW_DOCKER_GATEWAY_HOST` if you do not want to use `127.0.0.1`
- `OPENCLAW_DOCKER_GATEWAY_PORT` if you want to bypass Docker port inspection
- `PORT` if you want the local coach proxy to listen somewhere other than `8787`

The Docker gateway still needs the Responses endpoint enabled in its OpenClaw config. In this setup that usually means:

```json
{
  "gateway": {
    "http": {
      "endpoints": {
        "responses": {
          "enabled": true
        }
      }
    }
  }
}
```

### Custom upstream mode

If you want to keep using your own backend shape, the proxy still supports a generic passthrough mode:

```bash
OPENCLAW_MODE=upstream \
OPENCLAW_UPSTREAM_URL="https://your-openclaw-service.example.com/coach" \
OPENCLAW_UPSTREAM_AUTH_TOKEN="Bearer replace-me" \
npm run coach-proxy
```

The one place to customize that upstream payload shape is `buildUpstreamPayload()` in [scripts/openclaw-proxy.mjs](/Users/chrislester/Documents/Fitness-tracker/scripts/openclaw-proxy.mjs:229).

If you do not set `OPENCLAW_MODE`, the proxy automatically picks `gateway` when gateway-specific env vars are present, `upstream` when `OPENCLAW_UPSTREAM_URL` is present, and otherwise falls back to `mock`.

## Important hosting note

This project is deployed as a static site on GitHub Pages. That means the browser calls any configured coach endpoint directly.

- Do not put private API secrets in this repo or in the browser app.
- If your OpenClaw agent needs secrets, expose it through your own backend or proxy and point the app at that URL.
- Your endpoint must allow cross-origin requests from the site where this app is hosted.

The included local proxy is a good starting point if you want to host a thin adapter somewhere other than GitHub Pages.

## Request contract

When you click `Generate with ...` in the workout generator, the app sends:

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

## Response contract

Your OpenClaw endpoint should return JSON. The easiest shape is:

```json
{
  "coachName": "OpenClaw Coach",
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

The app validates this response and falls back to the local generator if fields are missing or malformed.
