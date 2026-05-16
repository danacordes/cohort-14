/**
 * Apollo executeOperation exercises schema + resolver wiring against the real SQLite pool,
 * isolated on a temporary DB_PATH (assigned before `./schema.js` loads `pool`).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { ApolloServer } from '@apollo/server';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { runPendingMigrations } from '../db/migrate-lib.js';

const dbFile = path.join(os.tmpdir(), `kb-mgmt-gql-${randomUUID()}.db`);
process.env.DB_PATH = dbFile;

const [{ typeDefs, resolvers }] = await Promise.all([import('./schema.js')]);

const CREATE_KB = `
  mutation CreateKb($input: CreateKbArticleInput!) {
    createKbArticle(input: $input) {
      id
      status
      title
      currentVersion
      category { id name }
      author { id email }
    }
  }
`;

const SUBMIT_KB = `
  mutation SubmitKb($id: ID!) {
    submitKbArticleForReview(id: $id, reviewerId: null) {
      id
      status
    }
  }
`;

const REJECT_KB = `
  mutation RejectKb($id: ID!, $comment: String!) {
    rejectKbArticle(id: $id, comment: $comment) {
      id
      status
      lastReviewComment
    }
  }
`;

const QUERY_KB = `
  query KbArticle($id: ID!) {
    kbArticle(id: $id) {
      id
      status
      title
    }
  }
`;

const PUBLISH_KB = `
  mutation PublishKb($id: ID!) {
    publishKbArticle(id: $id) {
      id
      status
    }
  }
`;

describe('KB management GraphQL (Apollo executeOperation)', () => {
  /** @type {ApolloServer | null} */
  let server = null;
  /** @type {string} */
  let agentId = '';
  /** @type {string} */
  let adminId = '';
  /** @type {string} */
  let userId = '';
  /** @type {string} */
  let kbCategoryId = '';

  async function gql(user, doc, variables = {}) {
    assert.ok(server);
    const ctx = {};
    if (user !== undefined) ctx.user = user;
    const out = await server.executeOperation({ query: doc, variables }, { contextValue: ctx });
    /** @type {{ kind: 'single'; singleResult: unknown }} */
    const body = /** @type {any} */ (out.body);
    assert.equal(body.kind, 'single');
    return body.singleResult;
  }

  before(async () => {
    fs.rmSync(dbFile, { force: true });

    agentId = randomUUID();
    adminId = randomUUID();
    userId = randomUUID();
    kbCategoryId = randomUUID();

    server = new ApolloServer({ typeDefs, resolvers });
    await server.start();

    const { getWriteDb } = await import('../db/pool.js');
    const db = getWriteDb();
    db.exec('PRAGMA foreign_keys = ON;');

    runPendingMigrations(db);

    db.prepare(
      `INSERT INTO users (id, email, role, password_hash)
       VALUES (?, ?, 'agent', NULL), (?, ?, 'admin', NULL), (?, ?, 'user', NULL)`,
    ).run(agentId, `agent-${agentId.slice(0, 8)}@example.com`, adminId, `admin-${adminId.slice(0, 8)}@example.com`, userId, `user-${userId.slice(0, 8)}@example.com`);

    db.prepare(`INSERT INTO kb_category (id, name, slug) VALUES (?, 'GraphQL KB Cat', 'graphql-kb-cat')`).run(kbCategoryId);
  });

  after(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    const { closeAll } = await import('../db/pool.js');
    closeAll();
    fs.rmSync(dbFile, { force: true });
  });

  it('denies KB create when caller is authenticated as end-user', async () => {
    const result = await gql(
      { id: userId, role: 'user' },
      CREATE_KB,
      { input: { categoryId: kbCategoryId, articleType: 'FAQ', title: 'X', body: 'Y' } },
    );
    assert.ok(result.errors?.length);
    assert.equal(result.errors?.[0].extensions?.code, 'FORBIDDEN');
  });

  it('allows agent draft create, hides draft from end-user kbArticle query, publishes for all readers', async () => {
    const created = await gql(
      { id: agentId, role: 'agent' },
      CREATE_KB,
      { input: { categoryId: kbCategoryId, articleType: 'FAQ', title: 'GraphQL Draft', body: 'Body via GQL' } },
    );
    assert.ifError(created.errors);
    const id = /** @type {any} */ (created.data)?.createKbArticle?.id;
    assert.ok(typeof id === 'string', 'expected article id');

    const hiddenFromUser = await gql({ id: userId, role: 'user' }, QUERY_KB, { id });
    assert.ifError(hiddenFromUser.errors);
    assert.equal(hiddenFromUser.data?.kbArticle, null);

    await gql({ id: adminId, role: 'admin' }, PUBLISH_KB, { id });

    const visible = await gql({ id: userId, role: 'user' }, QUERY_KB, { id });
    assert.ifError(visible.errors);
    assert.equal(visible.data?.kbArticle?.status, 'Published');
    assert.equal(visible.data?.kbArticle?.title, 'GraphQL Draft');
  });

  it('allows admin rejection after pending review', async () => {
    const created = await gql(
      { id: agentId, role: 'agent' },
      CREATE_KB,
      { input: { categoryId: kbCategoryId, articleType: 'Known Error', title: 'Review me', body: 'x' } },
    );
    assert.ifError(created.errors);
    const id = /** @type {any} */ (created.data)?.createKbArticle?.id;

    const submitted = await gql({ id: agentId, role: 'agent' }, SUBMIT_KB, { id });
    assert.ifError(submitted.errors);
    assert.equal(submitted.data?.submitKbArticleForReview?.status, 'PendingReview');

    const rejected = await gql(
      { id: adminId, role: 'admin' },
      REJECT_KB,
      { id, comment: 'Needs sources and clearer steps.' },
    );
    assert.ifError(rejected.errors);
    assert.equal(rejected.data?.rejectKbArticle?.status, 'Draft');
    assert.equal(rejected.data?.rejectKbArticle?.lastReviewComment, 'Needs sources and clearer steps.');
  });
});
