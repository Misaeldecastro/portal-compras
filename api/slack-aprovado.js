export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const data = req.body;

    const mensagem =
      `*SOLICITAÇÃO APROVADA* ✅\n\n` +
      `*Item:* ${data.item}\n` +
      `*Solicitante:* ${data.solicitante}\n` +
      `*Departamento:* ${data.departamento}\n` +
      `*Quantidade:* ${data.quantidade}\n` +
      `*Prioridade:* ${data.prioridade}\n` +
      `*Data:* ${data.data || "-"}\n` +
      `*Justificativa:* ${data.justificativa || "-"}\n`;

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: "U0A7NH920UU", //meu id
        text: mensagem,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      return res.status(500).json({ error: result.error });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}