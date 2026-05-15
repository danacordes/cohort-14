import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  getPolicies,
  getPolicyForPriority,
  upsertPolicy,
  getGlobalConfig,
  updateGlobalConfig,
} from './slaConfigService.js';

function buildDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE sla_policy (
      id TEXT PRIMARY KEY,
      priority TEXT NOT NULL CHECK (priority IN ('CRITICAL','HIGH','MEDIUM','LOW')),
      response_time_hours INTEGER NOT NULL CHECK (response_time_hours > 0),
      resolution_time_hours INTEGER NOT NULL CHECK (resolution_time_hours > response_time_hours),
      effective_from TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE sla_global_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      escalation_threshold_percent INTEGER NOT NULL DEFAULT 80
        CHECK (escalation_threshold_percent BETWEEN 50 AND 95),
      unassigned_escalation_threshold_hours INTEGER NOT NULL DEFAULT 4
        CHECK (unassigned_escalation_threshold_hours > 0)
    );
    INSERT INTO sla_global_config VALUES (1, 80, 4);
  `);
  return db;
}

describe('slaConfigService', () => {
  let db;
  before(() => { db = buildDb(); });
  after(() => { db.close(); });

  describe('getPolicyForPriority — fallback defaults', () => {
    it('returns hard-coded defaults when no DB records exist', () => {
      const policy = getPolicyForPriority(db, 'HIGH');
      assert.equal(policy.responseTimeHours, 4);
      assert.equal(policy.resolutionTimeHours, 8);
    });

    it('falls back to MEDIUM defaults for unknown priority code', () => {
      const policy = getPolicyForPriority(db, 'UNKNOWN');
      assert.equal(policy.responseTimeHours, 8);
      assert.equal(policy.resolutionTimeHours, 24);
    });
  });

  describe('upsertPolicy', () => {
    it('inserts a new SLA policy', () => {
      const row = upsertPolicy(db, { priority: 'CRITICAL', responseTimeHours: 1, resolutionTimeHours: 4, createdBy: 'admin' });
      assert.equal(row.priority, 'CRITICAL');
      assert.equal(row.response_time_hours, 1);
      assert.equal(row.resolution_time_hours, 4);
    });

    it('preserves historical records (inserts new row each time)', () => {
      upsertPolicy(db, { priority: 'HIGH', responseTimeHours: 4, resolutionTimeHours: 8, createdBy: 'admin' });
      upsertPolicy(db, { priority: 'HIGH', responseTimeHours: 3, resolutionTimeHours: 6, createdBy: 'admin' });
      const allHigh = db.prepare("SELECT * FROM sla_policy WHERE priority = 'HIGH' ORDER BY effective_from ASC").all();
      assert.ok(allHigh.length >= 2);
    });

    it('rejects response >= resolution', () => {
      assert.throws(
        () => upsertPolicy(db, { priority: 'MEDIUM', responseTimeHours: 8, resolutionTimeHours: 8, createdBy: 'admin' }),
        { name: 'ValidationError' }
      );
      assert.throws(
        () => upsertPolicy(db, { priority: 'MEDIUM', responseTimeHours: 10, resolutionTimeHours: 8, createdBy: 'admin' }),
        { name: 'ValidationError' }
      );
    });

    it('rejects invalid priority', () => {
      assert.throws(
        () => upsertPolicy(db, { priority: 'URGENT', responseTimeHours: 1, resolutionTimeHours: 4, createdBy: 'admin' }),
        { name: 'ValidationError' }
      );
    });

    it('rejects non-positive responseTimeHours', () => {
      assert.throws(
        () => upsertPolicy(db, { priority: 'LOW', responseTimeHours: 0, resolutionTimeHours: 8, createdBy: 'admin' }),
        { name: 'ValidationError' }
      );
    });
  });

  describe('getPolicies', () => {
    it('returns one active record per priority (most recent)', () => {
      // Seed all 4 priorities
      for (const [p, r, res] of [['MEDIUM', 8, 24], ['LOW', 24, 72]]) {
        upsertPolicy(db, { priority: p, responseTimeHours: r, resolutionTimeHours: res, createdBy: 'admin' });
      }
      const policies = getPolicies(db);
      const priorities = policies.map((p) => p.priority);
      assert.ok(priorities.includes('CRITICAL'));
      assert.ok(priorities.includes('HIGH'));
      // No duplicates
      assert.equal(new Set(priorities).size, priorities.length);
    });

    it('returns most recent policy when multiple exist for a priority', () => {
      upsertPolicy(db, { priority: 'CRITICAL', responseTimeHours: 2, resolutionTimeHours: 5, createdBy: 'admin' });
      const policies = getPolicies(db);
      const critical = policies.find((p) => p.priority === 'CRITICAL');
      assert.equal(critical.response_time_hours, 2);
    });
  });

  describe('getPolicyForPriority — after DB records exist', () => {
    it('returns DB policy, not hard-coded default', () => {
      const policy = getPolicyForPriority(db, 'CRITICAL');
      assert.equal(policy.responseTimeHours, 2);
      assert.equal(policy.resolutionTimeHours, 5);
    });
  });

  describe('getGlobalConfig', () => {
    it('returns default values', () => {
      const config = getGlobalConfig(db);
      assert.equal(config.escalation_threshold_percent, 80);
      assert.equal(config.unassigned_escalation_threshold_hours, 4);
    });
  });

  describe('updateGlobalConfig', () => {
    it('updates escalation threshold', () => {
      updateGlobalConfig(db, { escalationThresholdPercent: 75 });
      assert.equal(getGlobalConfig(db).escalation_threshold_percent, 75);
    });

    it('updates unassigned hours', () => {
      updateGlobalConfig(db, { unassignedEscalationThresholdHours: 8 });
      assert.equal(getGlobalConfig(db).unassigned_escalation_threshold_hours, 8);
    });

    it('rejects threshold below 50', () => {
      assert.throws(() => updateGlobalConfig(db, { escalationThresholdPercent: 49 }), { name: 'ValidationError' });
    });

    it('rejects threshold above 95', () => {
      assert.throws(() => updateGlobalConfig(db, { escalationThresholdPercent: 96 }), { name: 'ValidationError' });
    });

    it('rejects non-integer threshold', () => {
      assert.throws(() => updateGlobalConfig(db, { escalationThresholdPercent: 70.5 }), { name: 'ValidationError' });
    });

    it('rejects zero unassigned hours', () => {
      assert.throws(() => updateGlobalConfig(db, { unassignedEscalationThresholdHours: 0 }), { name: 'ValidationError' });
    });
  });
});
