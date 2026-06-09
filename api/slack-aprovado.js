function escaparSlack(texto) {
  return String(texto || "-")
    .trim()
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("`", "\\`");
}

export default async function handler(req, res) {
  const origemPermitida = 
    process.env.PORTAL_URL || "https://portal-compras-five.vercel.app";

  res.setHeader("Access-Control-Allow-Origin", origemPermitida);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const data = req.body || {};

    const linkPortal = process.env.PORTAL_URL;
    const compradorId = process.env.SLACK_COMPRADOR_USER_ID;

    if (!process.env.SLACK_BOT_TOKEN || !compradorId || !linkPortal) {
      return res.status(500).json({ error: "SLACK_BOT_TOKEN, SLACK_COMPRADOR_USER_ID ou PORTAL_URL não configurado" });
    }

    const linkProduto1 = data.linkProduto1 || data.link_produto_1;
    const linkProduto2 = data.linkProduto2 || data.link_produto_2;
    
    const link1 = linkProduto1 ? `<${linkProduto1}|abrir produto 1>` : "-";

    const link2 = linkProduto2 ? `<${linkProduto2}|abrir produto 2>` : "-";
    

    const mensagem =
      `*SOLICITAÇÃO APROVADA* \n\n` +
      `*Item:* ${escaparSlack(data.item)}\n` +
      `*Solicitante:* ${escaparSlack(data.solicitante)}\n` +
      `*Departamento:* ${escaparSlack(data.departamento)}\n` +
      `*Quantidade:* ${data.quantidade}\n` +
      `*Prioridade:* ${escaparSlack(data.prioridade)}\n` +
      `*Prazo:* ${data.data || "-"}\n` +
      `*Link do produto 1:* ${link1}\n`+
      `*Link do produto 2:* ${link2}\n`+
      `*Justificativa:* ${escaparSlack(data.justificativa) || "-"}\n`+
      `\n*portal de solicitações:* ${linkPortal}`;

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: compradorId,
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
