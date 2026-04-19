import { spawn, spawnSync } from 'node:child_process'

const CONTAINER_NAME =
  process.env.OPENCLAW_DOCKER_CONTAINER?.trim() || 'openclaw-gateway'
const DEFAULT_GATEWAY_PORT = '18789'
const DEFAULT_PROXY_PORT = '8787'

function fail(message) {
  console.error(message)
  process.exit(1)
}

function runDocker(args) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
  })

  if (result.error) {
    fail(`Docker command failed: ${result.error.message}`)
  }

  if (result.status !== 0) {
    fail(result.stderr.trim() || `Docker command exited with code ${result.status}.`)
  }

  return result.stdout.trim()
}

function readContainerEnv(containerName) {
  const raw = runDocker(['inspect', containerName, '--format', '{{json .Config.Env}}'])
  const entries = JSON.parse(raw)
  const env = {}

  for (const entry of entries) {
    const separatorIndex = entry.indexOf('=')

    if (separatorIndex === -1) {
      continue
    }

    env[entry.slice(0, separatorIndex)] = entry.slice(separatorIndex + 1)
  }

  return env
}

function readGatewayPort(containerName) {
  const raw = runDocker([
    'inspect',
    containerName,
    '--format',
    '{{json (index .NetworkSettings.Ports "18789/tcp")}}',
  ])

  if (!raw || raw === 'null') {
    return DEFAULT_GATEWAY_PORT
  }

  const bindings = JSON.parse(raw)

  if (!Array.isArray(bindings) || !bindings[0]?.HostPort) {
    return DEFAULT_GATEWAY_PORT
  }

  return bindings[0].HostPort
}

async function verifyGateway(gatewayUrl, gatewayToken) {
  const modelsUrl = gatewayUrl.replace(/\/v1\/responses$/, '/v1/models')

  const response = await fetch(modelsUrl, {
    headers: {
      Authorization: /^Bearer\s+/i.test(gatewayToken)
        ? gatewayToken
        : `Bearer ${gatewayToken}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()

    fail(
      `OpenClaw Docker gateway check failed with ${response.status}: ${text.slice(0, 200)}`,
    )
  }
}

const containerEnv = readContainerEnv(CONTAINER_NAME)
const gatewayToken = containerEnv.OPENCLAW_GATEWAY_TOKEN?.trim()

if (!gatewayToken) {
  fail(
    `Container "${CONTAINER_NAME}" does not expose OPENCLAW_GATEWAY_TOKEN, so the coach proxy cannot authenticate to the gateway.`,
  )
}

const gatewayHost = process.env.OPENCLAW_DOCKER_GATEWAY_HOST?.trim() || '127.0.0.1'
const gatewayPort =
  process.env.OPENCLAW_DOCKER_GATEWAY_PORT?.trim() || readGatewayPort(CONTAINER_NAME)
const gatewayUrl =
  process.env.OPENCLAW_GATEWAY_URL?.trim() ||
  `http://${gatewayHost}:${gatewayPort}/v1/responses`
const proxyPort = process.env.PORT?.trim() || DEFAULT_PROXY_PORT

await verifyGateway(gatewayUrl, gatewayToken)

console.log(
  `Starting coach proxy against Docker container "${CONTAINER_NAME}" via ${gatewayUrl}.`,
)
console.log(`Coach endpoint: http://127.0.0.1:${proxyPort}/coach`)

const child = spawn(process.execPath, ['scripts/openclaw-proxy.mjs'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: proxyPort,
    OPENCLAW_MODE: 'gateway',
    OPENCLAW_GATEWAY_URL: gatewayUrl,
    OPENCLAW_GATEWAY_TOKEN: gatewayToken,
    COACH_NAME:
      process.env.COACH_NAME?.trim() || 'OpenClaw Docker Coach',
  },
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
