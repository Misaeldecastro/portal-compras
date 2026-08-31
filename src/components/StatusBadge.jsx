function statusParaClasse(status) {
  const normalizado = (status || "").toLowerCase();

  if (normalizado === "comprado") return "comprado";
  if (normalizado === "pendente") return "pendente";
  if (["reprovada", "reprovado", "recusada", "recusado"].includes(normalizado)) {
    return "recusado";
  }

  return "neutro";
}

export default function StatusBadge({ status }) {
  return (
    <span className={`selo-status ${statusParaClasse(status)}`}>
      {status || "Sem status"}
    </span>
  );
}
