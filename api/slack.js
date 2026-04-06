export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const {
        solicitante,
        departamento,
        item,
        quantidade,
        prioridade,
        linkProduto1,
        linkProduto2,
        data,
        justificativa,
        } = req.body || {};

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(500).json({ error: "SLACK_WEBHOOK_URL não configurada" });
    }

    const mensagem =
       `📦 *Nova solicitação de compra*\n` +
       `📝 *Solicitante:* ${solicitante || "-"}\n` +
       `🏢 *Departamento:* ${departamento || "-"}\n` +
       `🛒 *Item:* ${item || "-"}\n` +
       `🔢 *Quantidade:* ${quantidade || "-"}\n` +
       `⚡ *Prioridade:* ${prioridade || "-"}\n` +
       `🔗 *Link do produto 1:* ${linkProduto1 || "-"}\n` +
       `🔗 *Link do produto 2:* ${linkProduto2 || "-"}\n` +
       `📅 *Data:* ${data || "-"}\n` +
       `📄 *Justificativa:* ${justificativa || "-"}`;

    const slackResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: mensagem }),
    });

    if (!slackResponse.ok) {
      const erroTexto = await slackResponse.text();
      return res.status(500).json({
        error: "Erro ao enviar mensagem para o Slack",
        details: erroTexto,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: "Erro interno",
      details: error.message,
    });
  }
}