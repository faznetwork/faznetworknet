"use strict";

function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

function sessionUsername(session) {
  for (const candidate of [session?.username, session?.name, session?.user]) {
    const normalized = normalizeUsername(candidate);
    if (normalized) return normalized;
  }
  return "";
}

function createActiveSessionMap(sessions) {
  const map = new Map();
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const username = sessionUsername(session);
    if (username && !map.has(username)) map.set(username, session);
  }
  return map;
}

function findActiveSession(sessions, username) {
  const target = normalizeUsername(username);
  if (!target || !Array.isArray(sessions)) return null;
  return sessions.find(session => sessionUsername(session) === target) || null;
}

module.exports = { normalizeUsername, sessionUsername, createActiveSessionMap, findActiveSession };
