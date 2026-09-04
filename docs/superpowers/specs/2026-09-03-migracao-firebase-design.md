# Migração do Portal de Compras: Vercel → Firebase (prj-prd-infra-01)

**Data:** 2026-09-03
**Status:** aprovado para execução
**Origem:** `portal-compras-1af5d` (projeto nº 998196087552)
**Destino:** `prj-prd-infra-01` (projeto nº 731573328392)

---

## 1. Contexto

O portal roda hoje na Vercel, com Firestore e Auth no projeto Firebase
`portal-compras-1af5d`. O objetivo é consolidar tudo no projeto corporativo
compartilhado `prj-prd-infra-01`: hosting, functions, banco e usuários.

O commit `c60afbd` já preparou parte do caminho (`firebase.json`, `functions/`),
mas essa preparação assumia um projeto **dedicado**. O destino é
**compartilhado** com outras aplicações, e isso invalida várias premissas —
é o eixo central deste documento.

## 2. Fatos validados em 2026-09-03

Consultados via `gcloud` e APIs do Firebase, autenticado como
`juanbarezzi.dev@gmail.com`.

| Fato | Valor | Consequência |
|---|---|---|
| Localização Firestore (origem) | `nam5` | — |
| Localização Firestore (destino) | `nam5` | Mesma localização: bucket de export deve ser multi-região `US` |
| Firestore `(default)` do destino | **ocupado** | Portal precisa de banco **nomeado** `portal-compras` |
| Sites de Hosting no destino | `intranet-oliv-e`, `vitals-olive-prd`, `prj-prd-infra-01` (default) | Site default **tem release ativo** (2025-07-02, por `admingcp@olivesaude.com.br`) |
| Usuários Auth (origem) | 13 | Domínios: `oliv-e.health` (11), `oliv-e.com` (1), `gmail.com` (1) |
| Usuários Auth (destino) | 1 | Pool **compartilhado** com os outros apps |
| Colisões de e-mail entre os dois | **0** | `auth:import` não sobrescreve ninguém |
| `cloudfunctions.googleapis.com` | **desabilitada** no destino | Pré-requisito da Fase 1 |
| APIs já habilitadas no destino | Secret Manager, Firebase Rules, Firestore, Hosting, Identity Toolkit, Cloud Run, Cloud Build, Artifact Registry | Nada a fazer |

### Achado crítico: o site default está ocupado

O [`firebase.json`](../../../firebase.json) atual **não declara `site`**. Um
`firebase deploy --only hosting` publicaria o portal por cima da aplicação que
já está em `prj-prd-infra-01.web.app`. Por isso o portal ganha site próprio.

### Achado crítico: Auth é um pool único por projeto

Hosting separa-se por site. Firestore, por banco nomeado. **Auth não se separa**
— o pool de identidades é um por projeto GCP.

Combinado com o auto-provisionamento em [`src/App.jsx:258`](../../../src/App.jsx),
qualquer usuário do `intranet-oliv-e` ou do `vitals-olive-prd` que fizer login no
portal terá um `users/{uid}` criado com role `funcionario` e entrará.

**Decisão do responsável:** aceitar como SSO interno. O auto-provisionamento
permanece. As rules, porém, fixam `role: "funcionario"` na criação e impedem
auto-edição de `role` — entrada liberada não é administração liberada.

## 3. Decisões

| Item | Decisão |
|---|---|
| Banco Firestore | Nomeado `portal-compras`, em `nam5` |
| Site de Hosting | Novo site `compras-oliv-e` → `https://compras-oliv-e.web.app` |
| `PORTAL_URL` | `https://compras-oliv-e.web.app` |
| Usuários | `auth:export`/`auth:import` preservando UID **e** senha (scrypt) |
| Pool de Auth | Compartilhado, SSO interno aceito |
| Janela de manutenção | Nenhuma — portal pouco usado, export a quente |
| Deploy | GitHub Actions: hosting **+ functions + rules + índices** |
| Service account | Nova: `github-deploy-portal-compras`, seguindo a convenção do projeto |
| Região das Functions | `us-central1` (dentro de `nam5`) |

### Por que UID e senha precisam ser preservados

