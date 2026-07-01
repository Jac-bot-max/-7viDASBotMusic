import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
app.get('/', (req, res) => res.send('Jackson Beatz V3 PRO - Sistema Online'));
app.listen(process.env.PORT || 3000);

const advertencias = new Map();

async function startJackson() {
    // RECUPERAÇÃO DE SESSÃO (SESSION_ID)
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

    // --- SISTEMA DE BOAS-VINDAS (WELCOME) ---
    socket.ev.on("group-participants.update", async (anu) => {
        if (anu.action === 'add') {
            const metadata = await socket.groupMetadata(anu.id);
            for (let jid of anu.participants) {
                const welcomeMsg = `╔═════ ⚪ *WELCOME* ⚪ ═════╗
║
║ 👋 Olá, @${jid.split('@')[0]}!
║ Bem-vindo(a) à *${metadata.subject}*.
║
║ 🔵 Aqui a música não para!
║ 🔴 Digite *!menu* para ver os comandos.
║ ⚪ Siga as regras para não ser banido.
║
╚══════════════════════════╝`;
                await socket.sendMessage(anu.id, { text: welcomeMsg, mentions: [jid] });
            }
        }
    });

    socket.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startJackson();
        if (connection === "open") console.log("✅ JACKSON BEATZ PRO: CONECTADO");
    });

    socket.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
            const sender = msg.key.participant || msg.key.remoteJid;

            if (!isGroup) return;

            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            // --- DETECTOR DE INSTRUMENTAL (ÁUDIO) ---
            if (type === 'audioMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[ JACKSON BEATZ ]* ⚪\n\n🔵 _Instrumental recebido. Positivo, alguém vai analisar esta obra._" }, { quoted: msg });
                return;
            }

            // --- ANTI-BULLYING (BAN IMEDIATO) ---
            const bullying = ["bullying", "bully", "preto", "macaco", "estupido", "burro", "lixo", "verme", "anormal", "aleijado"];
            if (bullying.some(p => text.includes(p)) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "🚫", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });
                await socket.groupParticipantsUpdate(from, [sender], "remove");
                await socket.sendMessage(from, { text: `🔴 *BANIMENTO POR BULLYING* 🔴\n\nUsuário @${sender.split('@')[0]} removido por desrespeito.`, mentions: [sender] });
                return;
            }

            // --- ANTI-LINK E MÍDIA (3 AVISOS) ---
            const linkRegex = /(https?:\/\/|chat\.whatsapp\.com)/gi;
            const isMediaInvalida = (type === 'imageMessage' || type === 'videoMessage');

            if ((linkRegex.test(text) || isMediaInvalida) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });

                let avisos = (advertencias.get(sender) || 0) + 1;
                advertencias.set(sender, avisos);

                if (avisos >= 3) {
                    await socket.groupParticipantsUpdate(from, [sender], "remove");
                    await socket.sendMessage(from, { text: `🔴 *EXPULSO:* @${sender.split('@')[0]} atingiu 3 avisos.`, mentions: [sender] });
                    advertencias.delete(sender);
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *AVISO [${avisos}/3]*\n\n@${sender.split('@')[0]}, evite links e fotos/vídeos que não sejam beats.`, mentions: [sender] });
                }
                return;
            }

            // --- COMANDOS ---
            const args = text.split(" ");
            const command = args[0];
            const query = text.slice(command.length).trim();

            if (command === "!menu") {
                const menuPro = `╔══════ 🔵 *JACKSON BEATZ* 🔵 ══════╗
║
║ 🔴 *SOFTWARES*
║ ◽ !flpc | !flmobile
║ ◽ !bandlab | !voloco
║
║ ⚪ *PRODUÇÃO*
║ ◽ !drums [estilo]
║ ◽ !vst [nome]
║
║ 🔵 *BUSCAS & ADM*
║ ◽ !foto [nome] | !yt [busca]
║ ◽ !link | !ban
║
╚════════════════════════════╝`;
                await socket.sendMessage(from, { text: menuPro });
            }

            if (command === "!link" && isBotAdmin) {
                const code = await socket.groupInviteCode(from);
                await socket.sendMessage(from, { text: `🔗 *LINK:* https://chat.whatsapp.com/${code}` });
            }

            if (command === "!yt") {
                const s = await yts(query || "jackson beatz");
                const v = s.videos[0];
                if (v) {
                    await socket.sendMessage(from, { text: `📺 *YouTube:* ${v.title}\n🔗 ${v.url}\n👤 *Canal:* ${v.author.name}\n🔗 ${v.author.url}` });
                }
            }

            if (command === "!foto") {
                const s = await yts(query);
                if (s.videos[0]) {
                    await socket.sendMessage(from, { image: { url: s.videos[0].thumbnail }, caption: `🔵 *Capa:* ${s.videos[0].title}` });
                }
            }

            if (command === "!drums" || command === "!vst" || command === "!flpc" || command === "!flmobile") {
                const s = await yts(`${command.slice(1)} ${query || 'latest download'}`);
                await socket.sendMessage(from, { text: `🥁 *ENCONTRADO:* \n\n${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

            if (command === "!ban" && isSenderAdmin && isBotAdmin) {
                let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [msg.message.extendedTextMessage?.contextInfo?.participant];
                if (users[0]) await socket.groupParticipantsUpdate(from, users, "remove");
            }

        } catch (e) { console.log(e); }
    });
}

startJackson();
