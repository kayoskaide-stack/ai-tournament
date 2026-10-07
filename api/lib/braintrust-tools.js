export const BRAINTRUST_TOOLS = Object.freeze({
  catfish: {
    command: "!catfish",
    description: "Legacy PrincessGPT Catfish tool. Runs only through the server-side tool bridge."
  },
  hunt: {
    command: "!hunt",
    description: "Legacy PrincessGPT HUNT tool. Runs only through the server-side tool bridge."
  },
  ascii: {
    command: "!ascii",
    description: "ASCII / ANSI / banner utilities."
  },
  upload: {
    description: "User file upload for model/tool context."
  },
  camera: {
    description: "Camera image capture/upload from supported clients."
  },
  dcc: {
    description: "IRC DCC SEND initiation from the relay host when explicitly requested."
  },
  irc: {
    description: "IRC channel, private-message and presence/status capabilities."
  }
});

export function toolAwarenessPrompt() {
  return [
    "Brain Trust tools available:",
    ...Object.entries(BRAINTRUST_TOOLS).map(([name, v]) => `- ${name}: ${v.description}`)
  ].join("\n");
}
