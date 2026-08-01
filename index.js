const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const http = require("http");

// Servidor para o Render
http.createServer((req, res) => res.end('Jackson AI Online')).listen(process.env.PORT || 3000);

async function startBot() {
    // 1. RESTAURAÇÃO FORÇADA DA KEY
    if (process.env.SESSION_ID && !fs.existsSync('session/creds.json')) {
        console.log("🛠️ Restaurando sessão através da SESSION_ID...");
        if (!fs.existsSync('session')) fs.mkdirSync('session');
        try {
            // Decodifica a KEY e salva no arquivo correto
            const decrypted = Buffer.from(process.env.SESSION_ID, 'base64').toString('utf-8');
            fs.writeFileSync('session/creds.json', decrypted);
            console.log("✅ Arquivo creds.json restaurado com sucesso!");
        } catch (e) {
            console.log("❌ Erro ao decodificar SESSION_ID:", e.message);
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        patchMessageBeforeSending: (message) => {
            // Isso ajuda a evitar o erro de "Aguardando mensagem"
            const requiresPatch = !!(message.buttonsMessage || message.templateMessage || message.listMessage);
            if (requiresPatch) {
                message = { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, ...message } } };
            }
            return message;
        }
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log("✅ BOT CONECTADO E SINCRONIZADO!");
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("❌ Conexão fechada. Reconectando:", shouldReconnect);
            if (shouldReconnect) startBot();
        }
    });

    // --- COMANDOS ---
    conn.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const prefix = ".";

        // Responder ao áudio
        if (type === 'audioMessage') {
            await conn.sendMessage(from, { text: 'Obrigado por compartilhar esta obra, um dos nossos vai analisar. 🎵' }, { quoted: msg });
        }

        if (!body.startsWith(prefix)) return;
        const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        if (command === 'menu') {
            await conn.sendMessage(from, { text: "🤖 *JACKSON AI ATIVA*\n\nUse .marcar para chamar todos." });
        }

        if (command === 'marcar') {
            const groupMetadata = from.endsWith('@g.us') ? await conn.groupMetadata(from) : null;
            if (!groupMetadata) return;
            let texto = `📢 *AVISO GERAL*\n\n${args.join(" ") || "Olá família, compartilhem o grupo!"}\n\n`;
            const participants = groupMetadata.participants;
            for (let p of participants) { texto += `@${p.id.split('@')[0]} `; }
            await conn.sendMessage(from, { text: texto, mentions: participants.map(a => a.id) });
        }
    });
}

startBot();