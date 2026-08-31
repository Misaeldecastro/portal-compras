import StatusBadge from "./StatusBadge";

export default function SolicitacaoCard({
  solicitacao: s,
  estaAberta,
  onToggle,
  podeEditar,
  podeAprovar,
  podeExcluir,
  isComprador,
  isAdminFull,
  emAndamento,
  onPedirNovamente,
  onEditar,
  onMudarStatus,
  onExcluir,
}) {
  return (
    <article
      className={`item-lista item-lista-acordeao ${estaAberta ? "aberto" : ""}`}
    >
      <button
        type="button"
        className="titulo-solicitacao"
        onClick={onToggle}
        aria-expanded={estaAberta}
        aria-controls={`detalhes-${s.id}`}
      >
        <span className="cabecalho-solicitacao">
          <span className="nome-solicitacao">
            {s.item || "Solicitação sem título"}
          </span>
          <StatusBadge status={s.status} />
        </span>
      </button>

      {estaAberta && (
        <div id={`detalhes-${s.id}`} className="conteudo-solicitacao">
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
                  <a href={s.linkProduto1} target="_blank" rel="noreferrer">
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
                  <a href={s.linkProduto2} target="_blank" rel="noreferrer">
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
              <div className="aviso-reprovacao">
                <span>Motivo da reprovação</span>
                <strong>{s.motivoReprovacao}</strong>
              </div>
            )}
          </div>

          <div className="acoes">
            <button onClick={() => onPedirNovamente(s)}>Pedir novamente</button>

            {podeEditar && (
              <button onClick={() => onEditar(s)}>Editar</button>
            )}

            {podeAprovar && (
              <>
                <button
                  disabled={emAndamento}
                  onClick={() => onMudarStatus(s.id, "Em análise")}
                >
                  Em análise
                </button>
                <button
                  disabled={emAndamento}
                  onClick={() => onMudarStatus(s.id, "Aprovada")}
                >
                  Aprovar
                </button>
                <button
                  disabled={emAndamento}
                  onClick={() => onMudarStatus(s.id, "Reprovada")}
                >
                  Reprovar
                </button>
              </>
            )}

            {(isComprador || isAdminFull) && (
              <button
                disabled={emAndamento}
                onClick={() => onMudarStatus(s.id, "Comprado")}
              >
                Comprado
              </button>
            )}

            {isComprador && (
              <button
                disabled={emAndamento}
                onClick={() => onMudarStatus(s.id, "Reprovada")}
              >
                Reprovar
              </button>
            )}

            {podeExcluir && (
              <button
                onClick={() => onExcluir(s.id)}
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
}
