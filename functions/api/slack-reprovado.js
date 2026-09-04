import { enviarMensagemParaUsuario, obterClienteSlack } from "./slack-utils.js";
import { aplicarCors, PORTAL_URL } from "./http.js";
import { exigirAutenticacao } from "./auth.js";

function escaparSlack(texto) {
  return String(texto || "-")
    .trim()
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("`", "\\`");
}

export default async function handler(req, res) {
  aplicarCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!(await exigirAutenticacao(req, res))) return;

  try {
    const {
      idSolicitacao,
      item,
      solicitante,
      userEmail,
      motivoReprovacao,
    } = req.body || {};

    const linkPortal = PORTAL_URL;

    if (!process.env.SLACK_BOT_TOKEN) {
      return res.status(500).json({
        error: "SLACK_BOT_TOKEN não configurado",
      });
    }

    if (!userEmail) {
      return res.status(400).json({
        error: "E-mail do solicitante não informado",
      });
    }

    const slack = obterClienteSlack();

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

    const mensagem =
      `*SUA SOLICITAÇÃO FOI REPROVADA!*\n\n` +
      `*Item:* ${escaparSlack(item)}\n` +
      `*Solicitante:* ${escaparSlack(solicitante)}\n` +
      `*Motivo:* ${escaparSlack(motivoReprovacao || "-")}\n` +
      `*Acessar solicitação:* ${linkSolicitacao}`;

    await enviarMensagemParaUsuario(slackUserId, mensagem);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar reprovação para o Slack:", error);

    return res.status(500).json({
      error: "Erro interno",
      details: error.message,
    });
  }
}
