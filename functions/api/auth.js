import { adminAuth } from "./firebase-admin.js";

/**
 * Exige um ID token válido do Firebase no cabeçalho Authorization.
 *
 * Devolve o token decodificado, ou null caso já tenha respondido 401 — o
 * chamador deve simplesmente retornar quando receber null.
 *
 * Sem isto, os endpoints do Slack ficam abertos: qualquer POST anônimo faria
 * o bot mandar mensagem para os aprovadores com conteúdo arbitrário. A
 * verificação não custa chamada de rede: valida a assinatura do JWT contra as
 * chaves públicas do Google, que o Admin SDK mantém em cache.
 */
export async function exigirAutenticacao(req, res) {
  const idToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!idToken) {
    res.status(401).json({ error: "Token de autenticação ausente" });
    return null;
  }

  try {
    return await adminAuth.verifyIdToken(idToken);
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return null;
  }
}
