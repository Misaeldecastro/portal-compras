export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const data = req.body;

    const link1 = data.linkProduto1 ? `<${data.linkProduto1}|abrir produto 1>` : "-";
    const link2 = data.linkProduto2 ? `<${data.linkProduto2}>|abrir produto 2>` : "-";

    const mensagem =
      `*SOLICITAÇÃO APROVADA* \n\n` +
      `*Item:* ${data.item}\n` +
      `*Solicitante:* ${data.solicitante}\n` +
      `*Departamento:* ${data.departamento}\n` +
      `*Quantidade:* ${data.quantidade}\n` +
      `*Prioridade:* ${data.prioridade}\n` +
      `*Prazo:* ${data.data || "-"}\n` +
      `*Link do produto 1:* ${link1}\n`+
      `*Link do produto 2:* ${link2}\n`+
      `*Justificativa:* ${data.justificativa || "-"}\n`
      `\n*portal de solicitações:* ${linkPortal}`;

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