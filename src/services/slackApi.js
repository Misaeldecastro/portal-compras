async function postJson(caminho, payload) {
  return fetch(caminho, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function notificarSolicitanteSlack({
  idSolicitacao,
  item,
  solicitante,
  userEmail,
  status,
}) {
  const resposta = await postJson("/api/slack-solicitante", {
    idSolicitacao,
    item,
    solicitante,
    userEmail,
    status,
  });

  if (!resposta.ok) {
    throw new Error("Slack respondeu com erro");
  }
}

export async function buscarEmailsPorRole(usuario, roleAlvo) {
  const idToken = await usuario.getIdToken();
  const resposta = await fetch(
    `/api/emails-por-role?role=${encodeURIComponent(roleAlvo)}`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );

  if (!resposta.ok) {
    throw new Error("Falha ao buscar e-mails por role");
  }

  const { emails } = await resposta.json();
  return emails;
}

export async function notificarNovaSolicitacaoSlack(payload) {
  return postJson("/api/slack", payload);
}

export async function notificarReprovacaoSlack(payload) {
  const resposta = await postJson("/api/slack-reprovado", payload);
  if (!resposta.ok) {
    throw new Error("Slack respondeu com erro");
  }
}

export async function notificarAprovacaoSlack(payload) {
  const resposta = await postJson("/api/slack-aprovado", payload);
  if (!resposta.ok) {
    throw new Error("Slack respondeu com erro");
  }
}
