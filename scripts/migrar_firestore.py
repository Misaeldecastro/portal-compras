#!/usr/bin/env python3
"""Copia coleções do Firestore entre projetos, via API REST.

Lê de portal-compras-1af5d/(default) e escreve em prj-prd-infra-01/portal-compras.
O objeto `fields` de cada documento é copiado verbatim: o formato de leitura e o
de escrita da API são o mesmo, então não há conversão de tipos para dar errado.

Uso:
  python3 migrar_firestore.py --dry-run   # só lê e relata
  python3 migrar_firestore.py             # copia e verifica
"""
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ORIGEM = ("portal-compras-1af5d", "(default)")
DESTINO = ("prj-prd-infra-01", "portal-compras")
COLECOES = ["users", "purchase_requests"]
QUOTA_PROJECT = "prj-prd-infra-01"

BASE = "https://firestore.googleapis.com/v1"


def token():
    return subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


TOKEN = token()


def chamar(metodo, url, corpo=None):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=dados, method=metodo)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("X-Goog-User-Project", QUOTA_PROJECT)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        detalhe = e.read().decode()[:400]
        raise SystemExit(f"\nERRO HTTP {e.code} em {metodo} {url}\n{detalhe}")


def ler_colecao(projeto, banco, colecao):
    """Devolve {id_do_documento: objeto_fields} da coleção inteira."""
    docs = {}
    token_pagina = None
    while True:
        params = {"pageSize": "300"}
        if token_pagina:
            params["pageToken"] = token_pagina
        url = (
            f"{BASE}/projects/{projeto}/databases/{banco}/documents/"
            f"{colecao}?{urllib.parse.urlencode(params)}"
        )
        r = chamar("GET", url)
        for doc in r.get("documents", []):
            docs[doc["name"].rsplit("/", 1)[-1]] = doc.get("fields", {})
        token_pagina = r.get("nextPageToken")
        if not token_pagina:
            return docs


def escrever_doc(projeto, banco, colecao, doc_id, fields):
    # PATCH sem updateMask cria o documento ou atualiza os campos enviados,
    # o que torna o script seguro para rodar de novo após falha parcial.
    url = (
        f"{BASE}/projects/{projeto}/databases/{banco}/documents/"
        f"{colecao}/{urllib.parse.quote(doc_id, safe='')}"
    )
    chamar("PATCH", url, {"fields": fields})


def main():
    seco = "--dry-run" in sys.argv
    print(f"origem : {ORIGEM[0]} / {ORIGEM[1]}")
    print(f"destino: {DESTINO[0]} / {DESTINO[1]}")
    print("modo   :", "DRY-RUN (nada é escrito)" if seco else "CÓPIA REAL")
    print()

    problemas = 0

    for colecao in COLECOES:
        print(f"── {colecao} " + "─" * (40 - len(colecao)))
        origem = ler_colecao(*ORIGEM, colecao)
        print(f"   lidos na origem: {len(origem)}")

        if seco:
            amostra = list(origem.items())[:1]
            for doc_id, fields in amostra:
                print(f"   exemplo: {doc_id}")
                print(f"   campos : {', '.join(sorted(fields)) or '(vazio)'}")
            print()
            continue

        for i, (doc_id, fields) in enumerate(origem.items(), 1):
            escrever_doc(*DESTINO, colecao, doc_id, fields)
            if i % 25 == 0 or i == len(origem):
                print(f"   escritos: {i}/{len(origem)}")

        # Verificação: relê o destino e compara documento a documento,
        # campo a campo. Contagem igual não prova conteúdo igual.
        destino = ler_colecao(*DESTINO, colecao)
        faltando = set(origem) - set(destino)
        sobrando = set(destino) - set(origem)
        divergentes = [d for d in origem if d in destino and origem[d] != destino[d]]

        print(f"   relidos no destino: {len(destino)}")
        if faltando:
            print(f"   ✗ FALTANDO no destino: {len(faltando)} → {sorted(faltando)[:5]}")
            problemas += len(faltando)
        if sobrando:
            print(f"   ! extras no destino: {len(sobrando)} → {sorted(sobrando)[:5]}")
        if divergentes:
            print(f"   ✗ CONTEÚDO DIVERGENTE: {len(divergentes)} → {divergentes[:5]}")
            problemas += len(divergentes)
        if not faltando and not divergentes:
            print(f"   ✓ {len(origem)} documentos idênticos campo a campo")
        print()

    if seco:
        print("dry-run concluído — nada foi escrito.")
    elif problemas:
        print(f"⚠️  {problemas} problema(s). NÃO prossiga para a Fase 3.")
        sys.exit(1)
    else:
        print("✅ migração completa e verificada campo a campo.")


if __name__ == "__main__":
    main()
