import 'dotenv/config';
import path from 'path';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { openDatabase } from '../src/db/openDatabase.js';
import { runPendingMigrations } from '../src/db/migrate-lib.js';
import { reserveNextKbArticleNumber } from '../src/db/kb-number.js';
import { rebuildAllKbArticleFts } from '../src/services/kb/kbArticleFtsSync.js';

const raw = process.env.DB_PATH ?? 'dev.db';
const dbPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);

const db = openDatabase(dbPath);

try {
  runPendingMigrations(db);

  // Ticket categories — INSERT OR IGNORE so the script is re-runnable.
  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO ticket_category (id, name, slug)
    VALUES (?, ?, ?)
  `);

  const categories = [
    { id: 'cat-hardware',        name: 'Hardware',               slug: 'hardware' },
    { id: 'cat-software',        name: 'Software',               slug: 'software' },
    { id: 'cat-network',         name: 'Network & Connectivity',  slug: 'network' },
    { id: 'cat-access-identity', name: 'Access & Identity',      slug: 'access-identity' },
    { id: 'cat-general',         name: 'General',                slug: 'general' },
  ];

  db.exec('BEGIN');
  try {
    for (const { id, name, slug } of categories) {
      insertCategory.run(id, name, slug);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  console.log(`Seeded ${categories.length} ticket categories on ${dbPath}`);

  // Default admin user — dev only. Password: Admin1234!
  // Safe to re-run — never overwrites an existing record.
  const adminEmail = 'admin@cohort14.local';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existing) {
    const passwordHash = await bcrypt.hash('Admin1234!', 12);
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, role)
      VALUES (?, ?, ?, 'admin')
    `).run(randomUUID(), adminEmail, passwordHash);
    console.log(`Seeded default admin user: ${adminEmail} / Admin1234!`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  const adm = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (adm) {
    const adminId = adm.id;
    const kbCats = [
      { id: 'kb-cat-network', name: 'Network & Connectivity', slug: 'kb-network' },
      { id: 'kb-cat-access', name: 'Access & Identity', slug: 'kb-access' },
    ];
    const insCat = db.prepare(
      `INSERT OR IGNORE INTO kb_category (id, name, slug) VALUES (?, ?, ?)`,
    );
    const insArt = db.prepare(
      `INSERT OR IGNORE INTO kb_article
        (id, number, title, body, article_type, category_id, tags_json, status, author_id, current_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const c of kbCats) insCat.run(c.id, c.name, c.slug);

      if (!db.prepare('SELECT 1 FROM kb_article WHERE id = ?').get('kb-seed-wifi')) {
        const num = reserveNextKbArticleNumber(db);
        insArt.run(
          'kb-seed-wifi',
          num,
          'Resolve Wi‑Fi DHCP failures',
          'If the laptop shows "No Internet" but is connected: release/renew DHCP, flush DNS cache, reboot AP. Keywords: dhcp lease.',
          'Solution',
          'kb-cat-network',
          JSON.stringify(['wifi', 'dhcp', 'network']),
          'Published',
          adminId,
          1,
        );
      }

      if (!db.prepare('SELECT 1 FROM kb_article WHERE id = ?').get('kb-seed-vpn')) {
        const num = reserveNextKbArticleNumber(db);
        insArt.run(
          'kb-seed-vpn',
          num,
          'Corporate VPN basics',
          'Install FortiClient from the software portal. Use MFA when prompted.',
          'How-To Guide',
          'kb-cat-access',
          JSON.stringify(['vpn', 'mfa']),
          'Published',
          adminId,
          1,
        );
      }

      if (!db.prepare('SELECT 1 FROM kb_article WHERE id = ?').get('kb-seed-review')) {
        const num = reserveNextKbArticleNumber(db);
        insArt.run(
          'kb-seed-review',
          num,
          'Password reset runbook (draft)',
          'Pending validation — do not distribute.',
          'Known Error',
          'kb-cat-access',
          JSON.stringify(['password']),
          'PendingReview',
          adminId,
          1,
        );
      }

      if (!db.prepare('SELECT 1 FROM kb_article_attachment WHERE id = ?').get('kb-att-1')) {
        db.prepare(
          `INSERT INTO kb_article_attachment
            (id, article_id, filename, mime_type, extracted_text, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          'kb-att-1',
          'kb-seed-wifi',
          'vpn-guide.txt',
          'text/plain',
          'FortiClient VPN split tunnel must be disabled for internal hosts.',
          adminId,
        );
      }

      const insView = db.prepare(
        `INSERT INTO kb_article_view (id, article_id, user_id) VALUES (?, ?, ?)`,
      );
      for (let i = 0; i < 4; i += 1) {
        insView.run(randomUUID(), 'kb-seed-wifi', adminId);
      }

      db.prepare(
        `INSERT OR IGNORE INTO kb_article_feedback (id, article_id, user_id, rating)
         VALUES (?, ?, ?, ?)`,
      ).run(randomUUID(), 'kb-seed-wifi', adminId, 'helpful');

      db.prepare(
        `INSERT INTO deflection_event (id, user_id, article_id, query_text)
         VALUES (?, ?, ?, ?)`,
      ).run(randomUUID(), adminId, 'kb-seed-wifi', 'wifi dhcp');

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    rebuildAllKbArticleFts(db);
    console.log('Seeded KB categories, sample articles, views, and FTS index');
  }
} finally {
  db.close();
}
