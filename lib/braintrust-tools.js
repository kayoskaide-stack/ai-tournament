
export const BRAINTRUST_TOOLS = Object.freeze({
  catfish: { command: "!catfish", description: "Legacy PrincessGPT Catfish public-profile research tool, executed only on the trusted relay host." },
  hunt: { command: "!hunt", description: "Legacy PrincessGPT HUNT utility, executed only on the trusted relay host." },
  ascii: { command: "!ascii", description: "ASCII / ANSI / banner utilities on the trusted relay host." },
  upload: { command: "!upload", description: "Attach an image or a small text file from the browser." },
  camera: { command: "!camera", description: "Capture an image with a supported phone camera and attach it to the next AI turn." },
  dcc: { command: "/dcc", description: "Owner-only IRC DCC SEND from an allow-listed path on the relay host." },
  irc: { command: "/msg", description: "Authenticated IRC private messaging and relay presence/status." }
});

export function toolAwarenessPrompt() {
  return [
    "Brain Trust server/client tools are available:",
    ...Object.entries(BRAINTRUST_TOOLS).map(([name, v]) => `- ${name}: ${v.description}`),
    "Do not pretend a tool ran. Tool execution happens only through the Brain Trust client/relay."
  ].join("\n");
}
