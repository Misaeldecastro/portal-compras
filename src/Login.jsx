import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "./firebase";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function entrar(e) {
    e.preventDefault();

    try {
      const credencial = await signInWithEmailAndPassword(auth, email, senha);
      onLogin(credencial.user);
    } catch (error) {
      console.error("Erro login:", error);
      alert(`${error.code} - ${error.message}`);
    }
  }

  async function cadastrar() {
    try {
      await createUserWithEmailAndPassword(auth, email, senha);
      alert("Usuário criado! Agora clique em Entrar.");
    } catch (error) {
      console.error("Erro cadastro:", error);
      alert(`${error.code} - ${error.message}`);
    }
  }

  return (
    <div className="container">
      <h1>Login</h1>

      <form onSubmit={entrar} className="formulario">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />

        <button type="submit">Entrar</button>
      </form>

      <button onClick={cadastrar} style={{ marginTop: 10 }}>
        Criar conta
      </button>
    </div>
  );
}

export default Login;