import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- SERVIDOR PARA MANTER ONLINE ---
const app = express();
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema Inteligente'));
app.listen(process.env.PORT || 3000);

const warnDB = new Map();

async function startBot() {
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

    // --- BOAS-VINDAS COM FOTO ---
    socket.ev.on("group-participants.update", async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let ppUrl;
                    try { ppUrl = await socket.profilePictureUrl(jid, 'image'); } catch { ppUrl = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔══════ ⚪ *WELCOME* ⚪ ══════╗\n║\n║ 👋 Olá, @${jid.split('@')[0]}!\n║ Bem-vindo ao *@7viDASBotMusic*.\n║ 👑 ADM: *JACKSON@7VIDAS*\n║\n║ 🔵 Use *!menu* para navegar.\n║\n╚════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: ppUrl }, caption: welcome, mentions: [jid] });
                } catch (e) { console.log(e); }
            }
        }
    });

    socket.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startBot();
        if (connection === "open") console.log("✅ @7viDASBotMusic: ONLINE - LÓGICA DE ESPAÇO ATIVA");
    });

    socket.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
            const sender = msg.key.participant || msg.key.remoteJid;

            if (!isGroup) return;

            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            // --- REAÇÃO INSTRUMENTAL ---
            if (type === 'audioMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[ @7viDASBotMusic ]* ⚪\n\n🔵 _Instrumental recebido. JACKSON@7VIDAS vai analisar._" }, { quoted: msg });
                return;
            }

            // --- LÓGICA DE ESPAÇO DE LIVRAMENTO (SMART PARSER) ---
            if (!textRaw.startsWith('!')) return;
            
            // Separa o comando da busca, não importa quantos espaços existam
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase(); // Pega a primeira palavra sem o !
            const query = args.join(" "); // Junta o resto com espaço único

            // 1. MENU
            if (command === "menu") {
                const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗
║
║ 🔴 *ADMINISTRAÇÃO*
║ ◽ !warn | !unwarn | !ban
║ ◽ !warnlist | !link
║
║ ⚪ *PRODUÇÃO & BUSCAS*
║ ◽ !yt [busca] | !foto [nome]
║ ◽ !drums [estilo] | !vst [nome]
║ ◽ !flpc | !flmobile
║
║ 🔵 *STATUS*
║ ◽ !ping - Velocidade
║
║ 👑 ADM: JACKSON@7VIDAS
╚══════════════════════════════╝`;
                await socket.sendMessage(from, { text: menu });
            }

            // 2. PING
            if (command === "ping") {
                const start = Date.now();
                await socket.sendMessage(from, { text: `🔵 *LATÊNCIA:* ${Date.now() - start}ms\n⚪ *BOT:* @7viDASBotMusic\n🔴 *MODO:* Otimizado` });
            }

            // 3. YOUTUBE (COM LIVRAMENTO DE ESPAÇO)
            if (command === "yt") {
                if (!query) return socket.sendMessage(from, { text: "❓ _Diga o que buscar. Ex: !yt amapiano_" });
                const s = await yts(query);
                if (s.videos[0]) {
                    const v = s.videos[0];
                    await socket.sendMessage(from, { text: `📺 *YouTube Search*\n\n🔵 *Título:* ${v.title}\n⚪ *Link:* ${v.url}\n🔴 *Canal:* ${v.author.name}\n🔗 *Canal Link:* ${v.author.url}` });
                }
            }

            // 4. FOTO
            if (command === "foto") {
                if (!query) return;
                const s = await yts(query);
                if (s.videos[0]) {
                    await socket.sendMessage(from, { image: { url: s.videos[0].thumbnail }, caption: `🔵 *Thumbnail:* ${s.videos[0].title}` });
                }
            }

            // 5. DRUMS / VST / SOFTWARE
            if (command === "drums" || command === "vst" || command === "flpc" || command === "flmobile") {
                const q = query || (command === "flpc" ? "fl studio pc" : "drum pack");
                const s = await yts(q + " download free");
                await socket.sendMessage(from, { text: `🥁 *ENCONTRADO:* \n\n${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

            // 6. ADM - WARN / BAN / LINK
            if (command === "warn" && isSenderAdmin && isBotAdmin) {
                const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
                if (!target) return;
                let count = (warnDB.get(target) || 0) + 1;
                warnDB.set(target, count);
                if (count >= 3) {
                    await socket.groupParticipantsUpdate(from, [target], "remove");
                    await socket.sendMessage(from, { text: "🔴 *BANIDO:* 3 Advertências atingidas." });
                    warnDB.delete(target);
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *AVISO [${count}/3]* para @${target.split('@')[0]}`, mentions: [target] });
                }
            }

            if (command === "link" && isBotAdmin) {
                const code = await socket.groupInviteCode(from);
                await socket.sendMessage(from, { text: `🔗 *LINK DO GRUPO:* https://chat.whatsapp.com/${code}` });
            }

        } catch (e) { console.log("Erro:", e); }
    });
}

startBot();
