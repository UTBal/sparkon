import * as fs from 'firebase/firestore';
export const ctx = { cur: null };
export async function whenReady() {}
export function getDb() { return ctx.cur.db; }
export function fsMod() { return fs; }
export function getAuth() { return ctx.cur.auth; }
export async function ensureSignedIn() { return ctx.cur.auth.currentUser; }
