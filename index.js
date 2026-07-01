import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- SERVIDOR PARA MANTER ONLINE NO RENDER ---
const app = express();
app.get('/', (req, res) => res.send('@7viDASBotMusic Online - ADM: JACKSON@7VIDAS'));
app.listen(process.env.PORT || 3000);

const advertencias = new Map();

async function startBot() {
    // Recuperação de Sessão via Chave (SESSION_ID)
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
        browser: ["@7viDASBotMusic", "Safari", "1.0.0"]
    });

    socket.ev.on("creds.update", saveCreds);

    // --- BOAS-VINDAS ---
    socket.ev.on("group-participants.update", async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                const welcome = `╔═════ ⚪ *WELCOME* ⚪ ═════╗\n║\n║ 👋 Olá, @${jid.split('@')[0]}!\n║ Bem-vindo ao *@7viDASBotMusic*.\n║ 👑 ADM: *JACKSON@7VIDAS*\n║\n║ 🔵 Use *!menu* para navegar.\n║\n╚══════════════════════════╝`;
                await socket.sendMessage(anu.id, { text: welcome, mentions: [jid] });
            }
        }
    });

    socket.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startBot();
        if (connection === "open") console.log("✅ @7viDASBotMusic: ONLINE");
    });

    socket.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();
            const sender = msg.key.participant || msg.key.remoteJid;

            if (!isGroup) return;

            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            // --- 1. ANTI-BULLYING (BAN IMEDIATO) ---
            const bullying = ["bullying", "bully", "preto", "macaco", "lixo", "verme", "anormal", "aleijado", "burro", "estupido"];
            if (bullying.some(p => text.includes(p)) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "🚫", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });
                await socket.groupParticipantsUpdate(from, [sender], "remove");
                await socket.sendMessage(from, { text: `🔴 *BANIDO POR BULLYING* 🔴\n\n@${sender.split('@')[0]} expulso por desrespeito.`, mentions: [sender] });
                return;
            }

            // --- 2. ANTI-LINK E MÍDIA (3 AVISOS) ---
            const linkRegex = /(https?:\/\/|chat\.whatsapp\.com)/gi;
            const isMedia = (type === 'imageMessage' || type === 'videoMessage');

            if ((linkRegex.test(text) || isMedia) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });

                let avisos = (advertencias.get(sender) || 0) + 1;
                advertencias.set(sender, avisos);

                if (avisos >= 3) {
                    await socket.groupParticipantsUpdate(from, [sender], "remove");
                    await socket.sendMessage(from, { text: `🔴 *LIMITE ATINGIDO:* @${sender.split('@')[0]} expulso.`, mentions: [sender] });
                    advertencias.delete(sender);
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *AVISO [${avisos}/3]:* @${sender.split('@')[0]}, não envie links/mídia.`, mentions: [sender] });
                }
                return;
            }

            // --- 3. REAÇÃO INSTRUMENTAL ---
            if (type === 'audioMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[ @7viDASBotMusic ]* ⚪\n\n🔵 _Instrumental recebido. Positivo, JACKSON@7VIDAS vai analisar._" }, { quoted: msg });
                return;
            }

            const args = text.split(" ");
            const command = args[0];
            const query = text.slice(command.length).trim();

            // --- 4. COMANDOS ---

            if (command === "!ping") {
                const start = Date.now();
                await socket.sendMessage(from, { text: "🚀 _Ping..._" });
                await socket.sendMessage(from, { text: `🔵 *LATÊNCIA:* ${Date.now() - start}ms\n⚪ *NOME:* @7viDASBotMusic\n🔴 *ADM:* JACKSON@7VIDAS` });
            }

            if (command === "!menu") {
                const menu = `╔════ 🔵 *@7viDASBotMusic* 🔵 ════╗
║
║ 🔴 *SOFTWARES & PRODUÇÃO*
║ ◽ !flpc | !flmobile
║ ◽ !bandlab | !voloco
║ ◽ !drums [estilo]
║ ◽ !vst [nome]
║
║ ⚪ *BUSCAS YT*
║ ◽ !foto [nome]
║ ◽ !yt [busca] (Com Canal)
║ ◽ !ping (Velocidade)
║
║ 🔵 *MODERAÇÃO & ADM*
║ ◽ !link | !ban
║ 👑 *ADM:* JACKSON@7VIDAS
║
╚══════════════════════════╝`;
                await socket.sendMessage(from, { text: menu });
            }

            if (command === "!yt") {
                if (!query) return;
                const s = await yts(query);
                if (s.videos[0]) {
                    const v = s.videos[0];
                    await socket.sendMessage(from, { text: `📺 *YouTube Search*\n\n🔵 *Título:* ${v.title}\n⚪ *Link:* ${v.url}\n🔴 *Canal:* ${v.author.name}\n🔗 *Link Canal:* ${v.author.url}` });
                }
            }

            if (command === "!foto") {
                const s = await yts(query);
                if (s.videos[0]) await socket.sendMessage(from, { image: { url: s.videos[0].thumbnail }, caption: `🔵 *Thumbnail Encontrada por @7viDASBotMusic*` });
            }

            if (command === "!drums" || command === "!vst" || command === "!flpc" || command === "!flmobile") {
                const s = await yts(`${command.slice(1)} ${query || 'free download'}`);
                await socket.sendMessage(from, { text: `🥁 *DRUMS/SOFTWARE:* \n\n${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

            if (command === "!link" && isBotAdmin) {
                const code = await socket.groupInviteCode(from);
                await socket.sendMessage(from, { text: `🔗 *LINK DO GRUPO:*\nhttps://chat.whatsapp.com/${code}` });
            }

            if (command === "!ban" && isSenderAdmin && isBotAdmin) {
                let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [msg.message.extendedTextMessage?.contextInfo?.participant];
                if (users[0]) await socket.groupParticipantsUpdate(from, users, "remove");
            }

        } catch (e) { console.log(e); }
    });
}

startBot();
