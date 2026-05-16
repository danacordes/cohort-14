/** Raised when AWS Bedrock text or embedding invocation fails after retries. */
export class BedrockError extends Error {
  /**
   * @param {string} message
   * @param {{ cause?: unknown, modelId?: string }} [extra]
   */
  constructor(message, { cause, modelId } = {}) {
    super(message);
    if (cause !== undefined && cause !== null) this.cause = cause;
    this.name = 'BedrockError';
    /** @type {string | undefined} */
    this.modelId = modelId;
  }
}
