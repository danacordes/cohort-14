import { ValidationError, ForbiddenError } from '../errors/index.js';

/**
 * Valid status transition graph.
 * Key: fromStatus code → Set of allowed toStatus codes.
 */
const TRANSITIONS = {
  OPEN: new Set(['IN_PROGRESS']),
  IN_PROGRESS: new Set(['PENDING_USER_RESPONSE', 'RESOLVED']),
  PENDING_USER_RESPONSE: new Set(['IN_PROGRESS']),
  RESOLVED: new Set(['CLOSED', 'OPEN']),
  CLOSED: new Set(['OPEN']),
};

/**
 * Roles allowed to drive each target status.
 * Reopen (→ OPEN from RESOLVED/CLOSED) is additionally allowed for 'user'.
 */
const ROLE_PERMISSIONS = {
  IN_PROGRESS: new Set(['agent', 'admin']),
  PENDING_USER_RESPONSE: new Set(['agent', 'admin']),
  RESOLVED: new Set(['agent', 'admin']),
  CLOSED: new Set(['agent', 'admin']),
  OPEN: new Set(['user', 'agent', 'admin']),
};

/**
 * Assert that a status transition is both valid and permitted for the given role.
 * Throws ValidationError or ForbiddenError on failure.
 *
 * @param {string} fromStatus  current status code
 * @param {string} toStatus    requested status code
 * @param {string} role        requesting user's role
 */
export function assertTransitionAllowed(fromStatus, toStatus, role) {
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed || !allowed.has(toStatus)) {
    throw new ValidationError(
      `Invalid status transition: ${fromStatus} → ${toStatus}`
    );
  }

  const permittedRoles = ROLE_PERMISSIONS[toStatus];
  if (!permittedRoles || !permittedRoles.has(role)) {
    throw new ForbiddenError(
      `Role '${role}' is not permitted to set status to ${toStatus}`
    );
  }
}

/**
 * Statuses that are considered "terminal" for reopening checks.
 */
export const REOPEN_ELIGIBLE = new Set(['RESOLVED', 'CLOSED']);
