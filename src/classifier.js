const { normalizeTitle } = require('./utils');

const ACTIONS = Object.freeze({
  KEEP: 'KEEP',
  DELETE_CANDIDATE: 'DELETE_CANDIDATE',
});

function prepareKeepList(keepList) {
  return {
    conversationIds: new Set(keepList.conversationIds.map((id) => String(id).trim().toLocaleLowerCase())),
    exactTitles: new Set(keepList.exactTitles.map(normalizeTitle)),
    titlePrefixes: keepList.titlePrefixes.map(normalizeTitle),
  };
}

function classifyConversation(conversation, keepList) {
  const prepared = keepList.conversationIds instanceof Set ? keepList : prepareKeepList(keepList);
  const id = String(conversation.id ?? '').trim().toLocaleLowerCase();
  const title = normalizeTitle(conversation.title);

  let matchedBy = null;
  if (id && prepared.conversationIds.has(id)) matchedBy = 'conversationId';
  else if (prepared.exactTitles.has(title)) matchedBy = 'exactTitle';
  else if (prepared.titlePrefixes.some((prefix) => prefix && title.startsWith(prefix))) matchedBy = 'titlePrefix';

  return {
    ...conversation,
    action: matchedBy ? ACTIONS.KEEP : ACTIONS.DELETE_CANDIDATE,
    ...(matchedBy ? { matchedBy } : {}),
  };
}

function classifyConversations(conversations, keepList) {
  const prepared = prepareKeepList(keepList);
  return conversations.map((conversation) => classifyConversation(conversation, prepared));
}

module.exports = { ACTIONS, classifyConversation, classifyConversations, prepareKeepList };