`users/{uid}` é indexado pelo UID do Auth, e `purchase_requests.user_id` guarda
o mesmo UID. UID é escopado por projeto: recriar usuários gera UIDs novos, os
documentos `users/{uid}` viram órfãos (todo mundo perde a role) e todo o
histórico de solicitações perde o dono. O `auth:import` preserva o `localId`, e
com os parâmetros scrypt do projeto de origem preserva também as senhas.

---

## 4. Runbook

Cada passo tem um critério de verificação. **Não avance sem ele.**
Fases 0 a 3 não alteram o ambiente da Vercel — o portal segue no ar.

### Fase 0 — Pré-voo

**0.1** Autenticar o Firebase CLI (hoje esta máquina não está autenticada):

```bash
firebase login
```

✅ `firebase projects:list` lista os dois projetos.

**0.2** Habilitar a Cloud Functions API no destino:

```bash
gcloud services enable cloudfunctions.googleapis.com eventarc.googleapis.com --project=prj-prd-infra-01
```

✅ `gcloud services list --enabled --project=prj-prd-infra-01 | grep cloudfunctions` retorna a linha.

**0.3** Capturar os parâmetros scrypt da origem. **Não há CLI para isso** —
Console do Firebase → projeto `portal-compras-1af5d` → Authentication → aba
Users → menu ⋮ (canto superior direito) → *Password hash parameters*.

Guardar os quatro valores: `base64_signer_key`, `base64_salt_separator`,
`rounds`, `mem_cost`.

✅ Os quatro valores anotados. Sem eles, as senhas não migram.

---

### Fase 1 — Provisionar o destino

**1.1** Criar o banco nomeado, em `nam5` (localização é **irreversível**):

```bash
gcloud firestore databases create --database=portal-compras --location=nam5 --type=firestore-native --project=prj-prd-infra-01
```

✅ `gcloud firestore databases list --project=prj-prd-infra-01` mostra
`portal-compras` com `LOCATION_ID = nam5`.

**1.2** Criar o site de Hosting dedicado:

```bash
firebase hosting:sites:create compras-oliv-e --project prj-prd-infra-01
```

> Nomes de site são **globalmente únicos** em todo o Firebase, não apenas dentro
> do projeto. Na execução de 2026-09-04, tanto `portal-compras` quanto
> `portal-compras-olive` estavam reservados por outros projetos. O nome escolhido
> foi `compras-oliv-e`, que espelha o padrão do app irmão `intranet-oliv-e`.
> Disponibilidade pode ser testada sem criar nada, com `validateOnly=true` na
> API `firebasehosting.googleapis.com/v1beta1/projects/{n}/sites`.

✅ O site aparece na listagem e `https://compras-oliv-e.web.app` responde com a
página de placeholder do Firebase.

**1.3** Criar o app Web no projeto destino e capturar a config do SDK:

```bash
firebase apps:create web "Portal de Compras" --project prj-prd-infra-01
```

```bash
firebase apps:sdkconfig web --project prj-prd-infra-01
```

✅ A saída traz `apiKey`, `authDomain`, `projectId`, `storageBucket`,
`messagingSenderId`, `appId` — são os novos valores das seis variáveis `VITE_*`.

**1.4** Criar a service account de deploy:

```bash
gcloud iam service-accounts create github-deploy-portal-compras --display-name="GitHub Actions Deploy — portal-compras" --project=prj-prd-infra-01
```

**1.5** Conceder os papéis mínimos:

```bash
SA=github-deploy-portal-compras@prj-prd-infra-01.iam.gserviceaccount.com
for ROLE in \
  roles/firebasehosting.admin \
  roles/firebaserules.admin \
  roles/datastore.indexAdmin \
  roles/cloudfunctions.developer \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/cloudbuild.builds.editor \
  roles/serviceusage.serviceUsageConsumer \
  roles/iam.serviceAccountUser ; do
  gcloud projects add-iam-policy-binding prj-prd-infra-01 --member="serviceAccount:$SA" --role="$ROLE" --condition=None --quiet
done
```

**1.6** Gerar a chave e cadastrar no GitHub como
`FIREBASE_SERVICE_ACCOUNT_PRJ_PRD_INFRA_01`:

