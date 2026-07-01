import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, delay } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- 1. LIGAR O SERVIDOR IMEDIATAMENTE (PARA O RENDER NÃO MATAR O BOT) ---
const app = express();
const port = process.env.PORT || 10000; // Render prefere a porta 10000 ou a enviada por eles
app.get('/', (req, res) => res.send('@7viDASBotMusic está Vivo e Online!'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor Web ativo na porta ${port}`));

const advertencias = new Map();

async function startBot() {
    // 2. RECUPERAÇÃO DE SESSÃO
    if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
    const sessionID = process.env.SESSION_ID;
    
    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        try {
            const decodedSession = Buffer.from(sessionID, 'base64').toString('utf-8');
            fs.writeFileSync('./session_data/creds.json', decodedSession);
            console.log("📂 Sessão recuperada da SESSION_ID");
        } catch (e) { console.log("❌ Erro ao decodificar SESSION_ID"); }
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        shouldSyncHistoryMessage: () => false,
        printQRInTerminal: false,
        browser: ["@7viDASBotMusic", "Chrome", "1.0.0"]
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const status = lastDisconnect?.error?.output?.statusCode;
            console.log(`⚠️ Conexão fechada. Status: ${status}`);
            // Só reconecta se não for logout voluntário
            if (status !== DisconnectReason.loggedOut) startBot();
        } else if (connection === "open") {
            console.log("✅ @7viDASBotMusic: WHATSAPP CONECTADO COM SUCESSO");
        }
    });

    socket.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            if (!isGroup) return;

            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
            const sender = msg.key.participant || msg.key.remoteJid;

            // --- LÓGICA DE ADM SIMPLIFICADA ---
            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            // ANTI-LINK (SIMPLES E EFICAZ)
            const linkRegex = /(https?:\/\/|chat\.whatsapp\.com)/gi;
            if (linkRegex.test(textRaw) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                // Apaga a mensagem
                await socket.sendMessage(from, { delete: msg.key });
                
                let avisos = (advertencias.get(sender) || 0) + 1;
                advertencias.set(sender, avisos);

                if (avisos >= 3) {
                    await socket.groupParticipantsUpdate(from, [sender], "remove");
                    advertencias.delete(sender);
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *AVISO [${avisos}/3]* @${sender.split('@')[0]}, links são proibidos!`, mentions: [sender] });
                }
                return;
            }

            // --- COMANDOS ---
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            if (command === "menu") {
                await socket.sendMessage(from, { text: "🔵 *@7viDASBotMusic V3*\n\n◽ !yt [busca]\n◽ !foto [nome]\n◽ !drums [estilo]\n◽ !ping\n◽ !link" });
            }

            if (command === "ping") {
                await socket.sendMessage(from, { text: "🚀 Jackson Beatz está voando!" });
            }

            if (command === "yt") {
                const s = await yts(query || "jackson beatz");
                if (s.videos[0]) {
                    await socket.sendMessage(from, { text: `📺 *YouTube:* ${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
                }
            }

            if (command === "link" && isBotAdmin) {
                const code = await socket.groupInviteCode(from);
                await socket.sendMessage(from, { text: `🔗 https://chat.whatsapp.com/${code}` });
            }

        } catch (e) { console.log("Erro:", e); }
    });
}

startBot();
