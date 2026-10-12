// ============================================================
//  BACKEND RESOLVEDOR DO TERABOX
//  Recebe um link de compartilhamento e devolve a URL direta.
//
//  AVISO: o Terabox muda a proteção com frequência. A função
//  extrairLinkTerabox() é a parte que você precisará manter
//  atualizada. Use APENAS com conteúdo que você tem direito
//  de distribuir.
// ============================================================
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); // permite o frontend chamar este backend

// Cookie da sua conta Terabox (NDUS). Pegue no navegador logado:
// DevTools > Application > Cookies > ndus
// Guarde em variável de ambiente, nunca deixe fixo no código em produção.
const NDUS = process.env.TERABOX_NDUS || "COLE_SEU_COOKIE_NDUS_AQUI";

app.get("/api/resolver", async (req, res) => {
  const shareUrl = req.query.url;
  if (!shareUrl) return res.status(400).json({ erro: "Faltou o parâmetro url" });

  try {
    const directUrl = await extrairLinkTerabox(shareUrl);
    res.json({ directUrl });
  } catch (e) {
    console.error("Falha ao resolver:", e.message);
    res.status(500).json({ erro: "Não foi possível resolver o link do Terabox" });
  }
});

// ------------------------------------------------------------
//  Extrator (esqueleto). Fluxo geral que o Terabox exige:
//  1. Abrir a página de share e capturar: jsToken, shareid, uk, surl.
//  2. Chamar a API de lista de arquivos para pegar o fs_id.
//  3. Chamar a API de download assinada (sign + timestamp) para
//     receber a dlink (URL direta do arquivo).
//  Como o Terabox muda isso periodicamente, mantenha esta parte.
// ------------------------------------------------------------
async function extrairLinkTerabox(shareUrl) {
  const headers = {
    "User-Agent": "Mozilla/5.0",
    "Cookie": `ndus=${NDUS}`,
    "Referer": "https://www.terabox.com/"
  };

  // 1) Normaliza o surl (parte depois de /s/)
  const surl = (shareUrl.match(/\/s\/([^?\/]+)/) || [])[1];
  if (!surl) throw new Error("Link de share inválido");

  // 2) Página de share -> jsToken (necessário para as próximas chamadas)
  const pagina = await fetch(`https://www.terabox.com/sharing/link?surl=${surl}`, { headers })
    .then(r => r.text());
  const jsToken = (pagina.match(/jsToken%22%3A%22([^%]+)/) ||
                   pagina.match(/"jsToken"\s*:\s*"([^"]+)"/) || [])[1];
  if (!jsToken) throw new Error("jsToken não encontrado (proteção do Terabox mudou)");

  // 3) Lista de arquivos do share -> shareid, uk, fs_id
  const listaUrl = `https://www.terabox.com/share/list?app_id=250528&web=1&channel=dubox`+
    `&clienttype=0&jsToken=${jsToken}&shorturl=${surl}&root=1`;
  const lista = await fetch(listaUrl, { headers }).then(r => r.json());
  if (!lista.list || !lista.list.length) throw new Error("Nenhum arquivo no share");

  const arquivo = lista.list[0];
  // Em muitos casos a própria lista já traz a dlink:
  if (arquivo.dlink) return arquivo.dlink;

  // Caso contrário, seria necessário chamar a API de download
  // assinada usando shareid/uk/fs_id/sign/timestamp.
  throw new Error("dlink não disponível direto — implemente a etapa de download assinado");
}

// A porta vem do ambiente (Render define automaticamente via process.env.PORT).
// Em produção o servidor PRECISA escutar em 0.0.0.0, senão o Render
// não detecta a porta e o deploy falha com "no open ports / Timed Out".
// Localmente, se não houver PORT, usa 3000.
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Resolvedor rodando na porta ${PORT}`));
