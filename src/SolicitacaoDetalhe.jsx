import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function SolicitacaoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [solicitacao, setSolicitacao] = useState(null);
  const [podeAprovar, setPodeAprovar] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/");
        return;
      } 

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    const role = userSnap.exists() ? userSnap.data().role : "funcionario";
    const usuarioPodeAprovar = role === "aprovador" || role === "admin_full";

    setPodeAprovar(usuarioPodeAprovar);

      const ref = doc(db, "purchase_requests", id);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setSolicitacao({ id: snap.id, ...snap.data() });
      }
    });
    
    return () => unsubscribe();
  }, [id, navigate]);

  async function aprovar() {
  if (!podeAprovar) {
    alert("Você não tem permissão para aprovar solicitações.");
    return;
  }

  await updateDoc(doc(db, "purchase_requests", id), {
    status: "Aprovada",
    aprovada_aprovador: true,
    analise_aprovador_finalizada: true,
    motivo_reprovacao: "",
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
      console.error("Erro ao enviar para o comprador:", erro);
    }
  } catch (erro) {
    console.error("Erro na chamada /api/slack-aprovado:", erro);
  }

  alert("Aprovado e enviado para o comprador!");
}

  async function reprovar() {
    if (!podeAprovar) {
      alert("Você não tem permissão para reprovar solicitações.");
      return;
    }
    const motivo = prompt("Motivo da reprovação:");
    if (!motivo) return;

    await updateDoc(doc(db, "purchase_requests", id), {
      status: "Reprovada",
      aprovada_aprovador: false,
      analise_aprovador_finalizada: true,
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

    {podeAprovar && (
      <div style={{ marginTop: 20 }}>
        <button onClick={aprovar}>
        Aprovar
        </button>

        <button onClick={reprovar}>
        Reprovar
        </button>
      </div>
    )}

      </div>
    </div>
);
}
