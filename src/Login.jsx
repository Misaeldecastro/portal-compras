import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  sendPasswordResetEmail,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "./firebase";
import logo from "./assets/logo.png";
import "./App.css";

function Login({ onLogin }) {
  const [tela, setTela] = useState("login");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function entrar(e) {
  e.preventDefault();
  setCarregando(true);
  sessionStorage.removeItem("cadastroEmAndamento");

  try {
    await setPersistence(auth, browserSessionPersistence);

    const credencial = await signInWithEmailAndPassword(auth, email, senha);
    onLogin(credencial.user);
  } catch (error) {
    console.error("Erro login:", error);

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found"
    ) {
      alert("Login ou senha incorreta.");
    } else {
      alert("erro ao fazer login. Tente novamente.");
    }

  } finally {
    setCarregando(false);
  }
  }

async function recuperarSenha() {
  if (!email) {
    alert ("Digite seu e-mail no campo de login primeiro.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert("Enviamos um link no seu e-mail para redefinir sua senha.");
  } catch (error) {
    console.error("erro ao recuperar senha:", error);
    alert("não foi possivel enviar o e-mail de recuperação.");
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
      
      <div className="campo-senha">
        <input
          type={mostrarSenha ? "text" : "password"}
          placeholder="senha"
          value={senha}
          onChange={(e) =>  setSenha(e.target.value)}
        />

        <button
          type="button"
          className="botao-olho"
          onClick={() => setMostrarSenha(!mostrarSenha)}
        >
        {mostrarSenha ? (
        // olho fechado
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="black" strokeWidth="2">
          <path d="M17.94 17.94A10.94 10.94 0 0110 20C5 20 1.73 16.11 1 15c.58-.88 2.3-3.05 5-4.29M9.88 4.24A10.94 10.94 0 0110 4c5 0 8.27 3.89 9 5-.21.32-.7 1-1.46 1.8M1 1l18 18"/>
        </svg>
        ) : (
        // olho aberto
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="black" strokeWidth="2">
          <path d="M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        )}
        </button>

      </div>

        <button type="submit" disabled={carregando}>
        {carregando ? "Entrando..." : "Entrar"}
        </button>
        </form>

              <p
        className="link-secundario"
        onClick={recuperarSenha}
        >
        Esqueceu a senha?
        </p>

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