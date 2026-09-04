import { enviarMensagemParaEmails, enviarMensagemParaUsuario } from "./slack-utils.js";
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
      solicitante,
      departamento,
      item,
      justificativa,
      destinatariosEmails = [],
    } = req.body || {};

    const aprovadorId = process.env.SLACK_APROVADOR_USER_ID;
    const linkPortal = PORTAL_URL;
    const emailsAprovadores = Array.isArray(destinatariosEmails)
      ? destinatariosEmails.filter(Boolean)
      : [];

    if (!process.env.SLACK_BOT_TOKEN || (!emailsAprovadores.length && !aprovadorId)) {
      return res.status(500).json({
        error: "SLACK_BOT_TOKEN ou aprovadores por e-mail/SLACK_APROVADOR_USER_ID não configurado",
      });
    }

  const mensagem =
  `*NOVA SOLICITAÇÃO DE COMPRAS*\n\n` +
  `*Justificativa / Descrição:* ${escaparSlack(justificativa)}\n` +
  `*Solicitante:* ${escaparSlack(solicitante)}\n` +
  `*Departamento:* ${escaparSlack(departamento)}\n` +
  `*Item:* ${escaparSlack(item)}\n` +
  `\n*Acessar portal de solicitações:* ${linkPortal}`;

    if (emailsAprovadores.length) {
      await enviarMensagemParaEmails(emailsAprovadores, mensagem);
    } else {
      await enviarMensagemParaUsuario(aprovadorId, mensagem);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar para o Aprovador:", error);
    return res.status(500).json({
      error: "Erro interno",
      details: error.message,
    });
  }
}
