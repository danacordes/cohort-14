import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { ValidationError } from '../errors/index.js';
import { getConfig } from './businessCalendarService.js';

const SURVEY_EXPIRY_DAYS = 30;
const SURVEY_EXPIRY_SECONDS = SURVEY_EXPIRY_DAYS * 24 * 60 * 60;

function getSecret() {
  const secret = process.env.CSAT_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error('CSAT_SECRET environment variable is not set');
  return secret;
}

/**
 * Generate a signed survey token for a ticket closure event.
 * Token embeds ticketId and closureNumber and expires in 30 days.
 *
 * @param {string} ticketId
 * @param {number} closureNumber
 * @returns {string}  signed JWT
 */
export function generateSurveyToken(ticketId, closureNumber) {
  return jwt.sign(
    { ticketId, closureNumber, purpose: 'csat_survey' },
    getSecret(),
    { expiresIn: SURVEY_EXPIRY_SECONDS }
  );
}

/**
 * Validate a survey token and return its payload.
 * Throws ValidationError if invalid, expired, or wrong purpose.
 *
 * @param {string} token
 * @returns {{ ticketId: string, closureNumber: number }}
 */
export function validateSurveyToken(token) {
  if (!token) throw new ValidationError('Survey token is required');
  try {
    const payload = jwt.verify(token, getSecret());
    if (payload.purpose !== 'csat_survey') {
      throw new ValidationError('Invalid survey token');
    }
    return { ticketId: payload.ticketId, closureNumber: payload.closureNumber };
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('Survey token is invalid or has expired');
  }
}

/**
 * Record a CSAT survey response.
 * Rejects duplicate submissions for the same ticket × closure_number.
 *
 * @param {object} db
 * @param {{ ticketId, closureNumber, rating, comment }} params
 */
export function recordResponse(db, { ticketId, closureNumber, rating, comment }) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError('Rating must be an integer between 1 and 5');
  }
  const existing = db.prepare(
    'SELECT id FROM csat_response WHERE ticket_id = ? AND closure_number = ?'
  ).get(ticketId, closureNumber);
  if (existing) {
    throw new ValidationError('A CSAT response for this closure has already been submitted');
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO csat_response (id, ticket_id, closure_number, rating, comment, submitted_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, ticketId, closureNumber, rating, comment ?? null);
  return db.prepare('SELECT * FROM csat_response WHERE id = ?').get(id);
}

/**
 * Check whether CSAT surveys are globally enabled.
 */
export function isEnabled(db) {
  const config = getConfig(db);
  return config?.csat_enabled === 1;
}
