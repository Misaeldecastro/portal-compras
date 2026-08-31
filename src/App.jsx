import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./Login";
import SolicitacaoCard from "./components/SolicitacaoCard";
import FormularioSolicitacao from "./components/FormularioSolicitacao";
import ColaboradorItem from "./components/ColaboradorItem";
import { useColaboradores } from "./hooks/useColaboradores";
import { useSolicitacoes } from "./hooks/useSolicitacoes";
import {
  buscarEmailsPorRole,
  notificarNovaSolicitacaoSlack,
  notificarSolicitanteSlack,
} from "./services/slackApi";
import logo from "./assets/logo.png";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


async function getDocComRetry(docRef, tentativas = 3) {
  for (let i = 0; i < tentativas; i++) {
    try {
      return await getDoc(docRef);
    } catch (error) {
      if (error.code !== "unavailable" || i === tentativas - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
    }
  }
}

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
  const [tema, setTema] = useState(
    () => localStorage.getItem("tema") || "claro"
  );

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    localStorage.setItem("tema", tema);
  }, [tema]);

  function alternarTema() {
    setTema((atual) => (atual === "claro" ? "escuro" : "claro"));
  }

  const [usuario, setUsuario] = useState(null);
  const [paginaAtiva, setPaginaAtiva] = useState("dashboard");
  const [paginaAnterior, setPaginaAnterior] = useState(null);
  const [novaDireta, setNovaDireta] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [solicitacaoCriada, setSolicitacaoCriada] = useState(null);
  const [filtroStatusCard, setFiltroStatusCard] = useState(null);
  const [busca, setBusca] = useState("");
  const [pedidoBaseadoEmReprovada, setPedidoBaseadoEmReprovada] = useState(false);
  const [idEmEdicao, setIdEmEdicao] = useState(null);
  const [solicitacaoAbertaId, setSolicitacaoAbertaId] = useState(null);

  const [formulario, setFormulario] = useState(formularioInicial);
  const [role, setRole] = useState("funcionario");

  const formularioSujo = useMemo(() => {
    if (idEmEdicao !== null) return true;
    if (pedidoBaseadoEmReprovada) return true;
    return (
      formulario.solicitante !== formularioInicial.solicitante ||
      formulario.departamento !== formularioInicial.departamento ||
      formulario.item !== formularioInicial.item ||
      formulario.quantidade !== formularioInicial.quantidade ||
      formulario.prioridade !== formularioInicial.prioridade ||
      formulario.linkProduto1 !== formularioInicial.linkProduto1 ||
      formulario.linkProduto2 !== formularioInicial.linkProduto2 ||
      formulario.data !== formularioInicial.data ||
      formulario.justificativa !== formularioInicial.justificativa
    );
  }, [formulario, idEmEdicao, pedidoBaseadoEmReprovada]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!formularioSujo) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePopState = () => {
      if (!formularioSujo) return;
      const confirmado = window.confirm(
        "Tem certeza que deseja sair desta solicitação e limpar tudo?"
      );
      if (!confirmado) {
        window.history.pushState(null, "", window.location.href);
        return;
      }
      limparFormulario();
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [formularioSujo]);

  const emailLogado = usuario?.email?.toLowerCase().trim();
  const isAdminFull = role === "admin_full";
  const isAdmin = role === "admin" || role === "admin_full";
  const isAprovador = role === "aprovador";
  const isComprador = role === "comprador";
  const podeAprovar = isAprovador || isAdminFull;

  const {
    colaboradores,
    carregandoColaboradores,
    rolesEditados,
    setRolesEditados,
    colaboradorEmEdicao,
    setColaboradorEmEdicao,
    statusEditados,
    setStatusEditados,
    mensagensColaboradores,
    buscarColaboradores,
    salvarColaborador,
  } = useColaboradores({ isAdminFull });
  const podeComprar = isComprador || isAdminFull;
  const podeExcluir = isAprovador || isAdminFull;

  const {
    solicitacoes,
    statusEmAndamento,
    buscarSolicitacoes,
    excluirSolicitacao,
    mudarStatus,
  } = useSolicitacoes({
    usuario,
    role,
    isAprovador,
    isAdminFull,
    isComprador,
    podeAprovar,
    podeComprar,
    setCarregando,
    onExcluida: (id) => {
      if (idEmEdicao === id) limparFormulario();
    },
    onRemovidaDaLista: (id) =>
      setSolicitacaoAbertaId((prev) => (prev === id ? null : prev)),
  });


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const cadastroEmAndamento =
        sessionStorage.getItem("cadastroEmAndamento") === "true";

      if (cadastroEmAndamento) {
        if (user) {
          await signOut(auth);
        }

        setUsuario(null);
        setRole("funcionario");
        setCarregando(false);
        return;
      }

    if (!user) {
        setUsuario(null);
        setRole("funcionario");
        setCarregando(false);
        return;
    }

    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDocComRetry(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          email: user.email,
          role: "funcionario",
          ativo: true,
          createdAt: serverTimestamp(),
        });
        
        setRole("funcionario");
      } else {
        const dadosUsuario = docSnap.data();

        if (dadosUsuario.ativo === false) {
          alert("Seu acesso ao portal está desativado.");
          await signOut(auth);
          setUsuario(null);
          setRole("funcionario");
          return;
        }

        setRole(dadosUsuario.role || "funcionario");
      }

      setUsuario(user);
    } catch (error) {
      console.error("Erro ao buscar usuário:", error.code, "|", error.message);
      setUsuario(user);
      setRole("funcionario");
    } finally {
      setCarregando(false);
    }
  });

  return () => unsubscribe();    
}, []);


  useEffect(() => {
    if (paginaAtiva === "colaboradores" && isAdminFull) {
      buscarColaboradores();
    }
  }, [paginaAtiva, isAdminFull, buscarColaboradores]);

  function alterarFormulario(e) {
    const { name, value } = e.target;
    setFormulario((prev) => ({ ...prev, [name]: value }));
  }

  function limparFormulario(options = {}) {
    const { keepNovaDireta = false } = options;

    setFormulario(formularioInicial);
    setIdEmEdicao(null);
    setPedidoBaseadoEmReprovada(false);

    if (!keepNovaDireta) {
      setNovaDireta(false);
      setPaginaAnterior(null);
    }
  }

  function cancelarFormulario() {
    if (!formularioSujo) {
      alert("Esse formulário já está limpo");
      return;
    }

    if (!window.confirm("Tem certeza que deseja limpar o formulário?")) return;

    limparFormulario({ keepNovaDireta: true });

    if (!novaDireta) {
      setPaginaAtiva(paginaAnterior || "minhas");
      setPaginaAnterior(null);
    }
  }

  function confirmarSaidaFormulario() {
    if (!formularioSujo) return true;
    const confirmado = window.confirm(
      "Tem certeza que deseja sair desta solicitação e limpar tudo?"
    );
    if (!confirmado) return false;
    limparFormulario();
    return true;
  }

  function navegarParaPagina(pagina) {
    if (!confirmarSaidaFormulario()) return;
    if (pagina === "nova") {
      setNovaDireta(true);
      setPaginaAnterior(null);
    }
    setPaginaAtiva(pagina);
  }

  async function sair() {
    if (!confirmarSaidaFormulario()) return;
    const confirmarSaida = window.confirm("Deseja realmente sair?");
    if (!confirmarSaida) return;
    await signOut(auth);
    setUsuario(null);
  }

  function podeEditarSolicitacao(s) {
    const emailSolicitante = s.userEmail?.toLowerCase().trim();
    const solicitacaoDoUsuario =
      emailSolicitante === emailLogado || s.userId === usuario?.uid;
    const analiseAindaAberta =
      !s.analiseAprovadorFinalizada &&
      !s.aprovadaAprovador &&
      !["Aprovada", "Comprado"].includes(s.status);

    return isAprovador || (solicitacaoDoUsuario && analiseAindaAberta);
  }

  function exportarCSV() {
  const agora = new Date();
  const timestamp = agora.toLocaleString("sv").replace(/[: ]/g, "-");
  const cabecalho = "Solicitante,Departamento,Item,Status,Prioridade,Data\n";


  const linhas = solicitacoesFiltradas.map(
    (s) => `${s.solicitante},${s.departamento},${s.item},${s.status},${s.prioridade},${s.dataCriacao}`
  );

  const csv = cabecalho + linhas.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `solicitacoes-${timestamp}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

function exportarPDF() {
  const agora = new Date();
  const timestamp = agora.toLocaleString("sv").replace(/[: ]/g, "-");

  const documento = new jsPDF();

  autoTable(documento, {
    head: [["Solicitante", "Departamento", "Item", "Status", "Prioridade", "Data"]],
    body: solicitacoesFiltradas.map((s) => [
      s.solicitante,
      s.departamento,
      s.item,
      s.status,
      s.prioridade,
      s.dataCriacao,
    ]),
  });

  documento.save(`solicitacoes-${timestamp}.pdf`);
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
          analise_aprovador_finalizada: false,
          user_id: usuario.uid,
          user_email: usuario.email,
          data_criacao: serverTimestamp(),
        });

        const linkAnalise = `${window.location.origin}/solicitacao/${docRef.id}`;

        try {
          const aprovadorEmails = await buscarEmailsPorRole(usuario, "aprovador");

          const respostaSlack = await notificarNovaSolicitacaoSlack({
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
            destinatariosEmails: aprovadorEmails,
          });

          if (!respostaSlack.ok) {
            const erroTexto = await respostaSlack.text();
            console.error("Erro ao enviar para o Slack:", erroTexto);
          }
        } catch (erroSlack) {
          console.error("Erro ao chamar /api/slack:", erroSlack);
        }

        try {
          await notificarSolicitanteSlack({
            idSolicitacao: docRef.id,
            item: payload.item,
            solicitante: payload.solicitante,
            userEmail: usuario.email,
            status: "Pendente",
          });
        } catch (erroSlack) {
          alert("Solicitação enviada, mas a notificação Slack ao solicitante falhou.");
          console.error("Erro ao notificar solicitante:", erroSlack);
        }

       setSolicitacaoCriada({ id: docRef.id, item: payload.item });

      }

      const eraEdicao = Boolean(idEmEdicao);

      limparFormulario();
      await buscarSolicitacoes();
      setPaginaAtiva(eraEdicao ? "minhas" : "sucesso");

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
    setNovaDireta(false);
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
    setPaginaAnterior(paginaAtiva);
    setPaginaAtiva("nova");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pedirNovamente(s) {
    setIdEmEdicao(null);
    setNovaDireta(false);
    setPedidoBaseadoEmReprovada(s.status === "Reprovada");

    setFormulario({
      solicitante: s.solicitante,
      departamento: s.departamento,
      item: s.item,
      quantidade: s.quantidade,
      prioridade: s.prioridade,
      linkProduto1: s.linkProduto1,
      linkProduto2: s.linkProduto2,
      data: "",
      justificativa: s.justificativa,
    });

    setPaginaAnterior(paginaAtiva);
    setPaginaAtiva("nova");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const solicitacoesFiltradas = useMemo(() => {
    return solicitacoes.filter((s) => {
      const texto = busca.toLowerCase();

      const bateBusca =
        s.solicitante.toLowerCase().includes(texto) ||
        s.departamento.toLowerCase().includes(texto) ||
        s.item.toLowerCase().includes(texto);

      const bateStatus = !filtroStatusCard || s.status === filtroStatusCard;

      return bateBusca && bateStatus;
    });
  }, [solicitacoes, busca, filtroStatusCard]);


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
          <button className="menu-item" onClick={() => navegarParaPagina("dashboard")}>
            Dashboard
          </button>
          <button className="menu-item" onClick={() => navegarParaPagina("nova")}>
            Fazer uma Solicitação
          </button>
          <button className="menu-item" onClick={() => navegarParaPagina("minhas")}>
            {isAprovador
              ? "Todas as solicitações"
              : isAdminFull || isComprador
              ? "Todas as Solicitações"
              : "Minhas solicitações"}
          </button>
          {isAdminFull && (
            <button className="menu-item" onClick={() => navegarParaPagina("colaboradores")}>
              Colaboradores
            </button>
          )}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <h1>Portal de Solicitações</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" className="botao-secundario" onClick={alternarTema}>
              {tema === "claro" ? "Tema escuro" : "Tema claro"}
            </button>
            <button
              onClick={async () => {
                await sair();
              }}
            >
              Sair
            </button>
          </div>
        </header>

        <main className="content">
          <p className="subtitulo">
            Usuário logado: <strong>{usuario.email}</strong>
            {isAdmin && <strong> — Admin</strong>}
          </p>

          {paginaAtiva === "colaboradores" && isAdminFull && (
            <div className="bloco">
              <h2>Colaboradores</h2>

              {carregandoColaboradores ? (
                <p>Carregando...</p>
              ) : (
                <div className="lista">
                  {colaboradores.map((colaborador) => (
                    <ColaboradorItem
                      key={colaborador.uid}
                      colaborador={colaborador}
                      emEdicao={colaboradorEmEdicao === colaborador.uid}
                      roleEditado={rolesEditados[colaborador.uid]}
                      statusEditado={statusEditados[colaborador.uid]}
                      mensagem={mensagensColaboradores[colaborador.uid]}
                      onToggleEdicao={() =>
                        setColaboradorEmEdicao((uidAtual) =>
                          uidAtual === colaborador.uid ? null : colaborador.uid
                        )
                      }
                      onChangeRole={(novoRole) =>
                        setRolesEditados((prev) => ({
                          ...prev,
                          [colaborador.uid]: novoRole,
                        }))
                      }
                      onToggleStatus={() =>
                        setStatusEditados((prev) => ({
                          ...prev,
                          [colaborador.uid]: !(
                            prev[colaborador.uid] ?? colaborador.ativo
                          ),
                        }))
                      }
                      onSalvar={(novoRole, ativo) =>
                        salvarColaborador(colaborador.uid, novoRole, ativo)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

{paginaAtiva === "dashboard" && (
  <div className="cards">
    <div
      className="card"
      onClick={() => {
        setFiltroStatusCard(null);
        navegarParaPagina("minhas");
      }}
    >
      <h3>Total</h3>
      <strong>{total}</strong>
    </div>
    <div
      className="card"
      onClick={() => {
        setFiltroStatusCard("Pendente");
        navegarParaPagina("minhas");
      }}
    >
      <h3>Pendentes</h3>
      <strong>{pendentes}</strong>
    </div>
    <div
      className="card"
      onClick={() => {
        setFiltroStatusCard("Em análise");
        navegarParaPagina("minhas");
      }}
    >
      <h3>Em análise</h3>
      <strong>{emAnalise}</strong>
    </div>
    <div
      className="card"
      onClick={() => {
        setFiltroStatusCard("Aprovada");
        navegarParaPagina("minhas");
      }}
    >
      <h3>Aprovadas</h3>
      <strong>{aprovadas}</strong>
    </div>
    <div
      className="card"
      onClick={() => {
        setFiltroStatusCard("Comprado");
        navegarParaPagina("minhas");
      }}
    >
      <h3>Compradas</h3>
      <strong>{compradas}</strong>
    </div>
  </div>
)}


          {paginaAtiva === "nova" && (
            <FormularioSolicitacao
              formulario={formulario}
              onChange={alterarFormulario}
              onSubmit={enviarSolicitacao}
              salvando={salvando}
              idEmEdicao={idEmEdicao}
              pedidoBaseadoEmReprovada={pedidoBaseadoEmReprovada}
              novaDireta={novaDireta}
              onCancelar={cancelarFormulario}
            />
          )}
          {paginaAtiva === "sucesso" && solicitacaoCriada && (
  <div className="bloco">
    <h2>Solicitação enviada!</h2>
    <p>Seu pedido foi recebido e está em análise. Você será notificado sobre o andamento.</p>
    <p><strong>Item:</strong> {solicitacaoCriada.item}</p>

    <div className="acoes-formulario">
      <button
        type="button"
        onClick={() => {
          setSolicitacaoAbertaId(solicitacaoCriada.id);
          setSolicitacaoCriada(null);
          setPaginaAtiva("minhas");
        }}
      >
        Ver minha solicitação
      </button>
      <button
        type="button"
        onClick={() => {
          setSolicitacaoCriada(null);
          setPaginaAtiva("nova");
        }}
      >
        Nova solicitação
      </button>
    </div>
  </div>
)}


          {paginaAtiva === "minhas" && (
            <div className="bloco">
              <h2>
               {isAprovador
                ? "Todas as solicitações"
                : isAdminFull || isComprador
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

              <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
                <button type="button" onClick={exportarCSV}>
                  Exportar CSV
                </button>         
                <button type="button" onClick={exportarPDF}>
                  Exportar PDF
                </button>
              </div>


              {filtroStatusCard && (
                <p>
                  Mostrando apenas: <strong>{filtroStatusCard}</strong>{" "}
                  <button onClick={() => setFiltroStatusCard(null)}>Limpar filtro</button>
                </p>
            )}

              {carregando ? (
                <p>Carregando...</p>
              ) : (
                <div className="lista">
                  {solicitacoesFiltradas.map((s) => (
                    <SolicitacaoCard
                      key={s.id}
                      solicitacao={s}
                      estaAberta={solicitacaoAbertaId === s.id}
                      onToggle={() =>
                        setSolicitacaoAbertaId(
                          solicitacaoAbertaId === s.id ? null : s.id
                        )
                      }
                      podeEditar={podeEditarSolicitacao(s)}
                      podeAprovar={podeAprovar}
                      podeExcluir={podeExcluir}
                      isComprador={isComprador}
                      isAdminFull={isAdminFull}
                      emAndamento={statusEmAndamento.has(s.id)}
                      onPedirNovamente={pedirNovamente}
                      onEditar={editarSolicitacao}
                      onMudarStatus={mudarStatus}
                      onExcluir={excluirSolicitacao}
                    />
                  ))}

                  {solicitacoesFiltradas.length === 0 && (
                    busca ? (
                      <div>
                        <p>Nenhuma solicitação encontrada para este filtro.</p>
                        <button onClick={() => setBusca("")}>Limpar filtros</button>
                      </div>
                    ) : isAprovador || isComprador ? (
                      <div>
                        <p>Tudo em dia! Nenhuma solicitação pendente de revisão.</p>
                      </div>
                    ) : (
                      <div>
                        <p>Você não tem nenhuma solicitação.</p>
                        <button onClick={() => navegarParaPagina("nova")}>
                          Criar primeira solicitação
                        </button>
                      </div>
                      )
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