```bash
gcloud iam service-accounts keys create /tmp/sa-portal-compras.json --iam-account=github-deploy-portal-compras@prj-prd-infra-01.iam.gserviceaccount.com --project=prj-prd-infra-01
```

> ⚠️ Se a organização aplicar `constraints/iam.disableServiceAccountKeyCreation`,
> este comando falha. Nesse caso, usar Workload Identity Federation — a SA
> `github-action-1211754085` sugere que o padrão já existe no projeto; vale
> conferir como ela autentica antes de assumir chave JSON.

Após colar o conteúdo no GitHub, **apagar o arquivo local**:

```bash
shred -u /tmp/sa-portal-compras.json
```

**1.7** Criar o secret do Slack no Secret Manager:

```bash
printf '%s' 'xoxb-SEU-TOKEN-AQUI' | gcloud secrets create SLACK_BOT_TOKEN --data-file=- --project=prj-prd-infra-01
```

✅ `gcloud secrets list --project=prj-prd-infra-01 | grep SLACK_BOT_TOKEN`.

---

### Fase 2 — Migrar o Firestore

**2.1** Criar o bucket de transferência (multi-região `US`, compatível com `nam5`):

```bash
gcloud storage buckets create gs://portal-compras-migracao-20260903 --location=US --project=prj-prd-infra-01
```

**2.2** Dar ao service agent da **origem** permissão de escrita no bucket:

```bash
gcloud storage buckets add-iam-policy-binding gs://portal-compras-migracao-20260903 --member="serviceAccount:service-998196087552@gcp-sa-firestore.iam.gserviceaccount.com" --role=roles/storage.admin
```

**2.3** Dar ao service agent do **destino** permissão de leitura:

```bash
gcloud storage buckets add-iam-policy-binding gs://portal-compras-migracao-20260903 --member="serviceAccount:service-731573328392@gcp-sa-firestore.iam.gserviceaccount.com" --role=roles/storage.admin
```

> Os passos 2.2 e 2.3 são a causa nº 1 de falha de import entre projetos.
> Executá-los **antes** do export evita descobrir o problema no meio da migração.

**2.4** Exportar:

```bash
gcloud firestore export gs://portal-compras-migracao-20260903/export-20260903 --project=portal-compras-1af5d --database='(default)'
```

✅ O comando retorna um nome de operação. Acompanhar com:

```bash
gcloud firestore operations list --project=portal-compras-1af5d --limit=1
```

**2.5** Importar no banco nomeado:

```bash
gcloud firestore import gs://portal-compras-migracao-20260903/export-20260903 --project=prj-prd-infra-01 --database=portal-compras
```

**2.6** Conferir contagem — como o export foi feito com o portal no ar, esta
verificação é o que detecta uma escrita perdida.

> Não existe `gcloud firestore documents list`. A contagem sai da API de
> agregação, que devolve o total sem ler os documentos (uma leitura faturada
> por consulta, não uma por documento). Comando abaixo validado em 2026-09-03.

```bash
TOKEN=$(gcloud auth print-access-token)
contar() { # $1=projeto  $2=database  $3=coleção
  curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "X-Goog-User-Project: prj-prd-infra-01" -H "Content-Type: application/json" \
    "https://firestore.googleapis.com/v1/projects/$1/databases/$2/documents:runAggregationQuery" \
    -d "{\"structuredAggregationQuery\":{\"structuredQuery\":{\"from\":[{\"collectionId\":\"$3\"}]},\"aggregations\":[{\"alias\":\"total\",\"count\":{}}]}}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['result']['aggregateFields']['total']['integerValue']) if isinstance(d,list) and d and 'result' in d[0] else print('ERRO:',json.dumps(d)[:300])"
}
for COL in users purchase_requests; do
  echo "$COL  origem:  $(contar portal-compras-1af5d '(default)' $COL)"
  echo "$COL  destino: $(contar prj-prd-infra-01 portal-compras $COL)"
done
```

**Linha de base medida em 2026-09-03 (antes da migração):**

| Coleção | Documentos na origem |
|---|---|
| `users` | 14 |
| `purchase_requests` | 112 |

