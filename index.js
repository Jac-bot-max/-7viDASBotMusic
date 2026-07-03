import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// ==========================================
// REGIÃO 1: SERVIDOR (LIGA ANTES DE TUDO)
// ==========================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic Ativo e Vigilante! 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

async function startBot() {
    // ==========================================
    // REGIÃO 2: CONEXÃO & SESSÃO (ANTI-BAN)
    // ==========================================
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        fs.writeFileSync('./session_data/creds.json', Buffer.from(sessionID, 'base64').toString('utf-8'));
    }

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['7viDASBotMusic', 'Chrome', '1.0.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    // ==========================================
    // REGIÃO 3: BOAS-VINDAS (PERSONALIZADO)
    // ==========================================
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const txt = `👋 Olá @${jid.split('@')[0]}!\nBem-vindo ao *@7viDASBotMusic*\n🇲🇿 Moçambique & Angola 🇦🇴\n\n👑 *Cargo:* Produtor\n🎹 Digite *!menu* para navegar.`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: txt, mentions: [jid] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === "open") console.log("✅ @7viDASBotMusic: ONLINE");
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

            // ==========================================
            // REGIÃO 4: CÉREBRO DE MÍDIA (VOZ VS BEAT)
            // ==========================================
            if (type === 'audioMessage' || type === 'videoMessage') {
                const isVoz = msg.message?.audioMessage?.ptt;
                if (isVoz) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // ==========================================
            // REGIÃO 5: XERIFE MÃO DE FERRO (AUTO-BAN)
            // ==========================================
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                const isLink = /(https?:\/\/|chat\.whatsapp\.com)/gi.test(textRaw);
                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de");

                if ((isLink || isStatus) && !isSenderAdmin && isBotAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(500);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA
                    await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* Links/Status são proibidos aqui! Mantenha o grupo limpo. 🇲🇿🇦🇴` });
                    return;
                }
            }

            // ==========================================
            // REGIÃO 6: AUTO-RESPONDER (SOCIAL)
            // ==========================================
            const greets = ["oi", "olá", "ola", "kmk", "bom dia", "boa tarde", "boa noite"];
            if (greets.includes(textLow)) {
                await socket.sendMessage(from, { text: `🔵 Olá @${sender.split('@')[0]}! Como está a produção? 🇲🇿🇦🇴`, mentions:[sender]}, {quoted: msg});
                return;
            }

            // ==========================================
            // REGIÃO 7: COMANDOS MANUAIS
            // ==========================================
            if (!textRaw.startsWith('!')) return;
            const command = textLow.split(" ")[0].slice(1);
            const query = textRaw.slice(command.length + 2).trim();

            if (command === "menu") {
                await socket.sendMessage(from, { text: `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *XERIFE AUTOMÁTICO*\n║ ◽ Anti-Status | Anti-Link\n║ ◽ Auto-Ban membros comuns\n║\n║ ⚪ *BUSCAS PRO*\n║ ◽ !yt [busca] | !foto [nome]\n║ ◽ !drums [estilo] | !vst [nome]\n║ ◽ !infoadm | !infogrupo\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n╚══════════════════════════════╝` });
            }

            if (command === "yt" || command === "drums" || command === "vst") {
                await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                const s = await yts(query || "jackson beatz");
                if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO:* ${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

            if (command === "infoadm") {
                await socket.sendMessage(from, { text: `👑 *NOME:* JACKSON@7VIDAS\n🎵 Cantor & Produtor\n💻 Programador\n📞 +258 87 733 8300\n🇲🇿 MZ & AO 🇦🇴` });
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
