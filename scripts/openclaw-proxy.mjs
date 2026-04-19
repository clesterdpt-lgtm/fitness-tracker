import http from 'node:http'

const PORT = parseInteger(process.env.PORT, 8787)
const HOST = process.env.HOST?.trim() || '0.0.0.0'
const COACH_PATH = process.env.COACH_PATH?.trim() || '/coach'
const HEALTH_PATH = process.env.HEALTH_PATH?.trim() || '/health'
const ALLOWED_ORIGIN = process.env.COACH_ALLOWED_ORIGIN?.trim() || '*'
const EXPLICIT_MODE = process.env.OPENCLAW_MODE?.trim().toLowerCase() || ''
const UPSTREAM_URL = process.env.OPENCLAW_UPSTREAM_URL?.trim() || ''
const UPSTREAM_AUTH_HEADER =
  process.env.OPENCLAW_UPSTREAM_AUTH_HEADER?.trim() || 'Authorization'
const UPSTREAM_AUTH_TOKEN = process.env.OPENCLAW_UPSTREAM_AUTH_TOKEN?.trim() || ''
const RAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL?.trim() || ''
const GATEWAY_URL = RAW_GATEWAY_URL || 'http://127.0.0.1:18789/v1/responses'
const GATEWAY_AUTH_HEADER =
  process.env.OPENCLAW_GATEWAY_AUTH_HEADER?.trim() || 'Authorization'
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || ''
const GATEWAY_AGENT_ID = process.env.OPENCLAW_GATEWAY_AGENT_ID?.trim() || ''
const GATEWAY_BACKEND_MODEL =
  process.env.OPENCLAW_GATEWAY_BACKEND_MODEL?.trim() ||
  process.env.OPENCLAW_BACKEND_MODEL?.trim() ||
  ''
const GATEWAY_MAX_OUTPUT_TOKENS = parseInteger(
  process.env.OPENCLAW_GATEWAY_MAX_OUTPUT_TOKENS,
  1800,
)
const COACH_NAME = process.env.COACH_NAME?.trim() || 'OpenClaw Proxy Coach'
const MODE = resolveMode()

function parseInteger(value, fallback) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) ? parsed : fallback
}

function resolveMode() {
  const normalizedExplicitMode = normalizeMode(EXPLICIT_MODE)

  if (normalizedExplicitMode) {
    return normalizedExplicitMode
  }

  if (EXPLICIT_MODE) {
    console.warn(
      `Ignoring unsupported OPENCLAW_MODE="${EXPLICIT_MODE}". Falling back to automatic mode selection.`,
    )
  }

  if (
    RAW_GATEWAY_URL ||
    GATEWAY_TOKEN ||
    GATEWAY_AGENT_ID ||
    GATEWAY_BACKEND_MODEL
  ) {
    return 'gateway'
  }

  if (UPSTREAM_URL) {
    return 'upstream'
  }

  return 'mock'
}

function normalizeMode(value) {
  if (!value) {
    return ''
  }

  if (value === 'proxy') {
    return 'upstream'
  }

  if (value === 'mock' || value === 'gateway' || value === 'upstream') {
    return value
  }

  return ''
}

