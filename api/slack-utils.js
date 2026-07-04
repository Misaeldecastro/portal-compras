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

export async function buscarUsuarioSlackPorEmail(email) {
  if (!process.env.SLACK_BOT_TOKEN) {
    throw new Error("SLACK_BOT_TOKEN não configurado");
  }

  const resposta = await slack.users.lookupByEmail({
    email,
  });

  const userId = resposta.user?.id;

  if (!userId) {
    throw new Error("Usuário do Slack não encontrado pelo e-mail");
  }

  return userId;
}

export async function enviarMensagemParaEmail(email, texto) {
  const userId = await buscarUsuarioSlackPorEmail(email);
  return enviarMensagemParaUsuario(userId, texto);
}

export async function enviarMensagemParaEmails(emails, texto) {
  return Promise.all(
    emails
      .filter(Boolean)
      .map((email) => enviarMensagemParaEmail(email, texto))
  );
}
