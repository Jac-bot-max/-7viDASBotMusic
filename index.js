import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import fs from "fs";
import yts from "yt-search";

const app = express();
app.get('/', (req, res) => res.send('Jackson Beatz V3 - Gerador de Sessão Ativo!'));
app.listen(process.env.PORT || 3000);

async function startBot() {
    // Tenta carregar a sessão se ela já existir no Render
    const sessionID = process.env.SESSION_ID;
    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        const decodedSession = Buffer.from(sessionID, 'base64').toString('utf-8');
        fs.writeFileSync('./session_data/creds.json', decodedSession);
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: state,
        logger: pino({ level: "silent" }),
        shouldSyncHistoryMessage: () => false,
    });

    // Se não tiver login, gera o código de 8 dígitos nos Logs do Render
    if (!socket.authState.creds.registered) {
        const numero = process.env.NUMERO_BOT;
        if (numero) {
            setTimeout(async () => {
                let code = await socket.requestPairingCode(numero);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\nCÓDIGO DE PAREAMENTO: ${code}\n`);
            }, 7000);
        }
    }

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startBot();
        if (connection === "open") console.log("✅ BOT CONECTADO!");
    });

    socket.ev.on("messages.upsert", async (chatUpdate) => {
        const msg = chatUpdate.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        // --- COMANDO MÁGICO PARA GERAR A CHAVE ---
        if (text === "!key") {
            try {
                const creds = fs.readFileSync('./session_data/creds.json');
                const sessionString = Buffer.from(creds).toString('base64');
                await socket.sendMessage(from, { text: "Aqui está a sua nova SESSION_ID para colar no Render:\n\n" + sessionString });
            } catch (e) {
                await socket.sendMessage(from, { text: "Erro ao gerar chave. O bot ainda está sincronizando." });

        // COMANDO !FOTO
        if (text.startsWith("!foto")) {
            const termo = text.slice(6).trim();
            const search = await yts(termo);
            const video = search.videos[0];
            if (video) {
                await socket.sendMessage(from, { image: { url: video.thumbnail }, caption: `*Resultado:* ${video.title}` });
        
        });
    }

    // =========================
    // COMANDO !PING
    // =========================
    if (text === "!ping") {
        await socket.sendMessage(from, {
            text: "🏓 Pong!"
        });
    }

    // =========================
    // COMANDO !MENU
    // =========================
    if (text === "!menu") {
        await socket.sendMessage(from, {
            text:
`📌 MENU DO BOT

!ping - testar bot
!menu - ver comandos
!ban - remover membro`
        });
    }

    // =========================
    // COMANDO !BAN
    // =========================
    if (text.startsWith("!ban")) {

        const user = msg.message?.extendedTextMessage?.contextInfo?.participant;

        if (!user) {
            await socket.sendMessage(from, {
                text: "❌ Responde a mensagem de alguém para banir"
            });
            return;
        }

        await socket.groupParticipantsUpdate(from, [user], "remove");

        await socket.sendMessage(from, {
            text: "🚫 Usuário removido"
        });
    }

}); // 🔒 FECHO FINAL DO BOT (NÃO MEXER)

startBot();
