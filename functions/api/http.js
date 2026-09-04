// URL pública do portal. Serve de link nas mensagens do Slack e de origem
// permitida no CORS. Front e API são servidos pelo mesmo host (o rewrite
// /api/** do Hosting), então na prática as requisições são same-origin — os
// cabeçalhos ficam por garantia, não por necessidade.
export const PORTAL_URL =
  process.env.PORTAL_URL || "https://compras-oliv-e.web.app";

export function aplicarCors(res, { metodos = "POST, OPTIONS", cabecalhos = "Content-Type" } = {}) {
  res.setHeader("Access-Control-Allow-Origin", PORTAL_URL);
  res.setHeader("Access-Control-Allow-Methods", metodos);
  res.setHeader("Access-Control-Allow-Headers", cabecalhos);
}
