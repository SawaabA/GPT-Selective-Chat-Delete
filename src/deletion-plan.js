function normalizeId(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function idSet(conversations) {
  return new Set(conversations.map(({ id }) => normalizeId(id)).filter(Boolean));
}

function sameIds(left, right) {
  if (left.size !== right.size) return false;
  return [...left].every((id) => right.has(id));
}

function createDeletionPlan(previousConversations, freshConversations, requestedKeepIds, expectedCount) {
  if (!Array.isArray(previousConversations) || !Array.isArray(freshConversations)) {
    throw new Error('Deletion planning requires two complete conversation scans.');
  }
  if (!Array.isArray(requestedKeepIds)) throw new Error('Invalid keep selection.');
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) throw new Error('Invalid deletion candidate count.');

  const previousIds = idSet(previousConversations);
  const freshIds = idSet(freshConversations);
  if (previousIds.size !== previousConversations.length || freshIds.size !== freshConversations.length) {
    throw new Error('At least one conversation has no stable ID. Nothing was deleted.');
  }
  if (!sameIds(previousIds, freshIds)) {
    throw new Error('The conversation list changed after the dashboard scan. Nothing was deleted; review a new scan.');
  }

  const keepIds = new Set(requestedKeepIds.map(normalizeId));
  if ([...keepIds].some((id) => !id || !previousIds.has(id))) {
    throw new Error('The keep selection contains an unknown conversation ID. Nothing was deleted.');
  }

  const candidates = freshConversations.filter(({ id }) => !keepIds.has(normalizeId(id)));
  if (candidates.length !== expectedCount) {
    throw new Error(`The fresh scan found ${candidates.length} candidates, but the dashboard showed ${expectedCount}. Nothing was deleted; review a new scan.`);
  }
  return candidates;
}

module.exports = { createDeletionPlan, idSet, normalizeId, sameIds };
