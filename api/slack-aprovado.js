import { enviarMensagemParaEmails, enviarMensagemParaUsuario } from "./slack-utils.js";

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
    const compradorEmails = Array.isArray(data.destinatariosEmails)
      ? data.destinatariosEmails.filter(Boolean)
      : [];

    if (!process.env.SLACK_BOT_TOKEN || (!compradorEmails.length && !compradorId) || !linkPortal) {
      return res.status(500).json({
        error: "SLACK_BOT_TOKEN, compradores por e-mail/SLACK_COMPRADOR_USER_ID ou PORTAL_URL não configurado",
      });
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
      `*Justificativa:* ${escaparSlack(data.justificativa)}\n`+
      `\n*portal de solicitações:* ${linkPortal}`;

    if (compradorEmails.length) {
      await enviarMensagemParaEmails(compradorEmails, mensagem);
    } else {
      await enviarMensagemParaUsuario(compradorId, mensagem);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
