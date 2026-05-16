import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { TEXT_MODEL_ID, EMBEDDING_MODEL_ID } from '../../constants/bedrockModels.js';
import { BedrockError } from '../../errors/bedrockError.js';
import { deterministicMockEmbedding } from './mockEmbedding.js';
import { logAiInvocation } from './bedrockTelemetry.js';

const ENV_DISABLED = /^1|true$/i.test(String(process.env.BEDROCK_DISABLED ?? ''));
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 4;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * @param {unknown} err
 */
function httpStatus(err) {
  if (typeof err === 'object' && err !== null && '$metadata' in err && err.$metadata) {
    /** @type {{ httpStatusCode?: number }} */
    const m = err.$metadata;
    return m.httpStatusCode;
  }
  return undefined;
}

/**
 * @param {unknown} err
 */
function isRetryableBedrock(err) {
  const code =
    typeof err === 'object' && err !== null && 'name' in err && typeof err.name === 'string'
      ? err.name
      : '';
  const h = httpStatus(err);
  if (h === 429 || h === 502 || h === 503 || h === 504) return true;
  if (code.includes('Throttling')) return true;
  if (code === 'ServiceUnavailable' || code === 'ModelTimeoutException') return true;
  if (
    !h &&
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof /** @type {{ message?: string }} */ (err).message === 'string' &&
    /timeout/i.test(String(/** @type {{ message?: string }} */ (err).message))
  ) {
    return true;
  }
  if (code === 'TimeoutError') return true;
  return false;
}

/**
 * @typedef {{ model?: string; systemPrompt?: string; userPrompt: string; maxTokens?: number }} LLMRequest
 */

/**
 * @typedef {{ content: string; inputTokens?: number; outputTokens?: number }} LLMResponse
 */

/**
 * @param {Uint8Array} raw
 */
function decodeJsonBody(raw) {
  const txt = Buffer.from(raw).toString('utf8');
  return JSON.parse(txt);
}

/**
 * @param {Uint8Array} raw
 */
function extractClaudeText(raw) {
  const json = decodeJsonBody(raw);
  /** @type {string[]} */
  const parts = [];
  for (const block of json.content ?? []) {
    if (block?.type === 'text' && typeof block?.text === 'string') parts.push(block.text);
  }
  const content = parts.join('');
  const inputTokens = json.usage?.input_tokens ?? json.usage?.inputTokens;
  const outputTokens = json.usage?.output_tokens ?? json.usage?.outputTokens;
  return { content, inputTokens, outputTokens };
}

/**
 * @param {Uint8Array} raw
 */
function extractEmbedding(raw) {
  const json = decodeJsonBody(raw);
  const embedding = json.embedding ?? json.Embedding;
  if (!Array.isArray(embedding)) {
    throw new BedrockError('Bedrock Titan response missing embedding[]', {});
  }
  return new Float32Array(embedding.map((x) => Number(x)));
}

/**
 * Normalize Bedrock `InvokeModel` response body into a standalone buffer.
 *
 * @param {Uint8Array | undefined} body
 */
function responseBodyToUint8(body) {
  if (body == null || body.byteLength === 0) return new Uint8Array(0);
  const b = body;
  if (b instanceof Uint8Array) return new Uint8Array(b);
  if (Buffer.isBuffer(b)) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  throw new BedrockError('Unexpected Bedrock response body type');
}

/**
 * @param {BedrockRuntimeClient} client
 * @param {*} cmd InvokeModelCommand
 */
function sendWithinTimeout(client, cmd) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('Bedrock call timeout'), { name: 'TimeoutError' })), REQUEST_TIMEOUT_MS);
    client.send(cmd).then((v) => resolve(v)).catch(reject).finally(() => clearTimeout(t));
  });
}

/**
 * WO-36 foundation client: Claude Haiku (generate) + Titan Embeddings V2 (embed).
 * Use {@link createLLMClient()} for sensible defaults / test disable switch.
 *
 * Credentials: EC2/instance role default chain (`AWS_PROFILE`, IMDS, etc.).
 *
 * Prompt and completion bodies are never logged — only coarse metadata via {@link logAiInvocation}.
 */
export class LLMClient {
  /**
   * @param {{ client?: BedrockRuntimeClient; disabled?: boolean; region: string }} opts
   */
  constructor(opts) {
    /** @private */
    this._client = opts.client;
    /** @private */
    this._disabled = Boolean(opts.disabled);
    /** @private */
    this._region = opts.region;
  }

