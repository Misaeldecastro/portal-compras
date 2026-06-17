import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
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

function limparTexto(texto) {
  return String(texto || "").trim();
}


function validarFormulario(form) {
  const solicitante = limparTexto(form.solicitante);
  const departamento = limparTexto(form.departamento);
  const item = limparTexto(form.item);
  const justificativa = limparTexto(form.justificativa);

  if (!justificativa) return "Informe a justificativa.";

  const quantidade = Number(form.quantidade);

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return "Informe uma quantidade válida.";
  }

  if (!limparTexto(form.linkProduto1)) {
    return "Informe o link do produto 1.";
  }

  if (solicitante.length > 100) return "Nome do solicitante muito longo.";
  if (departamento.length > 100) return "Departamento muito longo.";
  if (!solicitante) return "Informe o solicitante.";
  if (!departamento) return "Informe o departamento.";

  if (item.length < 3) {
    return "Descreva o item com pelo menos 3 caracteres.";
  }

  if (item.length > 200) {
    return "Descrição muito longa. Máximo de 200 caracteres.";
  }

  if (justificativa.length > 500) {
    return "Justificativa muito longa. Máximo de 500 caracteres.";
  }

  if (!form.data) {
    return "Informe o prazo.";
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const prazo = new Date(`${form.data}T00:00:00`);

  if (prazo < hoje) {
    return "O prazo não pode ser uma data no passado.";
  }

  return null;
}

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
  const [solicitacaoAbertaId, setSolicitacaoAbertaId] = useState(null);

  const [formulario, setFormulario] = useState(formularioInicial);

  const emailLogado = usuario?.email?.toLowerCase().trim();
  const isMisael = emailLogado === "m.castro@oliv-e.health";
  const isLucas = emailLogado === "l.andrade@oliv-e.health";
  const isJoao = emailLogado === "j.furlan@oliv-e.health";

  const isAdmin = isMisael || isLucas || isJoao;

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
  }, [usuario, isAdmin]);

  async function buscarSolicitacoes() {
    if (!usuario) return;
    setCarregando(true);

    try {
      let q;

  if (isLucas) {
    q = query(
    collection(db, "purchase_requests"),
    orderBy("data_criacao", "desc")
  );
  } else if (isJoao) {
    q = query(
      collection(db, "purchase_requests"),
      where("aprovada_lucas", "==", true),
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
          userId: item.user_id || "",
          userEmail: item.user_email || "",
          aprovadaLucas: item.aprovada_lucas === true,
          analiseLucasFinalizada: item.analise_lucas_finalizada === true,
        };
      });

      setSolicitacoes(
        isLucas
          ? dadosTratados.filter(
              (s) =>
                !s.aprovadaLucas &&
                !s.analiseLucasFinalizada &&
                !["Aprovada", "Reprovada", "Comprado"].includes(s.status)
            )
          : dadosTratados
      );
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

  function podeEditarSolicitacao(s) {
    const emailSolicitante = s.userEmail?.toLowerCase().trim();
    const solicitacaoDoUsuario =
      emailSolicitante === emailLogado || s.userId === usuario?.uid;
    const analiseAindaAberta =
      !s.analiseLucasFinalizada &&
      !s.aprovadaLucas &&
      !["Aprovada", "Comprado"].includes(s.status);

    return isLucas || (solicitacaoDoUsuario && analiseAindaAberta);
  }

  async function enviarSolicitacao(e) {
    e.preventDefault();
    if (!usuario) return alert("Você precisa estar logado.");

    const erro = validarFormulario(formulario);

  if (erro) {
    alert(erro);
  return;
  }

    setSalvando(true);

  const payload = {
    solicitante: limparTexto(formulario.solicitante),
    departamento: limparTexto(formulario.departamento),
    item: limparTexto(formulario.item),
    quantidade: Number(formulario.quantidade),
    prioridade: formulario.prioridade,
    link_produto_1: limparTexto(formulario.linkProduto1),
    link_produto_2: limparTexto(formulario.linkProduto2),
    data: formulario.data || null,
    justificativa: limparTexto(formulario.justificativa),
  };

    try {
      if (idEmEdicao) {
        const solicitacaoAtual = solicitacoes.find((s) => s.id === idEmEdicao);

        if (!solicitacaoAtual || !podeEditarSolicitacao(solicitacaoAtual)) {
          alert("Voce nao tem permissao para editar esta solicitacao.");
          return;
        }

        await updateDoc(doc(db, "purchase_requests", idEmEdicao), payload);
        alert("Solicitação atualizada com sucesso!");
      } else {
        const docRef = await addDoc(collection(db, "purchase_requests"), {
          ...payload,
          status: "Pendente",
          motivo_reprovacao: "",
          analise_lucas_finalizada: false,
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
        solicitante: limparTexto(formulario.solicitante),
        departamento: limparTexto(formulario.departamento),
        item: limparTexto(formulario.item),
        quantidade: Number(formulario.quantidade),
        prioridade: limparTexto(formulario.prioridade),
        linkProduto1: limparTexto(formulario.linkProduto1),
        linkProduto2: limparTexto(formulario.linkProduto2),
        data: formulario.data || "",
        justificativa: limparTexto(formulario.justificativa),
        idSolicitacao: docRef.id,
        linkAnalise,
        }),
          });

          if (!respostaSlack.ok) {
            const erroTexto = await respostaSlack.text();
            console.error("Erro ao enviar para o Slack:", erroTexto);
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
    if (!podeEditarSolicitacao(s)) {
      alert("Voce nao tem permissao para editar esta solicitacao.");
      return;
    }

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

  function pedirNovamente(s) {
    setIdEmEdicao(null);

    setFormulario({
      solicitante: s.solicitante,
      departamento: s.departamento,
      item: s.item,
      quantidade: s.quantidade,
      prioridade: s.prioridade,
      linkProduto1: s.linkProduto1,
      linkProduto2: s.linkProduto2,
      data: s.data || "",
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
    const lucasPodeAlterar = isLucas;

    const misaelOuJoaoPodeAlterar =
      isJoao &&
      (novoStatus === "Comprado" || novoStatus === "Reprovada");

    if (!lucasPodeAlterar && !misaelOuJoaoPodeAlterar) {
      alert("Você não tem permissão para alterar o status.");
      return;
    }

    const analiseFinalizadaLucas =
      isLucas && (novoStatus === "Aprovada" || novoStatus === "Reprovada");
    const solicitacaoAtual = solicitacoes.find((s) => s.id === id);

    if (analiseFinalizadaLucas) {
      const acao = novoStatus === "Aprovada" ? "aprovar" : "reprovar";
      const nomeSolicitacao = solicitacaoAtual?.item
        ? ` "${solicitacaoAtual.item}"`
        : "";

      const confirmado = window.confirm(
        `Tem certeza que deseja ${acao} esta solicitação${nomeSolicitacao}? Depois disso ela sairá da sua lista.`
      );

      if (!confirmado) return;
    }

    let motivo = "";

    if (novoStatus === "Reprovada") {
      const r = window.prompt("Digite o motivo da reprovação:");
      if (r === null) return;
      motivo = r;
    }

    try {
      const dadosAtualizacao = {
        status: novoStatus,
        motivo_reprovacao: novoStatus === "Reprovada" ? motivo : "",
      };

      if (novoStatus === "Aprovada" && isLucas) {
        dadosAtualizacao.aprovada_lucas = true;
      }

      if (analiseFinalizadaLucas) {
        dadosAtualizacao.analise_lucas_finalizada = true;
      }

      await updateDoc(doc(db, "purchase_requests", id), dadosAtualizacao);

      if (analiseFinalizadaLucas) {
        setSolicitacoes((prev) => prev.filter((s) => s.id !== id));
        setSolicitacaoAbertaId((prev) => (prev === id ? null : prev));
      }

      if (novoStatus === "Aprovada" && isLucas) {
        const snapAtualizado = await getDoc(doc(db, "purchase_requests", id));
        const dadosAtualizados = snapAtualizado.exists()
          ? snapAtualizado.data()
          : null;
        const solicitacaoParaSlack = dadosAtualizados
          ? {
              id,
              solicitante: dadosAtualizados.solicitante || "",
              departamento: dadosAtualizados.departamento || "",
              item: dadosAtualizados.item || "",
              quantidade: dadosAtualizados.quantidade || 0,
              prioridade: dadosAtualizados.prioridade || "",
              linkProduto1: dadosAtualizados.link_produto_1 || "",
              linkProduto2: dadosAtualizados.link_produto_2 || "",
              data: dadosAtualizados.data || "",
              justificativa: dadosAtualizados.justificativa || "",
              status: novoStatus,
            }
          : solicitacaoAtual
          ? {
              ...solicitacaoAtual,
              status: novoStatus,
            }
          : null;

        if (solicitacaoParaSlack) {
          const respostaSlack = await fetch("/api/slack-aprovado", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(solicitacaoParaSlack),
          });

          if (!respostaSlack.ok) {
            const erroTexto = await respostaSlack.text();
            console.error("Erro ao enviar aprovação para slack:", erroTexto);
          }
        }
      }

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
            Fazer uma Solicitação
          </button>
          <button className="menu-item" onClick={() => setPaginaAtiva("minhas")}>
            {isLucas
              ? "Todas as solicitações"
              : isMisael || isJoao
              ? "Todas as Solicitações"
              : "Minhas solicitações"}
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
            {isAdmin && <strong> — Admin</strong>}
          </p>

          {paginaAtiva === "dashboard" && (
            <div className="cards">
              <div className="card">
                <h3>Total</h3>
                <strong>{total}</strong>
              </div>
              <div className="card">
                <h3>Pendentes</h3>
                <strong>{pendentes}</strong>
              </div>
              <div className="card">
                <h3>Em análise</h3>
                <strong>{emAnalise}</strong>
              </div>
              <div className="card">
                <h3>Aprovadas</h3>
                <strong>{aprovadas}</strong>
              </div>
              <div className="card">
                <h3>Compradas</h3>
                <strong>{compradas}</strong>
              </div>
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


                <div className="campo-form">
                  <label>Prazo</label>
                  <input
                  name="data"
                  type="date"
                  value={formulario.data}
                  onChange={alterarFormulario}
                  required
                />
                </div>

                

                <div className="acoes-formulario">
                  <button type="submit" disabled={salvando}>
                    {salvando
                      ? "Salvando..."
                      : idEmEdicao
                      ? "Salvar edição"
                      : "Enviar solicitação"}
                  </button>

                  {idEmEdicao && (
                    <button
                      type="button"
                      onClick={limparFormulario}
                      className="botao-secundario"
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {paginaAtiva === "minhas" && (
            <div className="bloco">
              <h2>
               {isLucas
                ? "Todas as solicitações"
                : isMisael || isJoao
                ? "Todas as solicitações"
                : "Minhas solicitações"}
              </h2>

              <div className="filtros filtros-4">
                <input
                  placeholder="Buscar solicitação"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>

              {carregando ? (
                <p>Carregando...</p>
              ) : (
                <div className="lista">
                  {solicitacoesFiltradas.map((s) => {
                    const estaAberta = solicitacaoAbertaId === s.id;
                    const podeEditar = podeEditarSolicitacao(s);
                    const statusNormalizado = (s.status || "").toLowerCase();
                    const statusClasse =
                      statusNormalizado === "comprado"
                        ? "comprado"
                        : statusNormalizado === "pendente"
                        ? "pendente"
                        : ["reprovada", "reprovado", "recusada", "recusado"].includes(
                            statusNormalizado
                          )
                        ? "recusado"
                        : "neutro";

                    return (
                      <article
                        key={s.id}
                        className={`item-lista item-lista-acordeao ${
                          estaAberta ? "aberto" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="titulo-solicitacao"
                          onClick={() =>
                            setSolicitacaoAbertaId(estaAberta ? null : s.id)
                          }
                          aria-expanded={estaAberta}
                          aria-controls={`detalhes-${s.id}`}
                        >
                          <span className="cabecalho-solicitacao">
                            <span className="nome-solicitacao">
                              {s.item || "Solicitação sem título"}
                            </span>
                            <span className={`selo-status ${statusClasse}`}>
                              {s.status || "Sem status"}
                            </span>
                          </span>
                        </button>

                        {estaAberta && (
                          <div
                            id={`detalhes-${s.id}`}
                            className="conteudo-solicitacao"
                          >
                            <div className="detalhes-solicitacao">
                              <div className="campo-detalhe">
                                <span>Solicitante</span>
                                <strong>{s.solicitante || "-"}</strong>
                              </div>
                              <div className="campo-detalhe">
                                <span>Departamento</span>
                                <strong>{s.departamento || "-"}</strong>
                              </div>
                              <div className="campo-detalhe">
                                <span>Quantidade</span>
                                <strong>{s.quantidade}</strong>
                              </div>
                              <div className="campo-detalhe">
                                <span>Prioridade</span>
                                <strong>{s.prioridade || "-"}</strong>
                              </div>
                              <div className="campo-detalhe">
                                <span>Status</span>
                                <strong>{s.status || "-"}</strong>
                              </div>
                              <div className="campo-detalhe">
                                <span>Usuário</span>
                                <strong>{s.userEmail || "-"}</strong>
                              </div>
                              <div className="campo-detalhe">
                                <span>Link do produto 1</span>
                                <strong>
                                  {s.linkProduto1 ? (
                                    <a
                                      href={s.linkProduto1}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Abrir link
                                    </a>
                                  ) : (
                                    "-"
                                  )}
                                </strong>
                              </div>
                              <div className="campo-detalhe">
                                <span>Link do produto 2</span>
                                <strong>
                                  {s.linkProduto2 ? (
                                    <a
                                      href={s.linkProduto2}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Abrir link
                                    </a>
                                  ) : (
                                    "-"
                                  )}
                                </strong>
                              </div>
                              <div className="campo-detalhe">
                                <span>Data</span>
                                <strong>{s.data || "-"}</strong>
                              </div>
                              <div className="campo-detalhe">
                                <span>Data da solicitação</span>
                                <strong>{s.dataCriacao || "-"}</strong>
                              </div>
                              <div className="campo-detalhe campo-detalhe-longo">
                                <span>Justificativa</span>
                                <strong>{s.justificativa || "-"}</strong>
                              </div>

                              {s.motivoReprovacao && (
                                <div className="campo-detalhe campo-detalhe-longo">
                                  <span>Motivo da reprovação</span>
                                  <strong>{s.motivoReprovacao}</strong>
                                </div>
                              )}
                            </div>

                            <div className="acoes">
                              <button onClick={() => pedirNovamente(s)}>
                                Pedir novamente
                              </button>

                              {podeEditar && (
                                <button onClick={() => editarSolicitacao(s)}>
                                  Editar
                                </button>
                              )}

                              {isLucas && (
                                <>
                                  <button onClick={() => mudarStatus(s.id, "Pendente")}>
                                    Pendente
                                  </button>
                                  <button onClick={() => mudarStatus(s.id, "Em análise")}>
                                    Em análise
                                  </button>
                                  <button onClick={() => mudarStatus(s.id, "Aprovada")}>
                                    Aprovar
                                  </button>
                                  <button onClick={() => mudarStatus(s.id, "Comprado")}>
                                    Comprado
                                  </button>
                                  <button onClick={() => mudarStatus(s.id, "Reprovada")}>
                                    Reprovar
                                  </button>
                                </>
                              )}

                              {isJoao && (
                                <>
                                  <button onClick={() => mudarStatus(s.id, "Comprado")}>
                                    Comprado
                                  </button>
                                  <button onClick={() => mudarStatus(s.id, "Reprovada")}>
                                    Reprovar
                                  </button>
                                </>
                              )}

                              {isLucas && (
                                <button
                                  onClick={() => excluirSolicitacao(s.id)}
                                  style={{ background: "#dc2626" }}
                                >
                                  Excluir
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}

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
