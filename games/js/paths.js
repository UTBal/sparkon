/**
 * Firestore path isolation — NEVER touch users/{uid}/notes (Whiteboard).
 *
 * Rooms / codes: top-level sparkon* collections (require rules deploy).
 * Collection: try sparkonUsers/{uid}/… first; fallback users/{uid}/sparkon/…
 * (Alex may allow either in rules — see firestore.rules.snippet + STAGING.md).
 */
export const USERS = 'sparkonUsers';
export const USER_SPARKON = 'sparkon'; // under users/{uid}/sparkon
export const ROOMS = 'sparkonRooms';
export const CODES = 'sparkonCodes';
export const DISPLAY_CODES = 'sparkonDisplayCodes';
