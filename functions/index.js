const { onRequest } = require("firebase-functions/v2/https");

exports.enviarSlack = onRequest(async (req, res) => {
  const webhookUrl = "https://hooks.slack.com/services/SEU_LINK_AQUI";

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Mensagem do sistema 🚀"
    })
  });

  res.send("Enviado!");
});