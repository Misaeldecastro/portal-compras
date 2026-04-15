export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    console.log("API /api/slack foi chamada");
    console.log("BODY RECEBIDO:", req.body);
    console.log("WEBHOOK CONFIGURADO?", !!process.env.SLACK_WEBHOOK_URL);

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
      idSolicitacao,
      linkAnalise,
    } = req.body || {};

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(500).json({ error: "SLACK_WEBHOOK_URL não configurada" });
    }

    const mensagem =
      `*NOVA SOLICITAÇÃO DE COMPRAS*\n\n` +
      `*ID:* ${idSolicitacao || "-"}\n` +
      `*Justificativa / Descrição:* ${justificativa || "-"}\n` +
      `*Solicitante:* ${solicitante || "-"}\n` +
      `*Departamento:* ${departamento || "-"}\n` +
      `*Item:* ${item || "-"}\n` +
      `*Quantidade:* ${quantidade || "-"}\n` +
      `*Prioridade:* ${prioridade || "-"}\n` +
      `\n*Analisar no portal:* ${linkAnalise || "-"}`;

    const slackResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: mensagem }),
    });

    if (!slackResponse.ok) {
      const erroTexto = await slackResponse.text();
      console.error("Erro retornado pelo Slack:", erroTexto);

      return res.status(500).json({
        error: "Erro ao enviar mensagem para o Slack",
        details: erroTexto,
      });
    }

    console.log("Mensagem enviada com sucesso ao Slack");
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("ERRO NA API /api/slack:", error);

    return res.status(500).json({
      error: "Erro interno",
      details: error.message,
    });
  }
}