  /**
   * @param {LLMRequest} req
   * @returns {Promise<LLMResponse>}
   */
  async generate(req) {
    const userPrompt = (req.userPrompt ?? '').trim();
    if (!userPrompt) {
      throw new BedrockError('userPrompt is required', { modelId: req.model ?? TEXT_MODEL_ID });
    }
    const modelId = req.model ?? TEXT_MODEL_ID;
    const maxTokens = Math.min(Math.max(req.maxTokens ?? 1024, 1), 4096);

    if (this._disabled) {
      const content = `[BEDROCK_DISABLED] echo: ${userPrompt.slice(0, 200)}`;
      logAiInvocation({
        op: 'generate',
        modelId,
        mocked: true,
        outputChars: content.length,
      });
      return { content, inputTokens: 0, outputTokens: Math.ceil(content.length / 4) };
    }

    const bodyObj = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: userPrompt }],
    };
    if (req.systemPrompt?.trim()) {
      bodyObj.system = req.systemPrompt.trim();
    }

    const body = Buffer.from(JSON.stringify(bodyObj), 'utf8');
    const raw = await this._invokeWithRetry(modelId, body);
    const { content, inputTokens, outputTokens } = extractClaudeText(raw);
    logAiInvocation({ op: 'generate', modelId, inputTokens, outputTokens });
    return { content, inputTokens, outputTokens };
  }

  /**
   * @param {string} text
   * @returns {Promise<Float32Array>}
   */
  async embed(text) {
    const t = (text ?? '').trim();
    if (!t) {
      throw new BedrockError('embed() text cannot be empty', { modelId: EMBEDDING_MODEL_ID });
    }

    if (this._disabled) {
      const vector = deterministicMockEmbedding(t);
      logAiInvocation({
        op: 'embed',
        modelId: EMBEDDING_MODEL_ID,
        mocked: true,
        dimensions: vector.length,
      });
      return vector;
    }

    const bodyObj = { inputText: t };
    const body = Buffer.from(JSON.stringify(bodyObj), 'utf8');
    const raw = await this._invokeWithRetry(EMBEDDING_MODEL_ID, body);
    const vector = extractEmbedding(raw);
    logAiInvocation({ op: 'embed', modelId: EMBEDDING_MODEL_ID, dimensions: vector.length });
    return vector;
  }

  /**
   * @param {string} modelId
   * @param {Buffer} body
   * @returns {Promise<Uint8Array>}
   */
  async _invokeWithRetry(modelId, body) {
    if (!this._client) {
      throw new BedrockError('Bedrock client not configured', { modelId });
    }

    /** @type {unknown} */
    let lastErr;
    for (let attempt = 1; attempt <= DEFAULT_MAX_ATTEMPTS; attempt += 1) {
      const t0 = Date.now();
      try {
        const cmd = new InvokeModelCommand({
          modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body,
        });
        const resp = await sendWithinTimeout(this._client, cmd);
        const raw = responseBodyToUint8(resp.body);

        logAiInvocation({
          op: 'bedrock_invoke',
          modelId,
          ok: true,
          latencyMs: Date.now() - t0,
          attempt,
        });

        return raw;
      } catch (err) {
        lastErr = err;
        logAiInvocation({
          op: 'bedrock_invoke',
          modelId,
          ok: false,
          latencyMs: Date.now() - t0,
          attempt,
          errorName:
            typeof err === 'object' && err !== null && 'name' in err ? String(err.name) : '',
          httpStatusCode: httpStatus(err),
        });
        const retryable = isRetryableBedrock(err);
        if (!retryable || attempt === DEFAULT_MAX_ATTEMPTS) {
          break;
        }
        const backoff =
          Math.min(500 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 200);
        await sleep(backoff);
      }
    }

    throw new BedrockError(`Bedrock InvokeModel failed for ${modelId}`, {
      cause: lastErr,
      modelId,
    });
  }
}

/**
 * @param {{ client?: BedrockRuntimeClient; disableBedrock?: boolean; region?: string }} [options]
 */
export function createLLMClient(options = {}) {
  const disabled = Boolean(options.disableBedrock || ENV_DISABLED);
  const region = options.region ?? process.env.AWS_REGION ?? 'us-east-1';

  if (disabled) {
    return new LLMClient({ disabled: true, region });
  }

  const client = options.client ?? new BedrockRuntimeClient({ region });
  return new LLMClient({ client, disabled: false, region });
}
