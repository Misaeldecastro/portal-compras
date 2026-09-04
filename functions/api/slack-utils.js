import { WebClient } from "@slack/web-api";

let clienteSlack;

// Criado sob demanda, não no carregamento do módulo. O token vem do Secret
// Manager e só existe depois que o runtime monta os secrets; construir o
// WebClient no import faria um binding ausente virar um cliente com token
// undefined — permanente e silencioso, já que o erro só apareceria como
// falha de autenticação lá no Slack.
export function obterClienteSlack() {
  const token = process.env.SLACK_BOT_TOKEN;

  if (!token) {
    throw new Error("SLACK_BOT_TOKEN não configurado");
  }

  if (!clienteSlack) {
    clienteSlack = new WebClient(token);
  }

  return clienteSlack;
}

export async function enviarMensagemParaUsuario(userId, texto) {
  const slack = obterClienteSlack();

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
  const slack = obterClienteSlack();

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
