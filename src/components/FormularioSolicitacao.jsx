export default function FormularioSolicitacao({
  formulario,
  onChange,
  onSubmit,
  salvando,
  idEmEdicao,
  pedidoBaseadoEmReprovada,
  novaDireta,
  onCancelar,
}) {
  return (
    <div className="bloco">
      <h2>{idEmEdicao ? "Editar solicitação" : "Nova solicitação"}</h2>

      {pedidoBaseadoEmReprovada && (
        <p>
          <strong>
            Atenção! Esta solicitação é baseada em uma solicitação reprovada.
            Revise as informações e envie novamente.
          </strong>
        </p>
      )}

      <form onSubmit={onSubmit} className="formulario">
        <textarea
          name="justificativa"
          placeholder="Justificativa/ Descrição"
          value={formulario.justificativa}
          onChange={onChange}
          required
        />

        <input
          name="solicitante"
          placeholder="Solicitante"
          value={formulario.solicitante}
          onChange={onChange}
          required
        />

        <input
          name="departamento"
          placeholder="Departamento"
          value={formulario.departamento}
          onChange={onChange}
          required
        />

        <input
          name="item"
          placeholder="Item solicitado"
          value={formulario.item}
          onChange={onChange}
          required
        />

        <input
          name="quantidade"
          placeholder="Quantidade"
          value={formulario.quantidade}
          onChange={onChange}
          required
        />

        <select
          name="prioridade"
          value={formulario.prioridade}
          onChange={onChange}
        >
          <option value="Alta">Prioridade Alta</option>
          <option value="Média">Prioridade Média</option>
          <option value="Baixa">Prioridade Baixa</option>
        </select>

        <input
          name="linkProduto1"
          placeholder="Link do produto 1"
          value={formulario.linkProduto1}
          onChange={onChange}
          required
        />

        <input
          name="linkProduto2"
          placeholder="Link do produto 2 (opcional)"
          value={formulario.linkProduto2}
          onChange={onChange}
        />

        <div className="campo-form">
          <label>Prazo</label>
          <input
            name="data"
            type="date"
            value={formulario.data}
            onChange={onChange}
            required
          />
          <small className="obs-prazo">
            Atenção: a compra deve ser feita pelo Mercado Livre, com entrega
            Full, para melhor emissão da nota fiscal.
          </small>
        </div>

        <div className="acoes-formulario">
          <button type="submit" disabled={salvando}>
            {salvando
              ? "Salvando..."
              : pedidoBaseadoEmReprovada
              ? "Criar nova solicitação"
              : idEmEdicao
              ? "Salvar edição"
              : "Enviar solicitação"}
          </button>

          <button type="button" onClick={onCancelar} className="botao-secundario">
            {idEmEdicao
              ? "Cancelar edição"
              : novaDireta
              ? "Limpar formulário"
              : "Cancelar"}
          </button>
        </div>
      </form>
    </div>
  );
}
