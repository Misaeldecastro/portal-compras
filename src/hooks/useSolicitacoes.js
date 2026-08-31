import { useCallback, useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  buscarEmailsPorRole,
  notificarAprovacaoSlack,
  notificarReprovacaoSlack,
  notificarSolicitanteSlack,
} from "../services/slackApi";

export function useSolicitacoes({
  usuario,
  role,
  isAprovador,
  isAdminFull,
  isComprador,
  podeAprovar,
  podeComprar,
  setCarregando,
  onExcluida,
  onRemovidaDaLista,
}) {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [statusEmAndamento, setStatusEmAndamento] = useState(() => new Set());

  const buscarSolicitacoes = useCallback(async function buscarSolicitacoes() {
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
  }, [usuario, isAprovador, isAdminFull, isComprador, setCarregando]);

  useEffect(() => {
    if (usuario) buscarSolicitacoes();
    else setSolicitacoes([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, role]);

  async function excluirSolicitacao(id) {
    if (!window.confirm("Tem certeza que deseja excluir esta solicitação?")) return;

    try {
      await deleteDoc(doc(db, "purchase_requests", id));
      onExcluida?.(id);
      await buscarSolicitacoes();
    } catch (error) {
      alert("Erro ao excluir");
      console.error(error);
    }
  }

  async function mudarStatus(id, novoStatus) {
    if (statusEmAndamento.has(id)) {
      alert("Esta solicitação já está sendo processada. Aguarde um instante.");
      return;
    }

    const aprovadorPodeAlterar = podeAprovar;

    const compradorPodeAlterar =
      podeComprar && (novoStatus === "Comprado" || novoStatus === "Reprovada");

    if (!aprovadorPodeAlterar && !compradorPodeAlterar) {
      alert("Você não tem permissão para alterar o status.");
      return;
    }

    const analiseFinalizadaAprovador =
      podeAprovar && (novoStatus === "Aprovada" || novoStatus === "Reprovada");
    const solicitacaoAtual = solicitacoes.find((s) => s.id === id);

    if (solicitacaoAtual?.status === novoStatus) {
      alert(`Esta solicitação já está com o status "${novoStatus}".`);
      return;
    }

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

    if (compradorPodeAlterar && novoStatus === "Comprado") {
      const nomeSolicitacao = solicitacaoAtual?.item
        ? ` "${solicitacaoAtual.item}"`
        : "";

      const confirmado = window.confirm(
        `Confirma que esta solicitação${nomeSolicitacao} foi realmente comprada?`
      );

      if (!confirmado) return;
    }

    let motivo = "";

    if (novoStatus === "Reprovada") {
      const r = window.prompt("Digite o motivo da reprovação:");
      if (r === null) return;
      motivo = r;
    }

    setStatusEmAndamento((atual) => new Set(atual).add(id));

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

      if (novoStatus === "Reprovada") {
        try {
          await notificarReprovacaoSlack({
            idSolicitacao: id,
            item: solicitacaoAtual?.item || "",
            solicitante: solicitacaoAtual?.solicitante || "",
            userEmail: solicitacaoAtual?.userEmail || "",
            motivoReprovacao: motivo,
          });
        } catch (erro) {
          alert("Solicitação reprovada, mas a notificação Slack falhou. Avise o solicitante manualmente.");
          console.error(erro);
        }
      }

      if (novoStatus === "Aprovada" || novoStatus === "Comprado") {
        try {
          await notificarSolicitanteSlack({
            idSolicitacao: id,
            item: solicitacaoAtual?.item || "",
            solicitante: solicitacaoAtual?.solicitante || "",
            userEmail: solicitacaoAtual?.userEmail || "",
            status: novoStatus,
          });
        } catch (erro) {
          const statusMensagem =
            novoStatus === "Aprovada" ? "aprovada" : "comprada";

          alert(
            `Solicitação ${statusMensagem}, mas a notificação Slack ao solicitante falhou.`
          );
          console.error(erro);
        }
      }

      if (novoStatus === "Aprovada" && podeAprovar) {
        try {
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
            const compradorEmails = await buscarEmailsPorRole(usuario, "comprador");

            await notificarAprovacaoSlack({
              ...solicitacaoParaSlack,
              destinatariosEmails: compradorEmails,
            });
          }
        } catch (erro) {
          alert("Solicitação aprovada, mas a notificação Slack falhou. Avise o Comprador manualmente.");
          console.error(erro);
        }
      }

      const deveRemoverDaLista =
        analiseFinalizadaAprovador && isAprovador && !isAdminFull;

      if (deveRemoverDaLista) {
        setSolicitacoes((prev) => prev.filter((s) => s.id !== id));
        onRemovidaDaLista?.(id);
      } else {
        setSolicitacoes((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: novoStatus,
                  motivoReprovacao: novoStatus === "Reprovada" ? motivo : "",
                  aprovadaAprovador:
                    novoStatus === "Aprovada" && podeAprovar
                      ? true
                      : s.aprovadaAprovador,
                  analiseAprovadorFinalizada: analiseFinalizadaAprovador
                    ? true
                    : s.analiseAprovadorFinalizada,
                }
              : s
          )
        );
      }
    } catch (error) {
      alert("Erro ao alterar status");
      console.error(error);
    } finally {
      setStatusEmAndamento((atual) => {
        const novo = new Set(atual);
        novo.delete(id);
        return novo;
      });
    }
  }

  return {
    solicitacoes,
    setSolicitacoes,
    statusEmAndamento,
    buscarSolicitacoes,
    excluirSolicitacao,
    mudarStatus,
  };
}
