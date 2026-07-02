import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- SERVIDOR PARA MANTER ONLINE NO RENDER ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic Online - União Moçambique & Angola'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor ativo na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

// ESTILIZAÇÃO E PERSONALIDADE
const REGRAS = `📜 *REGRAS JACKSON@7VIDAS*
🔵 Proibido links e mídias fora do tema.
🔴 Proibido divulgar STATUS ou ESTADOS.
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
        browser: ['7viDASBotMusic', 'Chrome', '1.0.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    // --- BOAS-VINDAS PERSONALIZADAS (MZ & AO) ---
    socket.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        if (action === 'add') {
            for (const num of participants) {
                try {
                    let foto;
                    try { foto = await socket.profilePictureUrl(num, 'image'); } catch { foto = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcomeTxt = `╔══════ ⚪ *WELCOME* ⚪ ══════╗\n║\n║ 👋 Olá @${num.split('@')[0]}!\n║ Bem-vindo à elite musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║\n║ 🔵 Digite *!menu* para navegar.\n║\n╚══════════════════════════╝`;
                    await socket.sendMessage(id, { image: { url: foto }, caption: welcomeTxt, mentions: [num] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") startBot();
        if (u.connection === "open") console.log("✅ @7viDASBotMusic: CONECTADO - UNIÃO MZ & AO");
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
            const textLow = textRaw.toLowerCase();

            // --- 🧠 CÉREBRO SOCIAL (RESPOSTAS EDUCADAS) ---
            if (textLow === "oi" || textLow === "olá" || textLow === "olá família") {
                await socket.sendMessage(from, { text: `⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 Olá @${sender.split('@')[0]}! Como está a produção por aí? 🇲🇿🇦🇴`, mentions: [sender] }, { quoted: msg });
                return;
            }

            if (textLow.includes("tudo bem") || textLow.includes("kmk")) {
                await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 Tudo excelente por aqui! Focado em organizar o grupo para os melhores produtores. 🎹🚀" }, { quoted: msg });
                return;
            }

            // --- 🎹 CÉREBRO DE ÁUDIO (VOZ VS BEAT) ---
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    if (isGroup) await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            if (!isGroup) return;

            // --- 🛡️ XERIFE AUTOMÁTICO (STATUS / LINK / MÍDIA) ---
            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            const isStatus = type === 'protocolMessage' || type === 'senderKeyDistributionMessage' || msg.message?.statusMentionMessage || textLow.includes("estado de") || textLow.includes("status de");
            const isLink = /(https?:\/\/|chat\.whatsapp\.com)/gi.test(textRaw);
            const isMidia = (type === 'imageMessage' || type === 'videoMessage');

            if ((isStatus || isLink || isMidia) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await delay(500);
                await socket.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: msg.key.id, participant: sender } });

                let v = (global.advertencias.get(sender) || 0) + 1;
                global.advertencias.set(sender, v);

                if (v >= 3) {
                    await socket.groupParticipantsUpdate(from, [sender], "remove");
                    await socket.sendMessage(from, { text: `🔴 *BANIDO:* @${sender.split('@')[0]} expulso por spam de status/mídia.`, mentions: [sender] });
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *AVISO [${v}/3]* @${sender.split('@')[0]}.\nPROIBIDO STATUS, LINKS OU FOTOS FORA DO TEMA!` });
                }
                return;
            }

            // --- 📝 COMANDOS ---
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            if (command === "menu") {
                const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗
║
║ 🔴 *XERIFE AUTO (MZ & AO)*
║ ◽ Anti-Status (Apaga na hora)
║ ◽ Anti-Link | Anti-Mídia
║ ◽ Auto-Ban (3 Advertências)
║
║ ⚪ *PRODUÇÃO & BUSCAS*
║ ◽ !yt [busca] | !foto [nome]
║ ◽ !dicas [tema] | !apps [nome]
║ ◽ !drums [estilo] | !vst [nome]
║
║ 🔵 *STATUS DO BOT*
║ ◽ !ping - Velocidade
║ ◽ !link - Link do Grupo
║
║ 👑 ADMIN: JACKSON@7VIDAS
╚══════════════════════════════╝`;
                await socket.sendMessage(from, { text: menu });
            }

            if (command === "ping") {
                const start = Date.now();
                await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - start}ms\n🤖 *BOT:* @7viDASBotMusic\n🇲🇿 *UNIÃO:* Moçambique & Angola 🇦🇴` });
            }

            if (command === "yt" || command === "dicas" || command === "apps") {
                const q = query || "jackson beatz production";
                const s = await yts(q + (command === "apps" ? " app download" : " tutorial"));
                if (s.videos[0]) {
                    await socket.sendMessage(from, { text: `📺 *RESULTADO @7viDASBo
