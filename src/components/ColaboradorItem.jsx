export default function ColaboradorItem({
  colaborador,
  emEdicao,
  roleEditado,
  statusEditado,
  mensagem,
  onToggleEdicao,
  onChangeRole,
  onToggleStatus,
  onSalvar,
}) {
  return (
    <article className="item-lista">
      <div className="colaborador-cabecalho">
        <div>
          <strong>{colaborador.email || colaborador.uid}</strong>
          <p>{colaborador.ativo ? "Ativo" : "Desativado"}</p>
        </div>

        <button
          type="button"
          className="botao-editar-colaborador"
          onClick={onToggleEdicao}
          title="Editar colaborador"
        >
          <i className="fi fi-rr-edit"></i>
        </button>
      </div>

      {emEdicao && (
        <>
          <select
            value={roleEditado || colaborador.role}
            onChange={(e) => onChangeRole(e.target.value)}
          >
            <option value="funcionario">Funcionário</option>
            <option value="admin_full">Admin Full</option>
            <option value="aprovador">Aprovador</option>
            <option value="comprador">Comprador</option>
          </select>

          <button type="button" onClick={onToggleStatus}>
            {(statusEditado ?? colaborador.ativo) ? "Desativar" : "Ativar"}
          </button>

          <button
            type="button"
            onClick={() =>
              onSalvar(
                roleEditado || colaborador.role,
                statusEditado ?? colaborador.ativo
              )
            }
          >
            Salvar
          </button>
        </>
      )}

      {mensagem && <p>{mensagem}</p>}
    </article>
  );
}