function formatBearerToken(token) {
  if (!token) {
    return ''
  }

  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`
}

function getGatewayModelId() {
  return GATEWAY_AGENT_ID ? `openclaw/${GATEWAY_AGENT_ID}` : 'openclaw/default'
}

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function sendJson(response, statusCode, payload) {
  setCorsHeaders(response)
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload, null, 2))
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalBytes = 0

    request.on('data', (chunk) => {
      totalBytes += chunk.length

      if (totalBytes > 1_000_000) {
        reject(new Error('Request body exceeded the 1 MB limit.'))
        request.destroy()
        return
      }

      chunks.push(chunk)
    })

    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('The request body was not valid JSON.'))
      }
    })

    request.on('error', (error) => {
      reject(error)
    })
  })
}

function validateCoachRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('The request body must be a JSON object.')
  }

  if (body.type !== 'fitness-tracker-coach-request') {
    throw new Error('Unexpected request type.')
  }

  if (!body.context || typeof body.context !== 'object') {
    throw new Error('Missing request context.')
  }

  if (!body.context.basePlan || typeof body.context.basePlan !== 'object') {
    throw new Error('Missing basePlan in the request context.')
  }
}

function getJsonCandidate(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return null
  }

  const fencedMatch = text.match(/```json\s*([\s\S]+?)\s*```/i)

  if (fencedMatch?.[1]) {
    return fencedMatch[1]
  }

  const objectStart = text.indexOf('{')
  const objectEnd = text.lastIndexOf('}')

  if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) {
    return null
  }

  return text.slice(objectStart, objectEnd + 1)
}

function tryParseJsonCandidate(text) {
  const candidate = getJsonCandidate(text)

  if (!candidate) {
    return null
  }

  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function tryParseJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function buildMockCoachResponse(requestBody) {
  const { context } = requestBody
  const readiness = context.basePlan?.readiness ?? {}
  const athleteName = context.athleteProfile?.name?.trim()
  const goal = context.workoutInput?.goal ?? 'general fitness'
  const weeklyCount = context.metrics?.weeklySessionCount ?? 0
  const limitations = context.athleteProfile?.limitations?.trim() || ''

  const insights = [
    `${context.metrics?.load?.label ?? 'Load'}: ${context.metrics?.load?.detail ?? 'Load context is available.'}`,
    `${context.metrics?.recovery?.label ?? 'Recovery'}: ${context.metrics?.recovery?.detail ?? 'Recovery context is available.'}`,
  ]

  if (context.metrics?.nutrition?.detail) {
    insights.push(
      `${context.metrics.nutrition.label}: ${context.metrics.nutrition.detail}`,
    )
  }

  if (limitations) {
    insights.push(`Protect the session around this limitation: ${limitations}.`)
  }

  return {
    coachName: COACH_NAME,
    generatedAt: new Date().toISOString(),
    plan: {
      ...context.basePlan,
      headline:
        athleteName && readiness.label
          ? `${athleteName}, ${readiness.label.toLowerCase()} supports a focused ${goal} session today.`
          : context.basePlan.headline,
      detail: context.basePlan.detail,
      adjustments: [
        ...(context.basePlan.adjustments ?? []),
        'This response is coming from the local proxy mock. Use `OPENCLAW_MODE=gateway` for the OpenClaw Gateway or `OPENCLAW_UPSTREAM_URL` for a custom upstream adapter.',
      ],
    },
    insights,
    recoveryRecommendations: [
      'Keep the first block conservative until the warm-up confirms the day.',
      'Use the cooldown to bring the session back down instead of tacking on extra work.',
    ],
    nutritionRecommendations: [
      'Use your saved targets as the floor for today, especially protein and hydration.',
      'If the session pushes longer, keep simple carbs and fluids available.',
    ],
    weeklyFocus:
      weeklyCount >= (context.athleteProfile?.weeklyAvailability ?? 4)
        ? 'The week is already fairly full, so make today repeatable rather than maximal.'
        : 'There is still room in the week, so use today to build momentum without overshooting the next session.',
    warnings: [
      'No upstream OpenClaw URL is configured, so the proxy returned a mock coaching response built from the local generator context.',
    ],
  }
}

function buildUpstreamPayload(requestBody) {
  return requestBody
}

function buildGatewayPayload(requestBody) {
  return {
    model: getGatewayModelId(),
    instructions: buildGatewayInstructions(),
    input: buildGatewayInput(requestBody),
    max_output_tokens: GATEWAY_MAX_OUTPUT_TOKENS,
    temperature: 0,
    top_p: 0.1,
  }
}

function buildGatewayInstructions() {
  return [
    'You are the coaching layer for a fitness tracker app.',
    `Return exactly one JSON object and nothing else. Use "${COACH_NAME}" as coachName unless the request context specifies a better display name.`,
    'Do not wrap the response in markdown fences or add commentary before or after the JSON.',
    'Use the deterministic base plan as the safety guardrail for readiness, duration, load, and effort.',
    'Never make the session more aggressive than the base plan supports for the current readiness cap.',
    'Respect athlete limitations, available equipment, workout goal, recent training load, recovery status, and nutrition context.',
    'If the context is incomplete or uncertain, stay conservative and explain any caveats in warnings.',
    'Required top-level keys: coachName, generatedAt, plan, insights, recoveryRecommendations, nutritionRecommendations, weeklyFocus, warnings.',
    'The fields insights, recoveryRecommendations, nutritionRecommendations, and warnings must be JSON arrays of strings, never a single string.',
    'Required plan keys: readiness, headline, detail, adjustments, suggestions.',
    'Return 1 to 3 plan suggestions. Use suggestion ids recommended, lighter, and support when possible.',
    'Each suggestion must include id, label, title, summary, duration, rpe, estimatedLoad, rationale, fueling, caution, blocks, and exercises.',
    'blocks must be an array of objects with label and detail string fields.',
    'exercises must be an array of objects with name, prescription, and detail string fields.',
    'Use ISO-8601 format for generatedAt and keep all arrays concise and plain-language.',
  ].join('\n')
}

function buildGatewayInput(requestBody) {
  return [
    {
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: buildGatewayPrompt(requestBody),
        },
      ],
    },
  ]
}

function buildGatewayPrompt(requestBody) {
  const { context } = requestBody

  return [
    'Generate a coaching response for this workout request.',
    '',
    'Base plan safety boundary:',
    JSON.stringify(context.basePlan ?? {}, null, 2),
    '',
    'Full coaching context:',
    JSON.stringify(context, null, 2),
  ].join('\n')
}

function normalizeUpstreamResponse(upstreamJson, requestBody) {
  if (upstreamJson && typeof upstreamJson === 'object' && upstreamJson.plan) {
    return upstreamJson
  }

  const textCandidates = getTextCandidates(upstreamJson)

  for (const candidate of textCandidates) {
    const parsed = tryParseJsonCandidate(candidate)

    if (parsed) {
      return parsed
    }
  }

  return {
    ...buildMockCoachResponse(requestBody),
    warnings: [
      MODE === 'gateway'
        ? 'The OpenClaw Gateway responded, but it did not return the expected coach JSON contract. The proxy fell back to a mock coaching response.'
        : 'The upstream service responded, but it did not return the expected JSON contract. The proxy fell back to a mock coaching response.',
    ],
  }
}

function getTextCandidates(payload) {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  return [
    payload.output_text,
    payload.text,
    payload.content,
    payload.response?.output_text,
    payload.response?.text,
    ...extractOutputTextParts(payload.output),
    ...extractOutputTextParts(payload.response?.output),
  ].filter(Boolean)
}

function extractOutputTextParts(outputItems) {
  if (!Array.isArray(outputItems)) {
    return []
  }

  const texts = []

  for (const item of outputItems) {
    if (!item || typeof item !== 'object') {
      continue
    }

    if (typeof item.text === 'string' && item.text.trim()) {
      texts.push(item.text)
    }

    if (!Array.isArray(item.content)) {
      continue
    }

    for (const piece of item.content) {
      if (!piece || typeof piece !== 'object') {
        continue
      }

      if (
        (piece.type === 'output_text' || piece.type === 'text' || !piece.type) &&
        typeof piece.text === 'string' &&
        piece.text.trim()
      ) {
        texts.push(piece.text)
      }
    }
  }

  return texts
}

function extractErrorMessage(responseText, responseJson) {
  if (responseJson?.error?.message) {
    return responseJson.error.message
  }

  if (typeof responseJson?.message === 'string' && responseJson.message.trim()) {
    return responseJson.message
  }

  const trimmed = responseText.trim()

  if (!trimmed) {
    return 'The upstream service returned an empty error response.'
  }

  return trimmed.slice(0, 300)
}

async function callGateway(requestBody) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (GATEWAY_TOKEN) {
    headers[GATEWAY_AUTH_HEADER] = formatBearerToken(GATEWAY_TOKEN)
  }

  if (GATEWAY_AGENT_ID) {
    headers['x-openclaw-agent-id'] = GATEWAY_AGENT_ID
  }

  if (GATEWAY_BACKEND_MODEL) {
    headers['x-openclaw-model'] = GATEWAY_BACKEND_MODEL
  }

  const upstreamResponse = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildGatewayPayload(requestBody)),
  })

  const responseText = await upstreamResponse.text()
  const responseJson = tryParseJson(responseText) ?? tryParseJsonCandidate(responseText) ?? {}

  if (!upstreamResponse.ok) {
    throw new Error(
      `Gateway request failed with ${upstreamResponse.status}: ${extractErrorMessage(
        responseText,
        responseJson,
      )}`,
    )
  }

  return normalizeUpstreamResponse(responseJson, requestBody)
}

async function callGenericUpstream(requestBody) {
  if (!UPSTREAM_URL) {
    return buildMockCoachResponse(requestBody)
  }

  const headers = {
    'Content-Type': 'application/json',
  }

  if (UPSTREAM_AUTH_TOKEN) {
    headers[UPSTREAM_AUTH_HEADER] = UPSTREAM_AUTH_TOKEN
  }

  const upstreamResponse = await fetch(UPSTREAM_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildUpstreamPayload(requestBody)),
  })

  const responseText = await upstreamResponse.text()
  const responseJson =
    tryParseJsonCandidate(responseText) ?? tryParseJson(responseText) ?? {}

  if (!upstreamResponse.ok) {
    throw new Error(
      `Upstream request failed with ${upstreamResponse.status}: ${responseText.slice(0, 300)}`,
    )
  }

  return normalizeUpstreamResponse(responseJson, requestBody)
}

async function callOpenClaw(requestBody) {
  if (MODE === 'gateway') {
    return callGateway(requestBody)
  }

  if (MODE === 'upstream') {
    return callGenericUpstream(requestBody)
  }

  return buildMockCoachResponse(requestBody)
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      setCorsHeaders(response)
      response.writeHead(204)
      response.end()
      return
    }

    if (request.method === 'GET' && request.url === HEALTH_PATH) {
      sendJson(response, 200, {
        ok: true,
        mode: MODE,
        upstreamUrlConfigured: Boolean(UPSTREAM_URL),
        gatewayUrlConfigured: Boolean(RAW_GATEWAY_URL),
        gatewayTokenConfigured: Boolean(GATEWAY_TOKEN),
        gatewayAgentId: GATEWAY_AGENT_ID || 'default',
        gatewayBackendModelConfigured: Boolean(GATEWAY_BACKEND_MODEL),
        coachPath: COACH_PATH,
      })
      return
    }

    if (request.method !== 'POST' || request.url !== COACH_PATH) {
      sendJson(response, 404, {
        error: 'Not found.',
        expectedPath: COACH_PATH,
      })
      return
    }

    const requestBody = await readJsonBody(request)
    validateCoachRequest(requestBody)

    const coachResponse = await callOpenClaw(requestBody)

    sendJson(response, 200, coachResponse)
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : 'Unknown error.',
    })
  }
})

server.listen(PORT, HOST, () => {
  const mode =
    MODE === 'gateway'
      ? `gateway mode -> ${GATEWAY_URL} (${getGatewayModelId()})`
      : MODE === 'upstream'
        ? `proxying to ${UPSTREAM_URL}`
        : 'mock mode'

  console.log(`OpenClaw proxy listening on http://${HOST}:${PORT}${COACH_PATH} (${mode})`)
  console.log(`Health check available at http://${HOST}:${PORT}${HEALTH_PATH}`)
})
