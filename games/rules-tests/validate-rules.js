#!/usr/bin/env node
/**
 * Static validation for games/firestore.rules.merged (no emulator required).
 * Exit 0 if structure + required markers look sane.
 */
const fs = require('fs');
const path = require('path');

const mergedPath = path.join(__dirname, '..', 'firestore.rules.merged');
const snippetPath = path.join(__dirname, '..', 'firestore.rules.snippet');
const merged = fs.readFileSync(mergedPath, 'utf8');
const snippet = fs.readFileSync(snippetPath, 'utf8');
const errors = [];

function must(cond, msg) { if (!cond) errors.push(msg); }

must(merged.includes("rules_version = '2'"), 'merged: rules_version');
must(merged.includes('service cloud.firestore'), 'merged: service');
must(merged.includes('match /users/{userId}/notes/{noteId}'), 'merged: Whiteboard notes keep');
must(
  /match \/users\/\{userId\}\/notes\/\{noteId\}[\s\S]*?allow read, write: if request\.auth != null && request\.auth\.uid == userId/.test(merged),
  'merged: notes self-only'
);
must(merged.includes('match /sparkonRooms/{roomId}'), 'merged: sparkonRooms');
must(merged.includes('match /sparkonCodes/{code}'), 'merged: sparkonCodes');
must(merged.includes('match /sparkonDisplayCodes/{code}'), 'merged: sparkonDisplayCodes');
must(merged.includes('match /sparkonUsers/{uid}'), 'merged: sparkonUsers');
must(merged.includes("function signedIn()"), 'merged: signedIn');
must(merged.includes('resource.data.hostUid == request.auth.uid'), 'merged: host-only room update');
must(merged.includes("request.auth.uid == memberId"), 'merged: self member create');
must(merged.includes("request.resource.data.locked == true"), 'merged: locked answers');
must(merged.includes("phase in ['reveal', 'scores', 'finished']"), 'merged: reveal-gated reads');
must(merged.includes("edition in ['basic', 'standard', 'premium', 'hero']"), 'merged: standard edition');
must(!merged.includes('allow update: if true'), 'merged: no open update:if true');
must(!merged.includes('allow create: if true'), 'merged: no open create:if true');
must(!merged.includes('allow read: if true; // pilot'), 'merged: rooms not world-readable');

must(snippet.includes('match /sparkonRooms/{roomId}'), 'snippet: sparkonRooms');
must(snippet.includes('function signedIn()'), 'snippet: signedIn');
must(!snippet.includes("rules_version"), 'snippet: section only (no rules_version wrapper)');
must(snippet.includes('hostUid == request.auth.uid'), 'snippet: hostUid check');

// brace balance (approx)
function balance(s) {
  let n = 0;
  for (const ch of s) {
    if (ch === '{') n++;
    if (ch === '}') n--;
    if (n < 0) return false;
  }
  return n === 0;
}
must(balance(merged.replace(/\/\/.*/g, '')), 'merged: balanced braces');

if (errors.length) {
  console.error('FAIL:', errors.length, 'issue(s)');
  errors.forEach(e => console.error(' -', e));
  process.exit(1);
}
console.log('OK: firestore.rules.merged + snippet static checks passed');
console.log('NOTE: emulator unit tests blocked without Java on this box — see firestore.rules.test.md');
