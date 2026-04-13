import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  async function buscarSolicitacoes() {
    if (!usuario) return;
    setCarregando(true);

    try {
      const q = query(
        collection(db, "purchase_requests"),
        where("user_id", "==", usuario.uid)
      );

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

      dadosTratados.sort((a, b) => b.dataCriacaoTs - a.dataCriacaoTs);
      setSolicitacoes(dadosTratados);
    } catch (error) {
      console.error("Erro ao buscar:", error);

      if (!auth.currentUser) return;

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
        alert("Solicitação atualizada com sucesso!");
      } else {
        const docRef = await addDoc (collection(db, "purchase_requests"), {
          ...payload,
          status: "Pendente",
          motivo_reprovacao: "",
          user_id: usuario.uid,
          user_email: usuario.email,
          data_criacao: serverTimestamp(),
        });

        const linkAnalise = `${window.location.origin}/solicitacao/${docRef.id}`;

        try {
          const respostaSlack = await fetch("/api/slack", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              solicitante: formulario.solicitante,
              departamento: formulario.departamento,
              item: formulario.item,
              quantidade: Number(formulario.quantidade),
              prioridade: formulario.prioridade,
              linkProduto1: formulario.linkProduto1,
              linkProduto2: formulario.linkProduto2 || "",
              data: formulario.data || "",
              justificativa: formulario.justificativa,
              idSolicitacao: docRef.id,
              linkAnalise,
            }),
          });

          if (!respostaSlack.ok) {
            const erroSlack = await respostaSlack.json().catch(() => ({}));
            console.error("Erro ao enviar para o Slack:", erroSlack);
          }
        } catch (erroSlack) {
          console.error("Erro ao chamar /api/slack:", erroSlack);
        }

        alert("Salvo com sucesso!");
      }

      limparFormulario();
      await buscarSolicitacoes();
      setPaginaAtiva("minhas");
    } catch (error) {
      alert(idEmEdicao ? "Erro ao editar" : "Erro ao salvar");
      console.error(error);
    } finally {
      setSalvando(false);
    }
  }

  function editarSolicitacao(s) {
    setIdEmEdicao(s.id);
    setFormulario({
      solicitante: s.solicitante,
      departamento: s.departamento,
      item: s.item,
      quantidade: s.quantidade,
      prioridade: s.prioridade,
      linkProduto1: s.linkProduto1,
      linkProduto2: s.linkProduto2,
      data: s.data,
      justificativa: s.justificativa,
    });
    setPaginaAtiva("nova");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluirSolicitacao(id) {
    if (!window.confirm("Tem certeza que deseja excluir esta solicitação?")) return;
    try {
      await deleteDoc(doc(db, "purchase_requests", id));
      if (idEmEdicao === id) limparFormulario();
      await buscarSolicitacoes();
    } catch (error) {
      alert("Erro ao excluir");
      console.error(error);
    }
  }

  async function mudarStatus(id, novoStatus) {
    let motivo = "";
    if (novoStatus === "Reprovada") {
      const r = window.prompt("Digite o motivo da reprovação:");
      if (r === null) return;
      motivo = r;
    }

    try {
      await updateDoc(doc(db, "purchase_requests", id), {
        status: novoStatus,
        motivo_reprovacao: novoStatus === "Reprovada" ? motivo : "",
      });
      await buscarSolicitacoes();
    } catch (error) {
      alert("Erro ao alterar status");
      console.error(error);
    }
  }

  const solicitacoesFiltradas = useMemo(() => {
    return solicitacoes.filter((s) => {
      const texto = busca.toLowerCase();
      const bateBusca =
        s.solicitante.toLowerCase().includes(texto) ||
        s.departamento.toLowerCase().includes(texto) ||
        s.item.toLowerCase().includes(texto);

      const bateStatus = filtroStatus === "Todos" || s.status === filtroStatus;
      const batePrioridade =
        filtroPrioridade === "Todas" || s.prioridade === filtroPrioridade;
      const bateDepartamento =
        filtroDepartamento === "Todos" || s.departamento === filtroDepartamento;

      return bateBusca && bateStatus && batePrioridade && bateDepartamento;
    });
  }, [solicitacoes, busca, filtroStatus, filtroPrioridade, filtroDepartamento]);

  const departamentosUnicos = useMemo(
    () => [...new Set(solicitacoes.map((s) => s.departamento).filter(Boolean))],
    [solicitacoes]
  );

  const total = solicitacoes.length;
  const pendentes = solicitacoes.filter((s) => s.status === "Pendente").length;
  const emAnalise = solicitacoes.filter((s) => s.status === "Em análise").length;
  const aprovadas = solicitacoes.filter((s) => s.status === "Aprovada").length;
  const compradas = solicitacoes.filter((s) => s.status === "Comprado").length;

  if (!usuario) return <Login onLogin={setUsuario} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <img src={logo} alt="Logo" className="logo-sidebar" />
        <h2 className="logo">Oliv-e Saúde</h2>

        <nav className="menu">
          <button className="menu-item" onClick={() => setPaginaAtiva("dashboard")}>
            Dashboard
          </button>
          <button className="menu-item" onClick={() => setPaginaAtiva("nova")}>
            Nova Solicitação
          </button>
          <button className="menu-item" onClick={() => setPaginaAtiva("minhas")}>
            Minhas Solicitações
          </button>
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <h1>Portal de Solicitações</h1>
          <button
            onClick={async () => {
              await signOut(auth);
              setUsuario(null);
            }}
          >
            Sair
          </button>
        </header>

        <main className="content">
          <p className="subtitulo">
            Usuário logado: <strong>{usuario.email}</strong>
          </p>

          {paginaAtiva === "dashboard" && (
            <div className="cards">
              <div className="card"><h3>Total</h3><strong>{total}</strong></div>
              <div className="card"><h3>Pendentes</h3><strong>{pendentes}</strong></div>
              <div className="card"><h3>Em análise</h3><strong>{emAnalise}</strong></div>
              <div className="card"><h3>Aprovadas</h3><strong>{aprovadas}</strong></div>
              <div className="card"><h3>Compradas</h3><strong>{compradas}</strong></div>
            </div>
          )}

          {paginaAtiva === "nova" && (
            <div className="bloco">
              <h2>{idEmEdicao ? "Editar solicitação" : "Nova solicitação"}</h2>
              <form onSubmit={enviarSolicitacao} className="formulario">
                <textarea
                  name="justificativa"
                  placeholder="Justificativa/ Descrição"
                  value={formulario.justificativa}
                  onChange={alterarFormulario}
                  required
                />

                <input
                  name="solicitante"
                  placeholder="Solicitante"
                  value={formulario.solicitante}
                  onChange={alterarFormulario}
                  required
                />

                <input
                  name="departamento"
                  placeholder="Departamento"
                  value={formulario.departamento}
                  onChange={alterarFormulario}
                  required
                />

                <input
                  name="item"
                  placeholder="Item solicitado"
                  value={formulario.item}
                  onChange={alterarFormulario}
                  required
                />

                <input
                  name="quantidade"
                  placeholder="Quantidade"
                  value={formulario.quantidade}
                  onChange={alterarFormulario}
                  required
                />

                <select
                  name="prioridade"
                  value={formulario.prioridade}
                  onChange={alterarFormulario}
                >
                  <option>Prioridade Alta</option>
                  <option>Prioridade Média</option>
                  <option>Prioridade Baixa</option>
                </select>

                <input
                  name="linkProduto1"
                  placeholder="Link do produto 1"
                  value={formulario.linkProduto1}
                  onChange={alterarFormulario}
                  required
                />

                <input
                  name="linkProduto2"
                  placeholder="Link do produto 2 (opcional)"
                  value={formulario.linkProduto2}
                  onChange={alterarFormulario}
                />

                <input
                  name="data"
                  type="date"
                  value={formulario.data}
                  onChange={alterarFormulario}
                  required
                />


                <div className="acoes-formulario">
                  <button type="submit" disabled={salvando}>
                    {salvando ? "Salvando..." : idEmEdicao ? "Salvar edição" : "Enviar solicitação"}
                  </button>
                  {idEmEdicao && (
                    <button type="button" onClick={limparFormulario} className="botao-secundario">
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {paginaAtiva === "minhas" && (
            <div className="bloco">
              <h2>Minhas solicitações</h2>

              <div className="filtros filtros-4">
                <input
                  placeholder="Buscar por solicitante, departamento ou item"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                  <option>Todos</option>
                  <option>Pendente</option>
                  <option>Em análise</option>
                  <option>Aprovada</option>
                  <option>Reprovada</option>
                  <option>Comprado</option>
                </select>
                <select
                  value={filtroPrioridade}
                  onChange={(e) => setFiltroPrioridade(e.target.value)}
                >
                  <option>Todas</option>
                  <option>Alta</option>
                  <option>Média</option>
                  <option>Baixa</option>
                </select>
                <select
                  value={filtroDepartamento}
                  onChange={(e) => setFiltroDepartamento(e.target.value)}
                >
                  <option>Todos</option>
                  {departamentosUnicos.map((dep) => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </div>

              {carregando ? (
                <p>Carregando...</p>
              ) : (
                <div className="lista">
                  {solicitacoesFiltradas.map((s) => (
                    <div key={s.id} className="item-lista">
                      <h3>{s.item}</h3>
                      <p><strong>Solicitante:</strong> {s.solicitante}</p>
                      <p><strong>Departamento:</strong> {s.departamento}</p>
                      <p><strong>Quantidade:</strong> {s.quantidade}</p>
                      <p><strong>Prioridade:</strong> {s.prioridade}</p>
                      <p><strong>Status:</strong> {s.status}</p>
                      <p><strong>Usuário:</strong> {s.userEmail || "-"}</p>

                      <p>
                        <strong>Link do produto 1:</strong>{" "}
                        {s.linkProduto1 ? (
                          <a href={s.linkProduto1} target="_blank" rel="noreferrer">Abrir link</a>
                        ) : "-"}
                      </p>

                      <p>
                        <strong>Link do produto 2:</strong>{" "}
                        {s.linkProduto2 ? (
                          <a href={s.linkProduto2} target="_blank" rel="noreferrer">Abrir link</a>
                        ) : "-"}
                      </p>

                      <p><strong>Data:</strong> {s.data || "-"}</p>
                      <p><strong>Data da solicitação:</strong> {s.dataCriacao}</p>
                      <p><strong>Justificativa:</strong> {s.justificativa}</p>

                      {s.motivoReprovacao && (
                        <p><strong>Motivo da reprovação:</strong> {s.motivoReprovacao}</p>
                      )}

                      <div className="acoes">
                        <button onClick={() => editarSolicitacao(s)}>Editar</button>
                        <button onClick={() => mudarStatus(s.id, "Pendente")}>Pendente</button>
                        <button onClick={() => mudarStatus(s.id, "Em análise")}>Em análise</button>
                        <button onClick={() => mudarStatus(s.id, "Aprovada")}>Aprovar</button>
                        <button onClick={() => mudarStatus(s.id, "Comprado")}>Comprado</button>
                        <button onClick={() => mudarStatus(s.id, "Reprovada")}>Reprovar</button>
                        <button onClick={() => excluirSolicitacao(s.id)} style={{ background: "#dc2626" }}>
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}

                  {solicitacoesFiltradas.length === 0 && (
                    <p>Nenhuma solicitação encontrada.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;