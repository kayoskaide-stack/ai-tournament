# Brain Trust panel rounds

In **FREE AI POWER** mode, a normal question goes to each selected free model
in a separate request. The first successful model answers; later models see
the actual answers and either add useful content or explicitly report that
they reviewed them with nothing further to add. Every response identifies the
API-returned model. Genuine plain text is accepted as an answer when a model ignores the JSON envelope; it is never inferred to be a review. Broken JSON is retried. Timeouts, quota failures, and persistently malformed results are shown
as unavailable, never as reviews or agreement.

Click **ANOTHER ANGLE?**, or ask “Does anyone have another angle?” or “Anything
else?” after a round. This makes a new request to every currently selected
model with the original question and earlier actual answers. Models should
seek an overlooked angle without inventing disagreement or repeating content.
The previous round is held in memory for the current page and channel;
reloading the page clears that follow-up context.

The roster shows waiting/thinking, answered, reviewed, or unavailable. Select
up to four models in **BRAINS / ROSTER**. Retired saved selections are removed;
an empty selection after discovery is repopulated with up to three distinct
families, preferring previously verified models still in the live catalog.
Old health results are historical checks, not a promise of current availability.

Inference remains restricted to the live zero-price OpenRouter catalog with
zero maximum prompt/completion prices. Each follow-up consumes new requests
from the shared account quota. The system does not run continual review loops.
Native providers, including Mistral and DeepSeek, retain their existing routing;
they are not relabelled as the free models and are not claimed to be free or
working merely because a key exists. OpenRouter is the routing service, not
an additional independent AI.

Validation: `node --test tests/free-power.test.mjs tests/seat-reply.test.mjs
tests/panel-review.test.mjs tests/panel-flow.test.cjs tests/chat-face.test.cjs
tests/channel-log.test.cjs`. API responses in these tests are simulated;
they check real dispatch logic and failure handling, not live provider capacity.

Free requests allow 2,048 output tokens, then one retry with up to 4,096,
respecting the catalog output limit. Optional reasoning is disabled for models
advertising that parameter. Empty, reasoning-only, truncated and malformed
results get at most one retry to the same selected model under a 38-second
inference deadline. Quota and billing errors are not retried. Thinking fields
are never displayed as final answers. Each retry uses the same zero-price gate
and consumes shared free quota; no paid model is substituted.
