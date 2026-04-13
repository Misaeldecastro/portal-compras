import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { auth } from "./firebase";
import logo from "./assets/logo.png";
import "./App.css";

function Login({ onLogin }) {
  const [tela, setTela] = useState("login");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function entrar(e) {
  e.preventDefault();
  setCarregando(true);
  sessionStorage.removeItem("cadastroEmAndamento");

  try {
    const credencial = await signInWithEmailAndPassword(auth, email, senha);
    onLogin(credencial.user);
  } catch (error) {
    console.error("Erro login:", error);
    alert(`${error.code} - ${error.message}`);
  } finally {
    setCarregando(false);
  }
  }

async function cadastrar(e) {
  e.preventDefault();

  if (senha !== confirmarSenha) {
    alert("As senhas não coincidem.");
    return;
  }

  if (senha.length < 6) {
    alert("A senha precisa ter pelo menos 6 caracteres.");
    return;
  }

  setCarregando(true);
  

  try {
    sessionStorage.setItem("cadastroEmAndamento", "true");
    await createUserWithEmailAndPassword(auth, email, senha);
    await signOut(auth);
    alert("Conta criada! Agora faça login.");
    setTela("login");
    setEmail("");
    setSenha("");
    setConfirmarSenha("");
  } catch (error) {
  console.error("Erro cadastro:", error);
  alert(`${error.code} - ${error.message}`);
  } finally {
    setCarregando(false);
  }
}

  return (
  <>

    <div className="login-logo-top">
    <img src={logo} alt="oliv-e" />
    <p className="mensagem-boas-vindas">
     Bem-vindo ao Portal de Solicitação Interna de Compras da Oliv-e Saúde
    </p>
    </div>

    <div className="container">
      {tela === "login" ? (
  <>
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

        <button type="submit" disabled={carregando}>
        {carregando ? "Entrando..." : "Entrar"}
        </button>
        </form>

        <button
          onClick={() => {
          setTela("cadastro");
          setSenha("");
          setConfirmarSenha("");
          }}
        style={{ marginTop: 10 }}
        >
       Criar conta
        </button>
        </>
        ) : (
  <>
    <h1>Criar conta</h1>

    <form onSubmit={cadastrar} className="formulario">
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

      <input
        type="password"
        placeholder="Confirmar senha"
        value={confirmarSenha}
        onChange={(e) => setConfirmarSenha(e.target.value)}
        required
      />

      <button type="submit" disabled={carregando}>
      {carregando ? "Criando..." : "Cadastrar"}
      </button>
    </form>

    <button
    onClick={() => {
    setTela("login");
    setEmail("");
    setSenha("");
    setConfirmarSenha("");
    }}
    style={{ marginTop: 10 }}
    >
    Voltar para login
    </button>
    </>
)}
    </div>
  </>
  );
}

export default Login;