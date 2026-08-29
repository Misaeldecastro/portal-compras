import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import express from "express";

import slack from "./api/slack.js";
import slackAprovado from "./api/slack-aprovado.js";
import slackReprovado from "./api/slack-reprovado.js";
import slackSolicitante from "./api/slack-solicitante.js";
import emailsPorRole from "./api/emails-por-role.js";

setGlobalOptions({ maxInstances: 10 });

const app = express();
app.use(express.json());

app.all("/api/slack", slack);
app.all("/api/slack-aprovado", slackAprovado);
app.all("/api/slack-reprovado", slackReprovado);
app.all("/api/slack-solicitante", slackSolicitante);
app.all("/api/emails-por-role", emailsPorRole);

export const api = onRequest(app);
