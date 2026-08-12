function wavFromPcm(pcm, rate = 24000) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8); header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error:"POST only"});
  const provider = String(req.body?.provider || "");
  const text = String(req.body?.text || "").trim().slice(0, 4000);
  if (!text) return res.status(400).json({error:"No text to speak"});
  try {
    if (provider === "openai") {
      if (!process.env.OPENAI_API_KEY) throw Error("OPENAI_API_KEY is not configured");
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method:"POST", headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
        body:JSON.stringify({model:"gpt-4o-mini-tts",voice:"marin",input:text,response_format:"mp3",instructions:"Warm, confident, playful, intimate radio-host delivery. Natural pace and clear Canadian-friendly English."})
      });
      if (!r.ok) throw Error(`OpenAI voice HTTP ${r.status}: ${(await r.text()).slice(0,240)}`);
      return res.status(200).json({mime:"audio/mpeg",audio:Buffer.from(await r.arrayBuffer()).toString("base64")});
    }
    if (provider === "gemini") {
      if (!process.env.GEMINI_API_KEY) throw Error("GEMINI_API_KEY is not configured");
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:[{parts:[{text:`Read exactly this text in a natural, witty English male radio-presenter voice, as though recently back from England. Do not add words.\n\n${text}`}]}],generationConfig:{responseModalities:["AUDIO"],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:"Algenib"}}}}})
      });
      const data = await r.json();
      if (!r.ok) throw Error(`Gemini voice HTTP ${r.status}: ${JSON.stringify(data).slice(0,240)}`);
      const raw = data?.candidates?.[0]?.content?.parts?.find(p=>p.inlineData)?.inlineData?.data;
      if (!raw) throw Error("Gemini returned no audio");
      const wav = wavFromPcm(Buffer.from(raw,"base64"));
      return res.status(200).json({mime:"audio/wav",audio:wav.toString("base64")});
    }
    return res.status(400).json({error:"Unknown voice provider"});
  } catch (e) { return res.status(500).json({error:e.message||String(e)}); }
}