✅ As contagens do destino batem com as da origem (ou são maiores, se alguém
escreveu durante a janela). Se o destino tiver **menos**, repetir 2.4–2.5 — o
import é idempotente por ID de documento.

> **Nota sobre `users`:** há 14 documentos em `users` mas apenas 13 usuários no
> Auth da origem. Existe um documento órfão — provavelmente de alguém removido
> do Auth cujo doc permaneceu. É esperado, não é falha de import, e o órfão será
> copiado como qualquer outro documento. Vale limpar depois, fora desta migração.

---

### Fase 3 — Migrar os usuários

**3.1** Exportar:

```bash
firebase auth:export /tmp/usuarios-portal.json --format=json --project portal-compras-1af5d
```

✅ O arquivo tem 13 entradas com `localId` preenchido.

**3.2** Importar preservando UID e senha, com os valores da Fase 0.3:

```bash
firebase auth:import /tmp/usuarios-portal.json \
  --hash-algo=SCRYPT \
  --hash-key='<base64_signer_key>' \
  --salt-separator='<base64_salt_separator>' \
  --rounds=<rounds> \
  --mem-cost=<mem_cost> \
  --project prj-prd-infra-01
```

✅ Saída informa 13 usuários importados, 0 erros.

**3.3** Conferir que os UIDs bateram — cada `localId` importado precisa ter um
`users/{uid}` correspondente no Firestore migrado. Testar com uma conta real no
final da Fase 5.

```bash
shred -u /tmp/usuarios-portal.json
```

> O arquivo contém hashes de senha. Apagar assim que o import terminar.

---

### Fase 4 — Ajustar o código

Arquivos a **remover** (resíduo da Vercel):

- `api/` (duplicata de `functions/api/`, nada faz deploy dela)
- `vercel.json`
- `vite-dev.err` (arquivo vazio commitado por acidente)

Arquivos a **criar**: `firestore.rules`, `firestore.indexes.json`.

Arquivos a **alterar**:

| Arquivo | Mudança |
|---|---|
| `.firebaserc` | Projeto `prj-prd-infra-01` + target de hosting |
| `firebase.json` | `hosting` como array com `target`; seção `firestore` com `database`; headers de cache |
| `src/firebase.js` | `getFirestore(app, "portal-compras")` |
| `functions/api/firebase-admin.js` | ADC em vez de `cert()`; banco nomeado |
| `functions/api/slack-utils.js` | `WebClient` preguiçoso (ver nota abaixo) |
| `functions/index.js` | `defineSecret`, região, binding do secret |
| `functions/api/*.js` | Fallback de CORS deixa de apontar para a Vercel |
| `.github/workflows/*.yml` | Novo projeto, nova SA, `setup-node`, deploy de functions/rules |

#### Nota: `WebClient` no escopo do módulo

[`functions/api/slack-utils.js:3`](../../../functions/api/slack-utils.js) faz
`new WebClient(process.env.SLACK_BOT_TOKEN)` no carregamento do módulo. Com
Secret Manager o valor existe em runtime, mas amarrar a construção do cliente ao
tempo de import torna qualquer falha de binding silenciosa e permanente: o
cliente nasce com token `undefined` e nunca se recupera. Passa a ser criado sob
demanda.

#### `firestore.rules`

Espelha exatamente o modelo de permissão do app (`funcionario`, `aprovador`,
`comprador`, `admin`, `admin_full`), com duas travas:

1. **Auto-provisionamento controlado** — o usuário cria o próprio doc, mas só
   com `role: "funcionario"` e `ativo: true`. Sem isso, qualquer autenticado
   pode se promover a `admin_full` pelo console do navegador.
