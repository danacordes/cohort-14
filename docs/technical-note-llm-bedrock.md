# Technical note: LLM client & embedding infrastructure (Bedrock)

**Work order:** WO #36 — Build AI / LLM Client & Embedding Infrastructure  
**Applies to:** cohort-14 backend only (feature-layer GraphQL is later WOs).

## Purpose

Provides the single choke point for AWS Bedrock text generation and embeddings, plus SQLite storage for `Float32Array` vectors and cosine-similarity search in application memory (consistent with blueprint O(n) retrieval at training-project scale).

## Environment

| Variable | Meaning |
|---------|---------|
| `AWS_REGION` | Bedrock Runtime client region (default `us-east-1`). |
| `BEDROCK_DISABLED` | When `1`/`true`: no AWS calls — `createLLMClient()` uses mocks (CI / local dev). |

Credentials use the SDK default chain (EC2 IAM instance profile preferred). **Never** persist Bedrock keys in `.env`.

## Modules

| Path | Responsibility |
|------|----------------|
| `src/constants/bedrockModels.js` | Model IDs (`TEXT_MODEL_ID`, `EMBEDDING_MODEL_ID`). |
| `src/errors/bedrockError.js` | Thrown after retry exhaustion. |
| `src/services/ai/llmClient.js` | `LLMClient`: `generate()` (Claude 3 Haiku), `embed()` (Titan Text V2). ~10s invoke timeout per attempt, retries on throttling / 5xx, metadata-only JSON logs via `console.info`. |
| `src/services/ai/embeddingService.js` | `storeEmbedding()`, `findSimilar()`, `embedWithoutPersist()`. |
| `src/services/ai/cosineSimilarity.js` | Pure cosine. |
| `src/services/ai/vectorBlob.js` | BLOB ⇄ `Float32Array`. |
| `src/services/ai/mockEmbedding.js` | Deterministic embeddings when Bedrock disabled. |
| `migrations/008_embedding_record.sql` | Table `embedding_record` — PK `(entity_type, entity_id)` upsert semantics. |

## Observability

Telemetry emits **single-line JSON** with `{ cohort14_ai_invoke: true, ... }`: operation, `modelId`, latency, coarse token or dimension counters, **`ok`**, error name / HTTP status when applicable. **Prompt bodies are never logged.**

Ship these lines to CloudWatch via the existing EC2 workload + CloudWatch Agent (IAM already allows `/cohort14/*` log groups).

## IAM

Inline policy **`BedrockFoundationModelsInvoke`** in `infra/cohort14-infra.yaml`: `bedrock:InvokeModel` on the Claude Haiku and Titan Embeddings V2 **foundation-model** ARNs in the deployment region. In the AWS console, also **enable model access** for both models in Bedrock once per account/region.

## Downstream consumers

Later classification / summarization / virtual-agent WOs should use `createLLMClient()`, call **`auditAiAction()`** when persisting AI-attributed mutations, and keep Bedrock outages **non-fatal** where the blueprint requires it.
