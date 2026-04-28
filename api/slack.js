import { enviarMensagemParaUsuario } from "./slack-utils.js";

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
    const {
      solicitante,
      departamento,
      item,
      quantidade,
      prioridade,
      justificativa,
      idSolicitacao,
      linkAnalise,
    } = req.body || {};

    const lucasId = process.env.SLACK_LUCAS_USER_ID;

    if (!lucasId) {
      return res.status(500).json({ error: "SLACK_LUCAS_USER_ID não configurado" });
    }

    const linkPortal = "https://portal-compras-five.vercel.app/";

    const mensagem =
      `*NOVA SOLICITAÇÃO DE COMPRAS*\n\n` +
      `*ID:* ${idSolicitacao || "-"}\n` +
      `*Justificativa / Descrição:* ${justificativa || "-"}\n` +
      `*Solicitante:* ${solicitante || "-"}\n` +
      `*Departamento:* ${departamento || "-"}\n` +
      `*Item:* ${item || "-"}\n` +
      `*Quantidade:* ${quantidade || "-"}\n` +
      `*Prioridade:* ${prioridade || "-"}\n` +
      `\n*Acessar portal de solicitações:* ${linkPortal}`;

    await enviarMensagemParaUsuario(lucasId, mensagem);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar para o Lucas:", error);
    return res.status(500).json({
      error: "Erro interno",
      details: error.message,
    });
  }
}