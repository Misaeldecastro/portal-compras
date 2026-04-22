import { WebClient } from "@slack/web-api";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function enviarMensagemParaUsuario(userId, texto) {
  if (!process.env.SLACK_BOT_TOKEN) {
    throw new Error("SLACK_BOT_TOKEN não configurado");
  }

  const conversa = await slack.conversations.open({
    users: userId,
  });

  const channelId = conversa.channel?.id;

  if (!channelId) {
    throw new Error("Não foi possível abrir conversa com o usuário");
  }

  const resposta = await slack.chat.postMessage({
    channel: channelId,
    text: texto,
  });

  return resposta;
}