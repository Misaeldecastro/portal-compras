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

const formularioInicial = {
  solicitante: "",
  departamento: "",
  centroCusto: "",
  item: "",
  quantidade: 1,
  valor: "",
  urgencia: "Média",
  fornecedor: "",
  linkProduto: "",
  prazoNecessario: "",
  justificativa: "",
  observacoes: "",
};

function App() {
  const [usuario, setUsuario] = useState(null);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [filtroUrgencia, setFiltroUrgencia] = useState("Todas");
  const [filtroDepartamento, setFiltroDepartamento] = useState("Todos");
  const [idEmEdicao, setIdEmEdicao] = useState(null);

  const [formulario, setFormulario] = useState(formularioInicial);

  useEffect(() => {
  if (usuario) {
    console.log("UID logado:", usuario.uid);
  }
  }, [usuario]);


  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user || null);
      setCarregando(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (usuario) {
      buscarSolicitacoes();
    } else {
      setSolicitacoes([]);
    }
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
          solicitante: item.solicitante,
          departamento: item.departamento,
          centroCusto: item.centro_custo,
          item: item.item,
          quantidade: item.quantidade,
          valor: item.valor,
          urgencia: item.urgencia,
          status: item.status,
          fornecedor: item.fornecedor || "",
          linkProduto: item.link_produto || "",
          prazoNecessario: item.prazo_necessario || "",
          justificativa: item.justificativa,
          observacoes: item.observacoes || "",
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

    if (!usuario) {
      alert("Você precisa estar logado.");
      return;
    }

    setSalvando(true);

    const payload = {
      solicitante: formulario.solicitante,
      departamento: formulario.departamento,
      centro_custo: formulario.centroCusto,
      item: formulario.item,
      quantidade: Number(formulario.quantidade),
      valor: Number(formulario.valor),
      urgencia: formulario.urgencia,
      fornecedor: formulario.fornecedor,
      link_produto: formulario.linkProduto,
      prazo_necessario: formulario.prazoNecessario || null,
      justificativa: formulario.justificativa,
      observacoes: formulario.observacoes,
    };

    try {
      if (idEmEdicao) {
        await updateDoc(doc(db, "purchase_requests", idEmEdicao), payload);
        alert("Solicitação atualizada com sucesso!");
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
      buscarSolicitacoes();
    } catch (error) {
      alert(idEmEdicao ? "Erro ao editar" : "Erro ao salvar");
      console.error(error);
    } finally {
      setSalvando(false);
    }
  }

  function editarSolicitacao(solicitacao) {
    setIdEmEdicao(solicitacao.id);
    setFormulario({
      solicitante: solicitacao.solicitante,
      departamento: solicitacao.departamento,
      centroCusto: solicitacao.centroCusto,
      item: solicitacao.item,
      quantidade: solicitacao.quantidade,
      valor: solicitacao.valor,
      urgencia: solicitacao.urgencia,
      fornecedor: solicitacao.fornecedor,
      linkProduto: solicitacao.linkProduto,
      prazoNecessario: solicitacao.prazoNecessario,
      justificativa: solicitacao.justificativa,
      observacoes: solicitacao.observacoes,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluirSolicitacao(id) {
    const confirmar = window.confirm(
      "Tem certeza que deseja excluir esta solicitação?"
    );

    if (!confirmar || !usuario) return;

    try {
      await deleteDoc(doc(db, "purchase_requests", id));

      if (idEmEdicao === id) {
        limparFormulario();
      }

      buscarSolicitacoes();
    } catch (error) {
      alert("Erro ao excluir");
      console.error(error);
    }
  }

  async function mudarStatus(id, novoStatus) {
    if (!usuario) return;

    let motivo = "";

    if (novoStatus === "Reprovada") {
      const resposta = window.prompt("Digite o motivo da reprovação:");
      if (resposta === null) return;
      motivo = resposta;
    }

    try {
      await updateDoc(doc(db, "purchase_requests", id), {
        status: novoStatus,
        motivo_reprovacao: novoStatus === "Reprovada" ? motivo : "",
      });

      buscarSolicitacoes();
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
        s.item.toLowerCase().includes(texto) ||
        s.centroCusto.toLowerCase().includes(texto) ||
        (s.fornecedor || "").toLowerCase().includes(texto);

      const bateStatus = filtroStatus === "Todos" || s.status === filtroStatus;

      const bateUrgencia =
        filtroUrgencia === "Todas" || s.urgencia === filtroUrgencia;

      const bateDepartamento =
        filtroDepartamento === "Todos" ||
        s.departamento === filtroDepartamento;

      return bateBusca && bateStatus && bateUrgencia && bateDepartamento;
    });
  }, [solicitacoes, busca, filtroStatus, filtroUrgencia, filtroDepartamento]);

  const departamentosUnicos = useMemo(() => {
    const lista = solicitacoes.map((s) => s.departamento).filter(Boolean);
    return [...new Set(lista)];
  }, [solicitacoes]);

  const total = solicitacoes.length;
  const pendentes = solicitacoes.filter((s) => s.status === "Pendente").length;
  const emAnalise = solicitacoes.filter((s) => s.status === "Em análise").length;
  const aprovadas = solicitacoes.filter((s) => s.status === "Aprovada").length;
  const compradas = solicitacoes.filter((s) => s.status === "Comprado").length;

  if (!usuario) {
    return <Login onLogin={setUsuario} />;
  }

  return (
    <div className="container">
      <h1>Portal de Solicitações de Compras</h1>
      <p className="subtitulo">
        Usuário logado: <strong>{usuario.email}</strong>
      </p>

      <button
        onClick={async () => {
          await signOut(auth);
          setUsuario(null);
        }}
      >
        Sair
      </button>

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

      <div className="bloco">
        <h2>{idEmEdicao ? "Editar solicitação" : "Nova solicitação"}</h2>

        <form onSubmit={enviarSolicitacao} className="formulario">
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
            name="centroCusto"
            placeholder="Centro de custo"
            value={formulario.centroCusto}
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
            type="number"
            min="1"
            value={formulario.quantidade}
            onChange={alterarFormulario}
            required
          />
          <input
            name="valor"
            type="number"
            min="0"
            value={formulario.valor}
            onChange={alterarFormulario}
            required
          />
          <select
            name="urgencia"
            value={formulario.urgencia}
            onChange={alterarFormulario}
          >
            <option>Alta</option>
            <option>Média</option>
            <option>Baixa</option>
          </select>
          <input
            name="fornecedor"
            placeholder="Fornecedor sugerido"
            value={formulario.fornecedor}
            onChange={alterarFormulario}
          />
          <input
            name="linkProduto"
            placeholder="Link do produto"
            value={formulario.linkProduto}
            onChange={alterarFormulario}
          />
          <input
            name="prazoNecessario"
            type="date"
            value={formulario.prazoNecessario}
            onChange={alterarFormulario}
          />
          <textarea
            name="justificativa"
            placeholder="Justificativa"
            value={formulario.justificativa}
            onChange={alterarFormulario}
            required
          />
          <textarea
            name="observacoes"
            placeholder="Observações adicionais"
            value={formulario.observacoes}
            onChange={alterarFormulario}
          />

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

      <div className="bloco">
        <h2>Minhas solicitações</h2>

        <div className="filtros filtros-4">
          <input
            placeholder="Buscar por solicitante, departamento, item, centro de custo ou fornecedor"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option>Todos</option>
            <option>Pendente</option>
            <option>Em análise</option>
            <option>Aprovada</option>
            <option>Reprovada</option>
            <option>Comprado</option>
          </select>

          <select
            value={filtroUrgencia}
            onChange={(e) => setFiltroUrgencia(e.target.value)}
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
              <option key={dep} value={dep}>
                {dep}
              </option>
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
                <p><strong>Centro de custo:</strong> {s.centroCusto}</p>
                <p><strong>Quantidade:</strong> {s.quantidade}</p>
                <p><strong>Valor:</strong> R$ {s.valor}</p>
                <p><strong>Urgência:</strong> {s.urgencia}</p>
                <p><strong>Status:</strong> {s.status}</p>
                <p><strong>Fornecedor:</strong> {s.fornecedor || "-"}</p>
                <p><strong>Usuário:</strong> {s.userEmail || "-"}</p>
                <p>
                  <strong>Link do produto:</strong>{" "}
                  {s.linkProduto ? (
                    <a href={s.linkProduto} target="_blank" rel="noreferrer">
                      Abrir link
                    </a>
                  ) : (
                    "-"
                  )}
                </p>
                <p><strong>Prazo necessário:</strong> {s.prazoNecessario || "-"}</p>
                <p><strong>Data da solicitação:</strong> {s.dataCriacao}</p>
                <p><strong>Justificativa:</strong> {s.justificativa}</p>
                <p><strong>Observações:</strong> {s.observacoes || "-"}</p>

                {s.motivoReprovacao && (
                  <p><strong>Motivo da reprovação:</strong> {s.motivoReprovacao}</p>
                )}

                <div className="acoes">
                  <button onClick={() => editarSolicitacao(s)}>Editar</button>
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
                  <button
                    onClick={() => excluirSolicitacao(s.id)}
                    style={{ background: "#dc2626" }}
                  >
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
    </div>
  );
}

export default App;