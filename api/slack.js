export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const {
      solicitante,
      departamento,
      centroCusto,
      item,
      quantidade,
      valor,
      urgencia,
      fornecedor,
      linkProduto,
      prazoNecessario,
      justificativa,
      observacoes,
      usuarioEmail,
    } = req.body || {};

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(500).json({ error: "SLACK_WEBHOOK_URL não configurada" });
    }

    const mensagem =
      `📦 *Nova solicitação de compra*\n` +
      `👤 *Usuário:* ${usuarioEmail || "-"}\n` +
      `📝 *Solicitante:* ${solicitante || "-"}\n` +
      `🏢 *Departamento:* ${departamento || "-"}\n` +
      `💰 *Centro de custo:* ${centroCusto || "-"}\n` +
      `🛒 *Item:* ${item || "-"}\n` +
      `🔢 *Quantidade:* ${quantidade || "-"}\n` +
      `💵 *Valor:* R$ ${valor || "-"}\n` +
      `⚡ *Urgência:* ${urgencia || "-"}\n` +
      `🏪 *Fornecedor:* ${fornecedor || "-"}\n` +
      `🔗 *Link do produto:* ${linkProduto || "-"}\n` +
      `📅 *Prazo necessário:* ${prazoNecessario || "-"}\n` +
      `📄 *Justificativa:* ${justificativa || "-"}\n` +
      `🗒️ *Observações:* ${observacoes || "-"}`;

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