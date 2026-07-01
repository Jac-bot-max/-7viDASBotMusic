import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
app.get('/', (req, res) => res.send('Jackson Beatz V3 PRO - Online'));
app.listen(process.env.PORT || 3000);

async function startJackson() {
    if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
    const sessionID = process.env.SESSION_ID;
    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decodedSession = Buffer.from(sessionID, 'base64').toString('utf-8');
        fs.writeFileSync('./session_data/creds.json', decodedSession);
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        shouldSyncHistoryMessage: () => false,
        printQRInTerminal: false,
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startJackson();
        if (connection === "open") console.log("✅ JACKSON BEATZ PRO: ATIVO");
    });

    socket.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const content = JSON.stringify(msg.message);
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
            const sender = msg.key.participant || msg.key.remoteJid;

            // --- DETECTAR INSTRUMENTAL / MÚSICA (ÁUDIO OU VÍDEO) ---
            if (type === 'audioMessage' || type === 'videoMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[ JACKSON BEATZ ]* ⚪\n\n🔵 _Positivo, alguém vai reagir ou alguém vai analisar esta obra._", quoted: msg });
                return; // Não executa os comandos abaixo se for mídia
            }

            // --- ANTI-LINK (APAGAR E BANIR) ---
            const linkRegex = /(https?:\/\/|chat\.whatsapp\.com)/gi;
            if (isGroup && linkRegex.test(text)) {
                // Se não for admin, apaga e bane
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                if (!admins.includes(sender)) {
                    await socket.sendMessage(from, { delete: msg.key }); // Apaga link
                    await socket.groupParticipantsUpdate(from, [sender], "remove"); // Bane
                    return socket.sendMessage(from, { text: "🔴 *SISTEMA DE SEGURANÇA* 🔴\n\nLink detectado. Usuário banido automaticamente." });
                }
            }

            const args = text.split(" ");
            const command = args[0];
            const query = text.slice(command.length).trim();

            // --- MENU PROFISSIONAL ---
            if (command === "!menu") {
                const menuPro = `╔═════ 🔵 *JACKSON BEATZ V3* 🔵 ═════╗
║
║ 🔴 *PRODUÇÃO & SOFTWARE*
║ ◽ !flpc - FL Studio para PC
║ ◽ !flmobile - FL Studio Mobile
║ ◽ !bandlab - Tudo sobre BandLab
║ ◽ !voloco - Links do Voloco
║ ◽ !drums [estilo] - Packs de Bateria
║ ◽ !vst [nome] - Plugins Musicais
║
║ ⚪ *UTILITÁRIOS*
║ ◽ !foto [nome] - Capa de vídeo
║ ◽ !yt [busca] - Link direto YouTube
║
║ 🔵 *MODERAÇÃO (ADMIN)*
║ ◽ !ban - Remover infrator
║ ◽ !link - Link do Grupo
║
╚═════════════════════════╝`;
                await socket.sendMessage(from, { text: menuPro });
            }

            // --- BUSCAS ESPECÍFICAS (FL STUDIO / BANDLAB / VOLOCO) ---
            if (command === "!flpc") {
                const s = await yts("FL Studio PC full version cracked tutorial 2024");
                await socket.sendMessage(from, { text: `💻 *FL STUDIO PC:* \n\n${s.videos[0].title}\n${s.videos[0].url}` });
            }

            if (command === "!flmobile") {
                const s = await yts("FL Studio Mobile ultima versão apk download");
                await socket.sendMessage(from, { text: `📱 *FL STUDIO MOBILE:* \n\n${s.videos[0].title}\n${s.videos[0].url}` });
            }

            if (command === "!bandlab" || command === "!voloco") {
                const s = await yts(`${command.slice(1)} tutorial download free`);
                await socket.sendMessage(from, { text: `🎵 *BUSCA MUSICAL:* \n\n${s.videos[0].title}\n${s.videos[0].url}` });
            }

            // --- COMANDOS DE BUSCA GERAL ---
            if (command === "!drums") {
                const s = await yts(query ? `drum kit ${query} free` : "best drum kits 2026");
                await socket.sendMessage(from, { text: `🥁 *DRUMS:* ${s.videos[0].url}` });
            }

            if (command === "!foto") {
                const s = await yts(query);
                await socket.sendMessage(from, { image: { url: s.videos[0].thumbnail }, caption: `🔵 *Capa Encontrada:* ${s.videos[0].title}` });
            }

            if (command === "!yt") {
                const s = await yts(query);
                await socket.sendMessage(from, { text: `📺 *YouTube:* ${s.videos[0].url}` });
            }

            // --- MODERAÇÃO ---
            if (command === "!ban" && isGroup) {
                let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [msg.message.extendedTextMessage?.contextInfo?.participant];
                if (users[0]) {
                    await socket.groupParticipantsUpdate(from, users, "remove");
                    await socket.sendMessage(from, { text: "🔴 Removido com sucesso." });
                }
            }

        } catch (e) { console.log(e); }
    });
}

startJackson();
