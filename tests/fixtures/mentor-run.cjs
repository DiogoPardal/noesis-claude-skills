// Synthetic mentor_get_run payloads. Shapes follow what the filter handles; contents are made up.
function runDocument({ runId = 'run-synthetic-1', status = 'running' } = {}) {
  return {
    runId,
    status,
    events: [
      { MsgType: 'text', text: 'Creating the ' },
      { MsgType: 'text', text: 'Customer entity.' },
      { MsgType: 'reasoning', title: 'Planning the data model', text: 'Long internal reasoning. '.repeat(40) },
      { MsgType: 'status', statusType: 'Building', details: 'Detailed status payload. '.repeat(20) },
      { MsgType: 'toolCall', name: 'create_entity', args: { name: 'Customer' } },
      JSON.stringify({ MsgType: 'text', text: 'Done with step one.' }),
    ],
  };
}

// The same document twice, as the Mentor API can return when paging.
function runText(options) {
  const doc = runDocument(options);
  return `${JSON.stringify(doc)}\n${JSON.stringify(doc)}`;
}

function postToolUseEvent(toolResponse, { toolName = 'mcp__outsystems__mentor_get_run', runId = 'run-synthetic-1' } = {}) {
  return {
    session_id: 'session-synthetic',
    hook_event_name: 'PostToolUse',
    tool_name: toolName,
    tool_input: { runId },
    tool_response: toolResponse,
  };
}

function preToolUseEvent({ toolName = 'mcp__outsystems__mentor_get_run', toolInput = { runId: 'run-synthetic-1' } } = {}) {
  return { session_id: 'session-synthetic', hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: toolInput };
}

module.exports = { runDocument, runText, postToolUseEvent, preToolUseEvent };
