import { useState } from "react";
import { supabase } from "./supabase";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function entrar(e) {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      alert("Erro: " + error.message);
      return;
    }

    onLogin(data.user);
  }

  async function cadastrar() {
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    if (error) {
      alert("Erro: " + error.message);
      return;
    }

    alert("Usuário criado!");
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