import { useCallback, useEffect, useMemo, useState } from "react";
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
  setDoc,
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
  const filtroStatus = "Todos";
  const filtroPrioridade = "Todas";
  const filtroDepartamento = "Todos";
  const [idEmEdicao, setIdEmEdicao] = useState(null);
  const [solicitacaoAbertaId, setSolicitacaoAbertaId] = useState(null);

  const [formulario, setFormulario] = useState(formularioInicial);
  const [role, setRole] = useState("funcionario");

  const [colaboradores, setColaboradores] = useState([]);
  const [carregandoColaboradores, setCarregandoColaboradores] = useState(false);
  const [rolesEditados, setRolesEditados] = useState({});
  const [colaboradorEmEdicao, setColaboradorEmEdicao] = useState(null);
  const [statusEditados, setStatusEditados] = useState({});
  const [mensagensColaboradores, setMensagensColaboradores] = useState({});

  const emailLogado = usuario?.email?.toLowerCase().trim();
  const isAdminFull = role === "admin_full";
  const isAdmin = role === "admin" || role === "admin_full";
  const isAprovador = role === "aprovador";
  const isComprador = role === "comprador";
  const podeAprovar = isAprovador || isAdminFull;
  const podeComprar = isComprador || isAdminFull;
  const podeExcluir = isAprovador || isAdminFull;

  
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
      const docSnap = await getDoc(docRef);

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
      console.error("Erro ao buscar usuário:", error);
      setUsuario(user);
      setRole("funcionario");
    } finally {
      setCarregando(false);
    }
  });

  return () => unsubscribe();    
}, []);

  const buscarColaboradores = useCallback(async function buscarColaboradores() {
  if (!isAdminFull) return;

  setCarregandoColaboradores(true);

  try {
    const snapshot = await getDocs(collection(db, "users"));

    const lista = snapshot.docs.map((d) => ({
      uid: d.id,
      email: d.data().email || "",
      role: d.data().role || "funcionario",
      ativo: d.data().ativo !== false,
    }));

    setColaboradores(lista);
  } catch (error) {
    console.error("Erro ao buscar colaboradores:", error);
    alert("Erro ao buscar colaboradores.");
  } finally {
    setCarregandoColaboradores(false);
  }
  }, [isAdminFull]);

  useEffect(() => {
    if (usuario) buscarSolicitacoes();
    else setSolicitacoes([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, role]);

  async function buscarSolicitacoes() {
    if (!usuario) return;
    setCarregando(true);

    try {
      let q;

  if (isAprovador || isAdminFull) {
    q = query(
    collection(db, "purchase_requests"),
    orderBy("data_criacao", "desc")
  );
  } else if (isComprador) {
    q = query(
      collection(db, "purchase_requests"),
      where("aprovada_aprovador", "==", true),
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
          aprovadaAprovador: item.aprovada_aprovador === true,
          analiseAprovadorFinalizada: item.analise_aprovador_finalizada === true,
        };
      });

      setSolicitacoes(
        isAprovador
          ? dadosTratados.filter(
              (s) =>
                !s.aprovadaAprovador &&
                !s.analiseAprovadorFinalizada &&
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

  useEffect(() => {
    if (paginaAtiva === "colaboradores" && isAdminFull) {
      buscarColaboradores();
    }
  }, [paginaAtiva, isAdminFull, buscarColaboradores]);

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
      !s.analiseAprovadorFinalizada &&
      !s.aprovadaAprovador &&
      !["Aprovada", "Comprado"].includes(s.status);

    return isAprovador || (solicitacaoDoUsuario && analiseAindaAberta);
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
    const aprovadorPodeAlterar = podeAprovar;

    const compradorPodeAlterar = 
    podeComprar && 
    (novoStatus === "Comprado" || novoStatus === "Reprovada");

    if (!aprovadorPodeAlterar && !compradorPodeAlterar) {
      alert("Você não tem permissão para alterar o status.");
      return;
    }

    const analiseFinalizadaAprovador =
      podeAprovar && (novoStatus === "Aprovada" || novoStatus === "Reprovada");
    const solicitacaoAtual = solicitacoes.find((s) => s.id === id);

    if (analiseFinalizadaAprovador) {
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

      if (novoStatus === "Aprovada" && podeAprovar) {
        dadosAtualizacao.aprovada_aprovador = true;
      }

      if (analiseFinalizadaAprovador) {
        dadosAtualizacao.analise_aprovador_finalizada = true;
      }

      try {
        await updateDoc(doc(db, "purchase_requests", id), dadosAtualizacao);
      } catch (erro) {
        alert("Erro ao salvar aprovação. Tente novamente.");
        console.error(erro);
        return;
      }

      if (analiseFinalizadaAprovador) {
        setSolicitacoes((prev) => prev.filter((s) => s.id !== id));
        setSolicitacaoAbertaId((prev) => (prev === id ? null : prev));
      }

      if (novoStatus === "Aprovada" && podeAprovar) {
      try{
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
            throw new Error("Slack respondeu com erro");
          }
        }
      } catch (erro) {
        alert("Solicitação aprovada, mas a notificação Slack falhou. Avise o Comprador manualmente.");
        console.error(erro);
      }
    }

    await buscarSolicitacoes();
  } catch (error) {
    alert("Erro ao alterar status");
    console.error(error);
  }
}


  async function salvarColaborador(uid, novoRole, ativo) {
    if (!isAdminFull) return; 

    try {
      await updateDoc(doc(db, "users", uid), {
        role: novoRole,
        ativo,
      });

      setColaboradores((prev) =>
        prev.map((c) =>
          c.uid === uid ? { ...c, role: novoRole, ativo } : c
        )
      );

      setRolesEditados((prev) => {
        const novo = { ...prev };
        delete novo[uid];
        return novo;
      });

      setStatusEditados((prev) => {
        const novo = { ...prev };
        delete novo[uid];
        return novo;
      });

      setMensagensColaboradores((prev) => ({
        ...prev,
        [uid]: "Salvo com sucesso!",
      }));

      setColaboradorEmEdicao(null);

    } catch (error) {
      console.error("Erro ao salvar colaborador:",error);
      alert("Erro ao salvar colaborador.");
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
            {isAprovador
              ? "Todas as solicitações"
              : isAdminFull || isComprador
              ? "Todas as Solicitações"
              : "Minhas solicitações"}
          </button>
          {isAdminFull && (
            <button className="menu-item" onClick={() => setPaginaAtiva("colaboradores")}>
              Colaboradores
            </button>
          )}
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

          {paginaAtiva === "colaboradores" && isAdminFull && (
          <div className="bloco">
          <h2>Colaboradores</h2>

          {carregandoColaboradores ? (
            <p>Carregando...</p>
            ) : (
            <div className="lista">
              {colaboradores.map((colaborador) => (
                <article key={colaborador.uid} className="item-lista">
                  <div className="colaborador-cabecalho">
                  <div>
                   <strong>{colaborador.email || colaborador.uid}</strong>
                   <p>{colaborador.ativo ? "Ativo" : "Desativado"}</p>
                  </div>

                  <button
                   type="button"
                   className="botao-editar-colaborador"
                  onClick={() => 
                    setColaboradorEmEdicao((uidAtual) =>
                      uidAtual === colaborador.uid ? null : colaborador.uid
                    )
                  }
                  title="Editar colaborador"
                  >
                    <i className="fi fi-rr-edit"></i>
                  </button>
                </div> 

                  {colaboradorEmEdicao === colaborador.uid && (
                   <>
                  <select
                   value={rolesEditados[colaborador.uid] || colaborador.role}
                   onChange={(e) =>
                    setRolesEditados((prev) => ({
                    ...prev,
                    [colaborador.uid]: e.target.value,
                    }))
                    }
                  >
                    <option value="funcionario">Funcionário</option>
                    <option value="admin_full">Admin Full</option>
                    <option value="aprovador">Aprovador</option>
                    <option value="comprador">Comprador</option>
                  </select>

                    <button
                     type="button"
                     onClick={() =>
                      setStatusEditados((prev) => ({
                      ...prev,
                     [colaborador.uid]: !(prev[colaborador.uid] ?? colaborador.ativo),
                      }))
                      }
                    >
                      {(statusEditados[colaborador.uid] ?? colaborador.ativo)
                      ? "Desativar"
                      : "Ativar"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        salvarColaborador(
                          colaborador.uid,
                          rolesEditados[colaborador.uid] || colaborador.role,
                          statusEditados[colaborador.uid] ?? colaborador.ativo
                        )
                      }
                    >
                      Salvar
                    </button>
                  </>
                  )}
                  {mensagensColaboradores[colaborador.uid] && (
                  <p>{mensagensColaboradores[colaborador.uid]}</p>
                  )}
                </article>
                ))}
                </div>
                )}
                </div>
          )}

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

                              {podeAprovar && (
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

                              {podeComprar && !podeAprovar && (
                                <>
                                  <button onClick={() => mudarStatus(s.id, "Comprado")}>
                                    Comprado
                                  </button>
                                  <button onClick={() => mudarStatus(s.id, "Reprovada")}>
                                    Reprovar
                                  </button>
                                </>
                              )}

                              {podeExcluir && (
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
