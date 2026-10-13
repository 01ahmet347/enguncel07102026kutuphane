import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

test('Firestore rules grant global access only to the active admin session', () => {
  assert.match(rules, /function hasAdminClaim\(\)[\s\S]*?request\.auth\.token\.admin == true/);
  assert.match(rules, /function isActiveAdmin\(appId\)[\s\S]*?adminSessionId[\s\S]*?sgmAdminSessions\/current/);
  assert.match(rules, /match \/artifacts\/\{appId\}\/public\/data\/sgmUsers\/\{documentId\}[\s\S]*?allow list: if isActiveAdmin\(appId\);[\s\S]*?allow write: if isActiveAdmin\(appId\);/);
  assert.match(rules, /match \/artifacts\/\{appId\}\/public\/data\/\{collection\}\/\{documentId\}[\s\S]*?allow read, write: if isActiveAdmin\(appId\);/);
});

test('student Firestore access is bound to the matching UID and does not grant writes', () => {
  assert.match(rules, /function isStudent\(userId\)[\s\S]*?request\.auth\.token\.role == 'student'[\s\S]*?request\.auth\.uid == userId/);
  assert.match(rules, /match \/artifacts\/\{appId\}\/public\/data\/sgmUsers\/\{documentId\}[\s\S]*?allow get: if isActiveAdmin\(appId\) \|\| isStudent\(documentId\);[\s\S]*?allow list: if isActiveAdmin\(appId\);[\s\S]*?allow write: if isActiveAdmin\(appId\);/);
  assert.match(rules, /match \/artifacts\/\{appId\}\/public\/data\/sgmMessages\/\{documentId\}[\s\S]*?allow get: if isActiveAdmin\(appId\) \|\| isStudent\(documentId\);[\s\S]*?allow write: if isActiveAdmin\(appId\);/);
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]*?allow read, write: if false;/);
  assert.doesNotMatch(rules, /allow read, write: if request\.auth != null/);
});
