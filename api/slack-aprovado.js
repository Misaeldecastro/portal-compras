import { enviarMensagemParaUsuario } from "./slack-utils";

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
      justificativa,
      idSolicitacao,
      link_produto_1,
      link_produto_2,
      data,
    } = req.body || {};

    const joaoId = process.env.SLACK_JOAO_USER_ID;

    if (!joaoId) {
      return res.status(500).json({ error: "SLACK_JOAO_USER_ID não configurado" });
    }

    const mensagem =
      `*✅ SOLICITAÇÃO APROVADA*\n\n` +
      `*ID:* ${idSolicitacao || "-"}\n` +
      `*Justificativa / Descrição:* ${justificativa || "-"}\n` +
      `*Solicitante:* ${solicitante || "-"}\n` +
      `*Departamento:* ${departamento || "-"}\n` +
      `*Item:* ${item || "-"}\n` +
      `*Quantidade:* ${quantidade || "-"}\n` +
      `*Prioridade:* ${prioridade || "-"}\n` +
      `*Link do produto 1:* ${link_produto_1 || "-"}\n` +
      `*Link do produto 2:* ${link_produto_2 || "-"}\n` +
      `*Prazo:* ${data || "-"}\n\n` +
      `_Aprovado por Lucas_`;

    await enviarMensagemParaUsuario(joaoId, mensagem);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar para o João:", error);
    return res.status(500).json({
      error: "Erro interno",
      details: error.message,
    });
  }
}