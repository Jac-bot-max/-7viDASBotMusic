import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO Ativo'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

const REGRAS = `📜 *REGRAS JACKSON@7VIDAS*
🔵 Proibido links e mídias fora do tema.
🔴 Proibido menções de Status ou Spam.
⚪ Proibido Bullying ou Insultos.
⚠️ *3 Avisos = BAN AUTOMÁTICO!*`;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();
    const sessionID = process.env.SESSION_ID;

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        fs.writeFileSync('./session_data/creds.json', decoded);
    }

    const socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['7viDASBotMusic', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        if (action === 'add') {
            for (const num of participants) {
                try {
                    let foto;
                    try { foto = await socket.profilePictureUrl(num, 'image'); } catch { foto = 'https://i.imgur.com/6V69j9X.png'; }
                    await socket.sendMessage(id, { 
                        image: { url: foto }, 
                        caption: `👋 Olá @${num.split('@')[0]}!\nBem-vindo à família Jackson Beatz!\n\n${REGRAS}`, 
                        mentions: [num] 
                    });
                } catch (e) { console.log(e); }
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") startBot();
        if (u.connection === "open") console.log("✅ @7viDASBotMusic: PROTOCOLO ATIVADO");
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const sender = msg.key.participant || msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();

            if (type === 'audioMessage') {
                const isPTT = msg.message.audioMessage.ptt;
                if (isPTT) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    if (isGroup) await socket.sendMessage(from, { text: "⚪ *[ @7viDASBotMusic ]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                if (isBotAdmin && !isSenderAdmin) {
                    const linkRegex = /(https?:\/\/|chat\.whatsapp\.com)/gi;
                    const isSpamStatus = textRaw.toLowerCase().includes("status") && msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
                    const isMidia = (type === 'imageMessage' || type === 'videoMessage');

                    if (linkRegex.test(textRaw) || isMidia || isSpamStatus) {
                        await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                        await delay(800);
                        await socket.sendMessage(from, { delete: msg.key });

                        let avisos = (global.advertencias.get(sender) || 0) + 1;
                        global.advertencias.set(sender, avisos);

                        if (avisos >= 3) {
                            await socket.groupParticipantsUpdate(from, [sender], "remove");
                            await socket.sendMessage(from, { text: `🔴 *BANIDO:* @${sender.split('@')[0]} expulso por excesso de avisos.`, mentions: [sender] });
                        } else {
                            await socket.sendMessage(from, { text: `⚠️ *AVISO [${avisos}/3]* @${sender.split('@')[0]}.\nProibido links, spam ou mídias!`, mentions: [sender] });
                        }
                        return;
                    }
                }
            }

            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            if (command === "ping") await socket.sendMessage(from, { text: "🛰️ Jackson Beatz está voando!" });
            if (command === "menu") {
                const menu = `╔════ 🔵 *@7viDASBotMusic* 🔵 ════╗\n║\n║ 🔴 *MODERAÇÃO AUTO*\n║ ◽ Anti-Link | Anti-Spam\n║\n║ ⚪ *BUSCAS*\n║ ◽ !yt [busca] | !foto [nome]\n║ ◽ !drums [estilo]\n║\n║ 👑 JACKSON@7VIDAS\n╚══════════════════════════╝`;
                await socket.sendMessage(from, { text: menu });
            }
            if (command === "yt") {
                const s = await yts(query || "jackson beatz");
                await socket.sendMessage(from, { text: `📺 *YouTube:* ${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