2. **Leitura por documento** — `funcionario` só lê as próprias solicitações,
   `comprador` só lê as aprovadas. Como o Firestore avalia a rule contra cada
   documento retornado, uma query sem filtro simplesmente falha.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function autenticado() { return request.auth != null; }
    function dadosUsuario() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    function ativo()       { return dadosUsuario().ativo != false; }
    function papel()       { return dadosUsuario().role; }
    function ehAdminFull() { return autenticado() && ativo() && papel() == 'admin_full'; }
    function ehAprovador() { return autenticado() && ativo() && papel() == 'aprovador'; }
    function ehComprador() { return autenticado() && ativo() && papel() == 'comprador'; }

    match /users/{uid} {
      allow get: if autenticado() && (request.auth.uid == uid || ehAdminFull());
      allow list: if ehAdminFull();

      allow create: if autenticado()
                    && request.auth.uid == uid
                    && request.resource.data.role == 'funcionario'
                    && request.resource.data.ativo == true;

      allow update: if ehAdminFull();
      allow delete: if false;
    }

    match /purchase_requests/{id} {
      allow read: if autenticado() && ativo() && (
                       resource.data.user_id == request.auth.uid
                    || ehAprovador() || ehAdminFull()
                    || (ehComprador() && resource.data.aprovada_aprovador == true)
                  );

      allow create: if autenticado() && ativo()
                    && request.resource.data.user_id == request.auth.uid;

      allow update: if ehAprovador() || ehAdminFull() || ehComprador()
                    || (resource.data.user_id == request.auth.uid
                        && resource.data.analise_aprovador_finalizada == false);

      allow delete: if ehAprovador() || ehAdminFull();
    }

    match /{document=**} { allow read, write: if false; }
  }
}
```

> **Custo:** cada avaliação chama `get()` no doc do usuário, o que é uma leitura
> faturada. Aceitável no volume atual. Se crescer, migrar as roles para custom
> claims do Auth elimina essas leituras — fica registrado como melhoria futura,
> fora do escopo desta migração.

#### `firestore.indexes.json`

Os dois índices compostos que as queries de
[`useSolicitacoes.js:45`](../../../src/hooks/useSolicitacoes.js) exigem:

```json
{
  "indexes": [
    {
      "collectionGroup": "purchase_requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "aprovada_aprovador", "order": "ASCENDING" },
        { "fieldPath": "data_criacao", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "purchase_requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "data_criacao", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

#### Validação local antes de subir

```bash
npm run lint && npm run build
```

✅ Build passa. As rules serão validadas contra o emulador antes do deploy.

---

### Fase 5 — Deploy e validação

**5.0** Ensaio sem efeito colateral — valida config e build sem publicar nada:

```bash
firebase deploy --dry-run --project prj-prd-infra-01
```

✅ Passa sem erro. Aqui aparecem erros de sintaxe nas rules e problemas de
build das functions, antes de qualquer coisa ir ao ar.

**5.1** Publicar rules e índices primeiro (antes do front, para que o banco já
esteja protegido quando o app chegar):

```bash
firebase deploy --only firestore --project prj-prd-infra-01
```

> `--only firestore` publica todas as configurações de Firestore declaradas no
> `firebase.json`. Como declaramos **apenas** o banco `portal-compras`, isso
> atinge só ele — o `(default)` dos outros apps não é tocado. Confirme com o
> `--dry-run` do passo 5.0 antes de rodar.

**5.2** Publicar as functions:

```bash
firebase deploy --only functions --project prj-prd-infra-01
```

✅ `gcloud functions list --project=prj-prd-infra-01` mostra `api` em
`us-central1`, estado `ACTIVE`.

**5.3** Publicar o hosting:

```bash
firebase deploy --only hosting:portal --project prj-prd-infra-01
```

**5.4** Roteiro de validação em `https://compras-oliv-e.web.app`:

| # | Teste | Resultado esperado |
|---|---|---|
| 1 | Login com uma conta real da origem, **senha antiga** | Entra sem redefinir senha — prova que scrypt migrou |
| 2 | Conferir a role exibida | Igual à de antes — prova que o UID foi preservado |
| 3 | Listar solicitações | Histórico completo aparece |
| 4 | Criar uma solicitação | Grava, e a notificação chega no Slack |
| 5 | Aprovar/reprovar | Slack notifica comprador e solicitante |
| 6 | Abrir `/solicitacao/<id>` direto na URL | Carrega — prova o rewrite de SPA |
| 7 | Login com `funcionario` e tentar ler solicitação alheia via console | **Negado** pelas rules |
| 8 | Tentar `setDoc` na própria role como `admin_full` via console | **Negado** pelas rules |
| 9 | Verificar `intranet-oliv-e.web.app` e `vitals-olive-prd.web.app` | Continuam no ar, intactos |

O teste 9 não é paranoia: o portal passa a dividir projeto com eles, e é a
confirmação de que o deploy não encostou em site alheio.

---

### Fase 6 — CI/CD

Workflows atualizados com:

- `projectId: prj-prd-infra-01` e `FIREBASE_SERVICE_ACCOUNT_PRJ_PRD_INFRA_01`
- `actions/setup-node@v4` com `node-version: 24` (o que `functions/package.json` declara)
- `target: portal` no deploy de hosting
- Passo novo de deploy de **functions + firestore rules/índices**, que hoje não
  existe — é o que hoje permite um merge publicar front novo contra API velha
- `npm run lint` no PR

A config do Firebase vive no **environment `Production`** do repositório, não no
nível do repo nem da organização:

| Onde | Nome |
|---|---|
| Secret | `FIREBASE_SERVICE_ACCOUNT_PRJ_PRD_INFRA_01` |
| Secret | `VITE_FIREBASE_API_KEY` |
| Variable | `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET` |

Os cinco valores públicos são *variables* porque a config web do Firebase é
pública por design — ela vai embutida no bundle JS. Tratá-los como segredo
gera cerimônia sem ganho de segurança; o que protege o banco é o
`firestore.rules`.

Duas consequências para os workflows, ambas silenciosas se erradas:

1. O job precisa declarar `environment: Production`. Sem isso ele não enxerga
   nem os secrets nem as variables, e o build sai com strings vazias — o site
   sobe, carrega, e falha só ao tentar falar com o Firebase.
2. Os cinco públicos são lidos com `vars.`, não `secrets.`. Um `secrets.X`
   apontando para uma variable resolve para vazio, sem erro de sintaxe.

O workflow de PR (`verificar-pr.yml`) roda **apenas lint e build** — sem deploy,
sem canal de preview e sem environment. A consequência de segurança é
deliberada: um PR nunca recebe a chave da service account de deploy. Canais de
preview também não teriam backend próprio (usariam as functions e o banco de
produção), então testar num preview escreveria dados reais.

✅ Abrir um PR: lint e build passam, e nenhuma credencial é exposta ao job.

---

### Fase 7 — Desativar a Vercel

Só depois de alguns dias de operação estável.

1. Verificar nos logs da Vercel que não há mais tráfego
2. Pausar o projeto na Vercel (não excluir ainda)
3. Manter `portal-compras-1af5d` **intacto** por pelo menos 30 dias — é o
   rollback
4. Apagar o bucket de migração:

```bash
gcloud storage rm -r gs://portal-compras-migracao-20260903
```

---

## 5. Riscos e rollback

| Risco | Mitigação |
|---|---|
| Deploy sobrescrever site alheio | Site dedicado + `target` explícito no `firebase.json`. Validação 9. |
| Parâmetros scrypt errados → ninguém loga | Detectado na validação 1, antes de desligar a Vercel. Recuperação: `sendPasswordResetEmail` em massa. |
| Escrita perdida no export a quente | Conferência de contagem (2.6). Volume baixo torna improvável. |
| Import falhar por IAM do bucket | Passos 2.2/2.3 executados antes do export. |
| Rules trancarem usuários legítimos | Validação 1–6 cobre todas as roles antes do corte. |
| Chave de SA bloqueada por org policy | Workload Identity Federation como alternativa (nota em 1.6). |

**Rollback:** até a Fase 7, a Vercel continua no ar apontando para
`portal-compras-1af5d`, que não é modificado em momento algum da migração. Voltar
significa simplesmente parar de usar a URL nova. O rollback é gratuito porque a
origem é somente lida.

## 6. Fora de escopo

- Migrar roles para custom claims (elimina o `get()` das rules)
- Proxy do Vite para `/api/*` em desenvolvimento — hoje `npm run dev` não tem
  backend e as chamadas ao Slack caem no fallback de SPA
- Reescrever o README, que ainda é o boilerplate do template Vite
