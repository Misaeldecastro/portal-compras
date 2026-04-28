import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./Login";
import logo from "./assets/logo.png";

const formularioInicial = {
  solicitante: "",
  departamento: "",
  item: "",
  quantidade: "",
  prioridade: "Média",
  linkProduto1: "",
  linkProduto2: "",
  data: "",
  justificativa: "",
};

function App() {
  const [usuario, setUsuario] = useState(null);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [paginaAtiva, setPaginaAtiva] = useState("dashboard");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState("Todas");
  const [filtroDepartamento, setFiltroDepartamento] = useState("Todos");
  const [idEmEdicao, setIdEmEdicao] = useState(null);

  const [formulario, setFormulario] = useState(formularioInicial);

  // ✅ ADMINS
  const admins = [
    "m.castro@oliv-e.health",
    "j.furlan@oliv-e.health",
    "l.andrade@oliv-e.health",
  ];

  const isAdmin = usuario?.email && admins.includes(usuario.email);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const cadastroEmAndamento =
        sessionStorage.getItem("cadastroEmAndamento") === "true";

      if (cadastroEmAndamento) {
        if (user) {
          await signOut(auth);
        }
        setUsuario(null);
        setCarregando(false);
        return;
      }

      setUsuario(user || null);
      setCarregando(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (usuario) buscarSolicitacoes();
    else setSolicitacoes([]);
  }, [usuario, isAdmin]);

  async function buscarSolicitacoes() {
    if (!usuario) return;
    setCarregando(true);

    try {
      let q;

      if (isAdmin) {
        q = query(
          collection(db, "purchase_requests"),
          orderBy("data_criacao", "desc")
        );
      } else {
        q = query(
          collection(db, "purchase_requests"),
          where("user_id", "==", usuario.uid),
          orderBy("data_criacao", "desc")
        );
      }

      const snapshot = await getDocs(q);

      const dadosTratados = snapshot.docs.map((d) => {
        const item = d.data();
        const dataObj =
          item.data_criacao?.toDate ? item.data_criacao.toDate() : null;

        return {
          id: d.id,
          solicitante: item.solicitante || "",
          departamento: item.departamento || "",
          item: item.item || "",
          quantidade: item.quantidade || 0,
          prioridade: item.prioridade || "Média",
          linkProduto1: item.link_produto_1 || "",
          linkProduto2: item.link_produto_2 || "",
          data: item.data || "",
          justificativa: item.justificativa || "",
          status: item.status || "Pendente",
          dataCriacao: dataObj ? dataObj.toLocaleString("pt-BR") : "",
          dataCriacaoTs: dataObj ? dataObj.getTime() : 0,
          motivoReprovacao: item.motivo_reprovacao || "",
          userEmail: item.user_email || "",
        };
      });

      setSolicitacoes(dadosTratados);
    } catch (error) {
      console.error("Erro ao buscar:", error);
      alert("Erro ao buscar solicitações");
    } finally {
      setCarregando(false);
    }
  }

  function alterarFormulario(e) {
    const { name, value } = e.target;
    setFormulario((prev) => ({ ...prev, [name]: value }));
  }

  function limparFormulario() {
    setFormulario(formularioInicial);
    setIdEmEdicao(null);
  }

  async function enviarSolicitacao(e) {
    e.preventDefault();
    if (!usuario) return alert("Você precisa estar logado.");

    setSalvando(true);

    const payload = {
      solicitante: formulario.solicitante,
      departamento: formulario.departamento,
      item: formulario.item,
      quantidade: Number(formulario.quantidade),
      prioridade: formulario.prioridade,
      link_produto_1: formulario.linkProduto1,
      link_produto_2: formulario.linkProduto2 || "",
      data: formulario.data || null,
      justificativa: formulario.justificativa,
    };

    try {
      if (idEmEdicao) {
        await updateDoc(doc(db, "purchase_requests", idEmEdicao), payload);
        alert("Solicitação atualizada!");
      } else {
        await addDoc(collection(db, "purchase_requests"), {
          ...payload,
          status: "Pendente",
          motivo_reprovacao: "",
          user_id: usuario.uid,
          user_email: usuario.email,
          data_criacao: serverTimestamp(),
        });

        alert("Salvo com sucesso!");
      }

      limparFormulario();
      await buscarSolicitacoes();
      setPaginaAtiva("minhas");
    } catch (error) {
      alert("Erro ao salvar");
      console.error(error);
    } finally {
      setSalvando(false);
    }
  }

  async function mudarStatus(id, novoStatus) {
    if (!isAdmin) {
      alert("Sem permissão");
      return;
    }

    let motivo = "";
    if (novoStatus === "Reprovada") {
      const r = window.prompt("Motivo:");
      if (r === null) return;
      motivo = r;
    }

    await updateDoc(doc(db, "purchase_requests", id), {
      status: novoStatus,
      motivo_reprovacao: novoStatus === "Reprovada" ? motivo : "",
    });

    await buscarSolicitacoes();
  }

  if (!usuario) return <Login onLogin={setUsuario} />;

  return (
    <div>
      <h2>
        {isAdmin ? "Todas as solicitações" : "Minhas solicitações"}
      </h2>

      {solicitacoes.map((s) => (
        <div key={s.id}>
          <h3>{s.item}</h3>
          <p>Status: {s.status}</p>

          {isAdmin && (
            <>
              <button onClick={() => mudarStatus(s.id, "Aprovada")}>
                Aprovar
              </button>
              <button onClick={() => mudarStatus(s.id, "Reprovada")}>
                Reprovar
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default App;