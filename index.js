import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema de Elite Ativo'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        fs.writeFileSync('./session_data/creds.json', decoded);
    }

    const socket = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['7viDASBotMusic PRO', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") startBot();
        if (u.connection === "open") console.log("✅ @7viDASBotMusic: TUDO PRONTO - ADMIN ATIVO");
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const sender = msg.key.participant || msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // --- 🧠 CÉREBRO SOCIAL & MÍDIA ---
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            if (!isGroup) return;

            // --- 🛡️ REGIÃO DE ADMINISTRAÇÃO (O QUE ESTAVA A FALHAR) ---
            const groupMetadata = await socket.groupMetadata(from);
            const participants = groupMetadata.participants;
            const admins = participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            // 1. MODERAÇÃO AUTOMÁTICA (APAGAR LINKS E STATUS)
            const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("estado de");
            const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);

            if ((isStatus || isLink) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await delay(300);
                await socket.sendMessage(from, { delete: msg.key }); // APAGA A MENSAGEM
                await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* Links e Status são proibidos. Mantenha o grupo limpo! 🇲🇿🇦🇴` });
                return;
            }

            // 2. COMANDOS MANUAIS
            if (!textRaw.startsWith('!')) {
                // Respostas Sociais (Oi, Kmk)
                const saudações = ["oi", "olá", "ola", "kmk", "bom dia", "boa tarde", "boa noite"];
                if (saudações.includes(textLow)) {
                    await socket.sendMessage(from, { text: `✨ *[@7viDASBotMusic]* ✨\n\n🔵 Olá @${sender.split('@')[0]}! Como está a produção? 🇲🇿🇦🇴`, mentions: [sender] }, { quoted: msg });
                }
                return;
            }

            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;

            // --- FUNÇÕES DE COMANDO ---
            switch (command) {
                case "menu":
                    const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ !link | !ban | !warn\n║ ◽ !promover | !marcar\n║\n║ ⚪ *PRODUÇÃO & BUSCAS*\n║ ◽ !yt [busca] | !foto [nome]\n║ ◽ !drums [estilo] | !vst [nome]\n║ ◽ !apps [nome] | !dicas [tema]\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n╚══════════════════════════════╝`;
                    await socket.sendMessage(from, { text: menu });
                    break;

                case "link":
                    if (!isBotAdmin) return socket.sendMessage(from, { text: "❌ Preciso ser Admin primeiro!" });
                    const code = await socket.groupInviteCode(from);
                    await socket.sendMessage(from, { text: `🔗 *LINK:* https://chat.whatsapp.com/${code}` });
                    break;

                case "ban":
                    if (!isSenderAdmin || !isBotAdmin) return;
                    if (target) {
                        await socket.groupParticipantsUpdate(from, [target], "remove");
                        await socket.sendMessage(from, { text: "✅ Infrator removido com sucesso." });
                    }
                    break;

                case "yt": case "dicas": case "apps":
                    await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                    const s = await yts(query || "jackson beatz production");
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO*\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
                    break;

                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* Estável\n🤖 *BOT:* @7viDASBotMusic Online` });
                    break;
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
