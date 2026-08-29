import { WebClient } from "@slack/web-api";
import { enviarMensagemParaUsuario } from "./slack-utils.js";

function escaparSlack(texto) {
  return String(texto || "-")
    .trim()
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("`", "\\`");
}

function montarMensagem({ status, item, solicitante, linkSolicitacao }) {
  const mensagens = {
    Pendente:
      "Sua solicitação foi enviada para o aprovador e agora está pendente. Aguarde a aprovação.",
    Aprovada:
      "Sua solicitação foi aprovada e agora seguirá para compra.",
    Comprado:
      "Sua solicitação foi marcada como comprada.",
  };

  const textoStatus = mensagens[status] || `Sua solicitação está com status: ${status}.`;

  return (
    `*ATUALIZAÇÃO DA SUA SOLICITAÇÃO*\n\n` +
    `${textoStatus}\n\n` +
    `*Status:* ${escaparSlack(status)}\n` +
    `*Item:* ${escaparSlack(item)}\n` +
    `*Solicitante:* ${escaparSlack(solicitante)}\n` +
    `*Acessar solicitação:* ${linkSolicitacao}`
  );
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
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const {
      idSolicitacao,
      item,
      solicitante,
      userEmail,
      status,
    } = req.body || {};

    const linkPortal = process.env.PORTAL_URL;

    if (!process.env.SLACK_BOT_TOKEN || !linkPortal) {
      return res.status(500).json({
        error: "SLACK_BOT_TOKEN ou PORTAL_URL não configurado",
      });
    }

    if (!userEmail) {
      return res.status(400).json({
        error: "E-mail do solicitante não informado",
      });
    }

    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

    const usuarioSlack = await slack.users.lookupByEmail({
      email: userEmail,
    });

    const slackUserId = usuarioSlack.user?.id;

    if (!slackUserId) {
      return res.status(404).json({
        error: "Usuário do Slack não encontrado",
      });
    }

    const linkSolicitacao = `${linkPortal}/solicitacao/${idSolicitacao}`;
    const mensagem = montarMensagem({
      status,
      item,
      solicitante,
      linkSolicitacao,
    });

    await enviarMensagemParaUsuario(slackUserId, mensagem);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar atualização para o solicitante:", error);

    return res.status(500).json({
      error: "Erro interno",
      details: error.message,
    });
  }
}
