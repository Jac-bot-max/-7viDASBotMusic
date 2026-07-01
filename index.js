import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
app.get('/', (req, res) => res.send('Jackson Beatz V3 PRO - Sistema Online'));
app.listen(process.env.PORT || 3000);

// Memória de Advertências
const advertencias = new Map();

async function startJackson() {
    // Recuperação de Sessão via Environment Variable (SESSION_ID)
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

    // --- BOAS-VINDAS ---
    socket.ev.on("group-participants.update", async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                const welcome = `╔═════ ⚪ *BEM-VINDO(A)* ⚪ ═════╗\n║\n║ 👋 Olá, @${jid.split('@')[0]}!\n║ Bem-vindo à família *Jackson Beatz*.\n║\n║ 🔵 Digite *!menu* para ver os comandos.\n║ 🔴 Leia as regras para evitar banimento.\n║\n╚═══════════════════════════╝`;
                await socket.sendMessage(anu.id, { text: welcome, mentions: [jid] });
            }
        }
    });

    socket.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startJackson();
        if (connection === "open") console.log("✅ JACKSON BEATZ PRO: CONECTADO E PROTEGIDO");
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

            // --- 1. FILTRO ANTI-BULLYING (BAN IMEDIATO) ---
            const bullying = ["bullying", "bully", "macaco", "preto", "estupido", "burro", "lixo", "verme", "anormal"];
            if (bullying.some(p => text.includes(p)) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "🚫", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });
                await socket.groupParticipantsUpdate(from, [sender], "remove");
                await socket.sendMessage(from, { text: `🔴 *BANIMENTO POR BULLYING* 🔴\n\nO usuário @${sender.split('@')[0]} foi removido por falta de respeito e prática de bullying.`, mentions: [sender] });
                return;
            }

            // --- 2. ANTI-LINK E FILTRO DE MÍDIA (3 ADVERTÊNCIAS) ---
            const linkRegex = /(https?:\/\/|chat\.whatsapp\.com)/gi;
            const isMediaInvalida = (type === 'imageMessage' || type === 'videoMessage') && !isSenderAdmin;

            if ((linkRegex.test(text) || isMediaInvalida) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });

                let avisos = (advertencias.get(sender) || 0) + 1;
                advertencias.set(sender, avisos);

                if (avisos >= 3) {
                    await socket.groupParticipantsUpdate(from, [sender], "remove");
                    await socket.sendMessage(from, { text: `🔴 *LIMITE ATINGIDO* 🔴\n\n@${sender.split('@')[0]} foi banido por ignorar as 3 advertências.`, mentions: [sender] });
                    advertencias.delete(sender);
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *ADVERTÊNCIA [${avisos}/3]*\n\n@${sender.split('@')[0]}, não envie links ou fotos/vídeos que não sejam beats. Próximo erro é BAN.`, mentions: [sender] });
                }
                return;
            }

            // --- 3. REAÇÃO PARA BEATS (ÁUDIO) ---
            if (type === 'audioMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[ JACKSON BEATZ ]* ⚪\n\n🔵 _Positivo, instrumental recebido. Alguém vai analisar ou reagir em breve._" }, { quoted: msg });
                return;
            }

            // --- COMANDOS ---
            const args = text.split(" ");
            const command = args[0];
            const query = text.slice(command.length).trim();

            if (command === "!menu") {
                const menuPro = `╔═════ 🔵 *JACKSON BEATZ V3* 🔵 ═════╗
║
║ 🔴 *SOFTWARES & APPS*
║ ◽ !flpc - FL Studio PC (Full)
║ ◽ !flmobile - FL Studio Mobile
║ ◽ !bandlab - Tudo BandLab
║ ◽ !voloco - Tudo Voloco
║
║ ⚪ *PRODUÇÃO MUSICAL*
║ ◽ !drums [estilo] - Packs YouTube
║ ◽ !vst [nome] - Plugins YouTube
║
║ 🔵 *BUSCAS & MODERAÇÃO*
║ ◽ !foto [nome] - Capa do Vídeo
║ ◽ !yt [busca] - Vídeo + Canal
║ ◽ !ban - Remover (Admin)
║ ◽ !link - Link do Grupo
║
╚═════════════════════════╝`;
                await socket.sendMessage(from, { text: menuPro });
            }

            // COMANDO YT (COM CANAL)
            if (command === "!yt") {
                if (!query) return;
                const s = await yts(query);
                if (s.videos[0]) {
                    const v = s.videos[0];
                    const msgYt = `📺 *YOUTUBE SEARCH*\n\n🔵 *Título:* ${v.title}\n⚪ *Link:* ${v.url}\n🔴 *Canal:* ${v.author.name}\n🔗 *Link Canal:* ${v.author.url}`;
                    await socket.sendMessage(from, { text: msgYt });
                }
            }

            // COMANDO FOTO
            if (command === "!foto") {
                const s = await yts(query);
                if (s.videos[0]) {
                    await socket.sendMessage(from, { image: { url: s.videos[0].thumbnail }, caption: `🔵 *Capa:* ${s.videos[0].title}` });
                }
            }

            // COMANDOS DE SOFTWARE
            if (command === "!flpc" || command === "!flmobile") {
                const s = await yts(command === "!flpc" ? "FL Studio PC latest download" : "FL Studio Mobile apk download latest");
                await socket.sendMessage(from, { text: `💻 *SOFTWARE:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
            }

            if (command === "!drums" || command === "!vst" || command === "!bandlab" || command === "!voloco") {
                const s = await yts(`${command.slice(1)} ${query || 'pack free download'}`);
                await socket.sendMessage(from, { text: `🥁 *BUSCA MUSICAL:* \n\n${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

            // MODERAÇÃO MANUAL
            if (command === "!ban" && isSenderAdmin && isBotAdmin) {
                let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [msg.message.extendedTextMessage?.contextInfo?.participant];
                if (users[0]) {
                    await socket.groupParticipantsUpdate(from, users, "remove");
                    await socket.sendMessage(from, { text: "🔵 Usuário removido." });
                }
            }

        } catch (e) { console.log(e); }
    });
}

startJackson();
