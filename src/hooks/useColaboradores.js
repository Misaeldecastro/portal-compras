import { useCallback, useState } from "react";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export function useColaboradores({ isAdminFull }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [carregandoColaboradores, setCarregandoColaboradores] = useState(false);
  const [rolesEditados, setRolesEditados] = useState({});
  const [colaboradorEmEdicao, setColaboradorEmEdicao] = useState(null);
  const [statusEditados, setStatusEditados] = useState({});
  const [mensagensColaboradores, setMensagensColaboradores] = useState({});

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

  async function salvarColaborador(uid, novoRole, ativo) {
    if (!isAdminFull) return;

    try {
      await updateDoc(doc(db, "users", uid), {
        role: novoRole,
        ativo,
      });

      setColaboradores((prev) =>
        prev.map((c) => (c.uid === uid ? { ...c, role: novoRole, ativo } : c))
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
      console.error("Erro ao salvar colaborador:", error);
      alert("Erro ao salvar colaborador.");
    }
  }

  return {
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
  };
}
