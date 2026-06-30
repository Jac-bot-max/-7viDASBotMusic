import express from 'express';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  delay // Importante para o pareamento
} from "baileys";
import pino from "pino";
import fs from "node:fs";
import { PREFIX, TEMP_DIR } from "./config.js";
import { load } from "./loader.js";

// Servidor para o Render e Cron-job não deixarem o bot dormir
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot 7vidas Online! Aguardando pareamento...'));
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    printQRInTerminal: false, // Desativamos o QR Code
    auth: state,
    logger: pino({ level: "silent" }),
  });

  // --- LÓGICA DO CÓDIGO DE PAREAMENTO ---
  // Se não estiver conectado e houver um número configurado
  if (!socket.authState.creds.registered) {
    const numero = process.env.NUMERO_BOT; // Ele vai pegar o número que você salvou no Render

    if (numero) {
        setTimeout(async () => {
            try {
                let code = await socket.requestPairingCode(numero);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("---------------------------------------");
                console.log(`SEU CÓDIGO DE PAREAMENTO É: ${code}`);
                console.log("---------------------------------------");
            } catch (error) {
                console.error("Erro ao gerar código de pareamento:", error);
            }
        }, 5000); // Espera 5 segundos para o socket estabilizar
    } else {
        console.log("ERRO: Você não configurou a variável NUMERO_BOT no Render!");
    }
  }

  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) connect();
    } else if (connection === "open") {
      console.log("✅ BOT CONECTADO COM SUCESSO!");
      load(socket);
    }
  });

  socket.ev.on("creds.update", saveCreds);
  return socket;
}

connect();
