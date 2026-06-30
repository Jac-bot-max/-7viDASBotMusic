import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import yts from "yt-search";

// 1. Servidor Web para o Render e Cron-job
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Online! Aguarde o código nos logs.'));
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: state,
        logger: pino({ level: "silent" }),
    });

    // 2. Lógica do Código de Pareamento (8 dígitos)
    if (!socket.authState.creds.registered) {
        const numero = process.env.NUMERO_BOT; // Configure isso no Render!
        if (numero) {
            setTimeout(async () => {
                let code = await socket.requestPairingCode(numero);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\n=======================================");
                console.log(`SEU CÓDIGO DE PAREAMENTO: ${code}`);
                console.log("=======================================\n");
            }, 5000);
        } else {
            console.log("ERRO: Variável NUMERO_BOT não configurada no Render.");
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("✅ BOT CONECTADO COM SUCESSO!");
        }
    });

    // 3. Comando !foto (YouTube)
    socket.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            const from = msg.key.remoteJid;

            if (messageText.toLowerCase().startsWith("!foto")) {
                const termo = messageText.slice(6).trim();
                if (!termo) return socket.sendMessage(from, { text: "Diga o que buscar! Ex: !foto amor não é para doer" });

                const search = await yts(termo);
                const video = search.videos[0];

                if (video) {
                    await socket.sendMessage(from, { 
                        image: { url: video.thumbnail }, 
                        caption: `*Resultado:* ${video.title}\n*Canal:* ${video.author.name}` 
                    });
                } else {
                    await socket.sendMessage(from, { text: "Não encontrei nada." });
                }
            }
        } catch (e) {
            console.log("Erro no comando:", e);
        }
    });
}

startBot();
