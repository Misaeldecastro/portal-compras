import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export default function SolicitacaoDetalhe() {
  const { id } = useParams();
  const [solicitacao, setSolicitacao] = useState(null);

  useEffect(() => {
    async function buscar() {
      const ref = doc(db, "purchase_requests", id);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setSolicitacao({ id: snap.id, ...snap.data() });
      }
    }

    buscar();
  }, [id]);

  async function aprovar() {
    await updateDoc(doc(db, "purchase_requests", id), {
      status: "Aprovada",
    });
    alert("Aprovado!");
  }

  async function reprovar() {
    const motivo = prompt("Motivo da reprovação:");
    if (!motivo) return;

    await updateDoc(doc(db, "purchase_requests", id), {
      status: "Reprovada",
      motivo_reprovacao: motivo,
    });

    alert("Reprovado!");
  }

  if (!solicitacao) return <p>Carregando...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Solicitação</h1>

      <p><strong>Justificativa:</strong> {solicitacao.justificativa}</p>
      <p><strong>Solicitante:</strong> {solicitacao.solicitante}</p>
      <p><strong>Departamento:</strong> {solicitacao.departamento}</p>
      <p><strong>Item:</strong> {solicitacao.item}</p>
      <p><strong>Quantidade:</strong> {solicitacao.quantidade}</p>
      <p><strong>Prioridade:</strong> {solicitacao.prioridade}</p>

      <button onClick={aprovar}>Aprovar</button>
      <button onClick={reprovar} style={{ marginLeft: 10 }}>
        Reprovar
      </button>
    </div>
  );
}