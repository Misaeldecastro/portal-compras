import { adminDb } from "./firebase-admin.js";
import { aplicarCors } from "./http.js";
import { exigirAutenticacao } from "./auth.js";

const ROLES_PERMITIDAS = new Set(["aprovador", "comprador"]);

export default async function handler(req, res) {
  aplicarCors(res, {
    metodos: "GET, OPTIONS",
    cabecalhos: "Content-Type, Authorization",
  });

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

  if (!(await exigirAutenticacao(req, res))) return;

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
