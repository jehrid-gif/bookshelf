// Thin wrapper over Resend's REST API — a plain fetch call rather than their
// SDK, consistent with how the rest of this app talks to third-party APIs
// (see googleBooks.ts). Needs RESEND_API_KEY set in the environment.
export async function sendEmailWithAttachment(opts: {
  to: string;
  from: string;
  subject: string;
  text: string;
  filename: string;
  content: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      attachments: [
        {
          filename: opts.filename,
          content: Buffer.from(opts.content, "utf-8").toString("base64"),
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body.slice(0, 300)}`);
  }
}
