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

  const ref = doc(db, "purchase_requests", id);
  const snap = await getDoc(ref);
  const data = snap.data();

  try {
    const resposta = await fetch("/api/slack-aprovado", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...data,
        idSolicitacao: id,
      }),
    });

    if (!resposta.ok) {
      const erro = await resposta.text();
      console.error("Erro ao enviar para João:", erro);
    }
  } catch (erro) {
    console.error("Erro na chamada /api/slack-aprovado:", erro);
  }

  alert("Aprovado e enviado para o João!");
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
  <div style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "#f5f5f5"
  }}>
    <div style={{
      background: "#fff",
      padding: 30,
      borderRadius: 10,
      width: "400px",
      boxShadow: "0 0 10px rgba(0,0,0,0.1)"
    }}>
      <h2>Solicitação</h2>

      <p><strong>Justificativa:</strong> {solicitacao.justificativa || "-"}</p>
      <p><strong>Solicitante:</strong> {solicitacao.solicitante || "-"}</p>
      <p><strong>Departamento:</strong> {solicitacao.departamento || "-"}</p>
      <p><strong>Item:</strong> {solicitacao.item || "-"}</p>
      <p><strong>Quantidade:</strong> {solicitacao.quantidade || "-"}</p>
      <p><strong>Prioridade:</strong> {solicitacao.prioridade || "-"}</p>

      <p>
        <strong>Link do produto 1:</strong>{" "}
        {solicitacao.link_produto_1 ? (
          <a
            href={solicitacao.link_produto_1}
            target="_blank"
            rel="noreferrer"
          >
            Abrir link
          </a>
  ) : "-"}
</p>

<p>
        <strong>Link do produto 2:</strong>{" "}
        {solicitacao.link_produto_2 ? (
          <a
            href={solicitacao.link_produto_2}
            target="_blank"
            rel="noreferrer"
          >
            Abrir link
          </a>
  ) : "-"}
</p>

<p><strong>Prazo:</strong> {solicitacao.data || "-"}</p>

      <div style={{ marginTop: 20 }}>
        <button onClick={aprovar} style={{
          background: "green",
          color: "#fff",
          border: "none",
          padding: "10px 15px",
          borderRadius: 5,
          cursor: "pointer"
        }}>
          Aprovar
        </button>

        <button onClick={reprovar} style={{
          marginLeft: 10,
          background: "red",
          color: "#fff",
          border: "none",
          padding: "10px 15px",
          borderRadius: 5,
          cursor: "pointer"
        }}>
          Reprovar
        </button>
      </div>
    </div>
  </div>
);
}