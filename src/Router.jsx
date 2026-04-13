import { Routes, Route } from "react-router-dom";
import App from "./App";
import SolicitacaoDetalhe from "./SolicitacaoDetalhe";

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/solicitacao/:id" element={<SolicitacaoDetalhe />} />
    </Routes>
  );
}