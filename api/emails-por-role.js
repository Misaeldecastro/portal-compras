import { adminAuth, adminDb } from "./firebase-admin.js";

const ROLES_PERMITIDAS = new Set(["aprovador", "comprador"]);

export default async function handler(req, res) {
  const origemPermitida =
    process.env.PORTAL_URL || "https://portal-compras-five.vercel.app";

  res.setHeader("Access-Control-Allow-Origin", origemPermitida);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const role = req.query?.role;
  if (!ROLES_PERMITIDAS.has(role)) {
    return res.status(400).json({ error: "Parâmetro 'role' inválido" });
  }

  const idToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!idToken) {
    return res.status(401).json({ error: "Token de autenticação ausente" });
  }

  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  try {
    const snapshot = await adminDb
      .collection("users")
      .where("role", "==", role)
      .get();

    const emails = snapshot.docs
      .map((doc) => doc.data())
      .filter((user) => user.ativo !== false)
      .map((user) => String(user.email || "").trim())
      .filter(Boolean);

    return res.status(200).json({ emails });
  } catch (error) {
    console.error("Erro ao buscar e-mails por role:", error);
    return res.status(500).json({ error: "Erro interno" });
  }
}
