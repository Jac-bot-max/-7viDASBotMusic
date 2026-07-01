import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
app.get('/', (req, res) => res.send('Jackson Beatz V3 PRO - Ativo'));
app.listen(process.env.PORT || 3000);

// Memória de Advertências (Reseta se o bot reiniciar, mas o Cron-job mantém vivo)
const advertencias = new Map();

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

            // --- 1. FILTRO ANTI-BULLYING / INSULTOS (BAN IMEDIATO) ---
            const insultos = ["bullying", "bully", "macaco", "preto", "estupido", "burro", "lixo", "verme", "anormal", "aleijado", "fdp"];
            if (insultos.some(p => text.includes(p)) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "🚫", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });
                await socket.groupParticipantsUpdate(from, [sender], "remove");
                await socket.sendMessage(from, { text: `🔴 *SISTEMA ANTI-BULLYING* 🔴\n\nO usuário @${sender.split('@')[0]} foi banido por falta de respeito ou bullying.`, mentions: [sender] });
                return;
            }

            // --- 2. ANTI-LINK E MÍDIA IRRELEVANTE (SISTEMA DE 3 AVISOS) ---
            const linkRegex = /(https?:\/\/|chat\.whatsapp\.com)/gi;
            const isMediaNaoBeat = (type === 'imageMessage' || type === 'videoMessage') && !isSenderAdmin;

            if ((linkRegex.test(text) || isMediaNaoBeat) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });

                let avisos = (advertencias.get(sender) || 0) + 1;
                advertencias.set(sender, avisos);

                if (avisos >= 3) {
                    await socket.groupParticipantsUpdate(from, [sender], "remove");
                    await socket.sendMessage(from, { text: `🔴 *EXPULSO:* @${sender.split('@')[0]} atingiu o limite de 3 advertências.`, mentions: [sender] });
                    advertencias.delete(sender);
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *ADVERTÊNCIA [${avisos}/3]*\n\n@${sender.split('@')[0]}, não envie links ou fotos/vídeos. Use apenas ÁUDIO para beats. No 3º erro é banimento.`, mentions: [sender] });
                }
                return;
            }

            // --- 3. REAÇÃO PARA INSTRUMENTAIS (ÁUDIO) ---
            if (type === 'audioMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[ JACKSON BEATZ ]* ⚪\n\n🔵 _Positivo, alguém vai reagir ou alguém vai analisar esta obra._" }, { quoted: msg });
                return;
            }

            const args = text.split(" ");
            const command = args[0];
            const query = text.slice(command.length).trim();

            // --- MENU PROFISSIONAL ESTILIZADO ---
            if (command === "!menu") {
                const menuPro = `╔═════ 🔵 *JACKSON BEATZ V3* 🔵 ═════╗
║
║ 🔴 *ESTÚDIO & PRODUÇÃO*
║ ◽ !drums [estilo] - Packs YouTube
║ ◽ !vst [nome] - Plugins/VSTs
║ ◽ !flpc - FL Studio para PC
║ ◽ !flmobile - FL Studio Mobile
║ ◽ !bandlab - Tudo BandLab
║ ◽ !voloco - Tudo Voloco
║
║ ⚪ *UTILITÁRIOS & BUSCAS*
║ ◽ !foto [nome] - Capa de vídeo
║ ◽ !yt [busca] - Vídeo + Canal
║
║ 🔵 *MODERAÇÃO & GRUPO*
║ ◽ !link - Link do grupo
║ ◽ !ban - Banir (Marcar user)
║
║ ⚠️ *AVISO:* Links e mídia (sem ser beat)
║ resultam em advertência (3x = BAN).
║ Bullying e insultos = BAN IMEDIATO!
╚═══════════════════════════════╝`;
                await socket.sendMessage(from, { text: menuPro });
            }

            // --- COMANDOS DE BUSCA (YT / FOTO) ---
            if (command === "!yt") {
                if (!query) return;
                const s = await yts(query);
                if (s.videos[0]) {
                    const v = s.videos[0];
                    const msgYt = `📺 *YOUTUBE SEARCH*\n\n🔵 *Título:* ${v.title}\n⚪ *Link:* ${v.url}\n🔴 *Canal:* ${v.author.name}\n🔗 *Link Canal:* ${v.author.url}`;
                    await socket.sendMessage(from, { text: msgYt });
                }
            }

            if (command === "!foto") {
                const s = await yts(query);
                if (s.videos[0]) {
                    await socket.sendMessage(from, { image: { url: s.videos[0].thumbnail }, caption: `🔵 *Capa:* ${s.videos[0].title}` });
                }
            }

            // --- COMANDOS DE SOFTWARE E SAMPLES ---
            if (command === "!flpc") {
                const s = await yts("FL Studio PC latest version full download");
                await socket.sendMessage(from, { text: `💻 *FL STUDIO PC:* \n\n${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

            if (command === "!flmobile") {
                const s = await yts("FL Studio Mobile apk download latest");
                await socket.sendMessage(from, { text: `📱 *FL STUDIO MOBILE:* \n\n${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

            if (command === "!drums" || command === "!vst" || command === "!bandlab" || command === "!voloco") {
                const s = await yts(`${command.slice(1)} ${query || 'pack free'}`);
                await socket.sendMessage(from, { text: `🥁 *BUSCA MUSICAL:* \n\n${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

            // --- MODERAÇÃO MANUAL ---
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
