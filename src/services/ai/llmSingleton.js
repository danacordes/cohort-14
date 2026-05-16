import { createLLMClient } from './llmClient.js';

/** @type {import('./llmClient.js').LLMClient | undefined} */
let _client;

/** One shared Bedrock-backed client per process (avoids pooling extra AWS SDK stacks). */
export function getSharedLLMClient() {
  if (!_client) _client = createLLMClient();
  return _client;
}
