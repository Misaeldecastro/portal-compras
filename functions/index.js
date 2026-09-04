import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import express from "express";

import slack from "./api/slack.js";
import slackAprovado from "./api/slack-aprovado.js";
import slackReprovado from "./api/slack-reprovado.js";
import slackSolicitante from "./api/slack-solicitante.js";
import emailsPorRole from "./api/emails-por-role.js";

// Declarado aqui e ligado à função abaixo. É isso que faz o valor aparecer em
// process.env.SLACK_BOT_TOKEN no runtime — o firebase.json desativa o
// functions.config() legado, então não há outro caminho.
const slackBotToken = defineSecret("SLACK_BOT_TOKEN");

// SA de runtime dedicada. O prj-prd-infra-01 é compartilhado, e a SA padrão do
// Compute é usada por outras cargas dele — dar a ela acesso ao SLACK_BOT_TOKEN
// significaria que qualquer uma dessas cargas leria o token. Esta SA tem apenas
// secretAccessor nesse segredo e acesso ao Firestore restrito, por condição de
// IAM, ao banco "portal-compras".
setGlobalOptions({
  maxInstances: 10,
  region: "us-central1",
  serviceAccount: "portal-compras-functions@prj-prd-infra-01.iam.gserviceaccount.com",
});

const app = express();
app.use(express.json());

app.all("/api/slack", slack);
app.all("/api/slack-aprovado", slackAprovado);
app.all("/api/slack-reprovado", slackReprovado);
app.all("/api/slack-solicitante", slackSolicitante);
app.all("/api/emails-por-role", emailsPorRole);

export const api = onRequest({ secrets: [slackBotToken] }, app);
