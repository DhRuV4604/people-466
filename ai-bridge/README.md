# AI bridge

Runs the Claude CLI on the host and answers over HTTP, so the containerised API
can use it.

## Why it exists

The CLI is signed in as a person, not with an API key. There is nothing for a
container to authenticate with, and putting a personal session inside an image
would be worse than the problem it solved. So the CLI stays on the host, this
process wraps it, and the API reaches back out through
`host.docker.internal`.

It is deliberately tiny and has no dependencies. It holds someone's Claude
session; the less of it there is, the less there is to get wrong.

## Running it

```bash
cd ai-bridge
AI_CLI_PATH="C:/Users/you/AppData/Roaming/Claude/claude-code/2.1.260/claude.exe" \
AI_BRIDGE_TOKEN="a-long-random-string" \
node server.mjs
```

Then point the API at it, in the `.env` beside `docker-compose.yml`:

```
AI_BRIDGE_URL="http://host.docker.internal:4100"
AI_BRIDGE_TOKEN="the same long random string"
```

Leave `AI_BRIDGE_URL` empty and the AI features say they are not set up, rather
than failing on a refused connection.

| Variable | Default | |
|---|---|---|
| `AI_BRIDGE_PORT` | `4100` | |
| `AI_CLI_PATH` | `claude` | Full path if it is not on `PATH`. |
| `AI_MODEL` | `claude-sonnet-5` | |
| `AI_BRIDGE_TOKEN` | empty | **Set it.** Anything that can reach the port can spend money on your Claude account. |
| `AI_TIMEOUT_MS` | `120000` | |

## Endpoints

`GET /health` — open, so you can see it is up.

Everything else needs `x-bridge-token` and is a `POST`:

- `/draft` — `{ kind, employee, company, notes? }` → `{ title, body, costUsd }`
- `/extract` — `{ text }` → `{ title, kind, personName, needsSignature, summary, costUsd }`

## Things worth knowing

**It replaces the CLI's system prompt rather than appending to it.** Claude
Code's default prompt describes a coding agent with a toolbelt, which is
neither wanted here nor cheap — about 35k tokens of cache creation on every
call. Replacing it took a generated letter from $0.14 to $0.056.

**Prompt injection is assumed, not hoped against.** Everything reaching this
service can carry text someone else wrote: the body of an uploaded PDF, a
message an employee typed. It is fenced in tags and the model is told the
fence means data. Tested with a document that opens
`IGNORE ALL PREVIOUS INSTRUCTIONS` — it filed it as a policy document and said
in the summary that it had ignored an injection attempt.

That is a mitigation, not a guarantee, which is why the API treats every answer
as a suggestion. A generated document is filed as a **draft** for a person to
read, and an extraction only fills in a form somebody then confirms. Nothing
the model says reaches an employee without a human in between.

**The prompt is written to stdin and the arguments are an argv array.** Never a
shell string: the input is user-influenced and a shell would give it a second
meaning.
