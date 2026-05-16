import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { EMBEDDING_MODEL_ID } from '../../constants/bedrockModels.js';
import { LLMClient, createLLMClient } from './llmClient.js';

describe('LLMClient (disabled)', () => {
  it('generate returns echoed stub', async () => {
    const c = createLLMClient({ disableBedrock: true });
    const r = await c.generate({ userPrompt: 'Hello world' });
    assert.match(r.content, /BEDROCK_DISABLED/);
    assert.ok(r.outputTokens !== undefined);
  });

  it('embed returns deterministic normalized vectors', async () => {
    const c = createLLMClient({ disableBedrock: true });
    const a = await c.embed('ticket one');
    const b = await c.embed('ticket one');
    const c2 = await c.embed('different');
    assert.equal(a.length, 1024);
    assert.ok(Array.from(a.slice(0, 12)).every((x, i) => x === b[i]));
    assert.ok(c2.some((x, i) => x !== a[i]));
  });
});

describe('LLMClient (mock retries)', () => {
  it('retries InvokeModel on throttling then returns embedding', async () => {
    let calls = 0;
    const fakeClient = {
      send(/** @type {InvokeModelCommand} */ command) {
        calls += 1;
        assert(command instanceof InvokeModelCommand);
        if (calls <= 2) {
          /** @type {Error & {$metadata?: object}} */
          const err = Object.assign(new Error('throttled'), {
            name: 'ThrottlingException',
            $metadata: { httpStatusCode: 429 },
          });
          return Promise.reject(err);
        }
        const inp = /** @type {any} */ (command).input;
        assert.strictEqual(inp.modelId, EMBEDDING_MODEL_ID);
        const embedding = Array.from({ length: 16 }, (_, i) => (i === 7 ? 1 : 0));
        const buf = Uint8Array.from(Buffer.from(JSON.stringify({ embedding }), 'utf8'));
        return Promise.resolve({ body: buf, $metadata: { httpStatusCode: 200 } });
      },
    };

    const c = new LLMClient({
      client: /** @type {any} */ (fakeClient),
      disabled: false,
      region: 'us-east-1',
    });
    const v = await c.embed('anything');
    assert.equal(calls, 3);
    assert.equal(v.length, 16);
    assert.ok(Math.abs(v[7] - 1) < 1e-5);
  });

  it('generates Claude message output on mock success', async () => {
    const fakeClient = {
      async send(command) {
        assert(command instanceof InvokeModelCommand);
        const buf = Uint8Array.from(
          Buffer.from(
            JSON.stringify({
              content: [{ type: 'text', text: 'Synthetic reply' }],
              usage: { input_tokens: 3, output_tokens: 11 },
            }),
            'utf8'
          )
        );
        return { body: buf, $metadata: { httpStatusCode: 200 } };
      },
    };

    const c = new LLMClient({
      client: /** @type {any} */ (fakeClient),
      disabled: false,
      region: 'us-east-1',
    });
    const r = await c.generate({ userPrompt: 'Hi there' });
    assert.equal(r.content, 'Synthetic reply');
    assert.equal(r.inputTokens, 3);
    assert.equal(r.outputTokens, 11);
  });
});
