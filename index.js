import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// REGIÃO 1: SERVIDOR & ESTABILIDADE
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - MZ & AO Online'));
app.listen(port, '0.0.0.0');

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

    // =========================================================================
    // REGIÃO 2: BOAS-VINDAS (PERSONALIZADO - SEM SPAM)
    // =========================================================================
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔═══════ ✨ *BEM-VINDO* ✨ ═══════╗\n║ 👋 Olá, @${jid.split('@')[0]}!\n║ Que bom que vocês estão aqui para\n║ aprender mais sobre produção musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║ 🔵 Digite *.menu* para navegar.\n╚══════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: welcome, mentions: [jid] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => { if (u.connection === "close") startBot(); });

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

            // =====================================================================
            // 🧠 REGIÃO 3: CÉREBRO DE CAPTAÇÃO (DIFERENCIAÇÃO DE MÍDIA)
            // =====================================================================
            
            // 3.1. GRAVAÇÃO DE VOZ VS ÁUDIO EM ARQUIVO (MP3)
            if (type === 'audioMessage') {
                const isVoz = msg.message.audioMessage.ptt; // true = gravação microfone
                if (isVoz) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    if (isGroup) await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Música/Beat recebido. Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // 3.2. ÁUDIO EM DOCUMENTO (ZIP, RAR, MP3 DOCUMENTADO)
            if (type === 'documentMessage') {
                const mime = msg.message.documentMessage.mimetype;
                if (mime.includes('audio') || mime.includes('zip') || mime.includes('rar')) {
                    await socket.sendMessage(from, { react: { text: "📦", key: msg.key } });
                    if (isGroup) await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Documento de produção detectado (Beat/Sample Pack). Positivo, JACKSON@7VIDAS vai analisar esse arquivo._" }, { quoted: msg });
                    return;
                }
            }

            if (!isGroup) return;

            // =====================================================================
            // 🛡️ REGIÃO 4: XERIFE (ANTI-STATUS & LINKS)
            // =====================================================================
            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("@ este grupo foi mencionado");
            const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);

            if ((isStatus || isLink) && isBotAdmin && !isSenderAdmin) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await delay(300);
                await socket.sendMessage(from, { delete: msg.key });
                return;
            }

            // =====================================================================
            // 📝 REGIÃO 5: COMANDOS MANUAIS (.)
            // =====================================================================
            if (!textRaw.startsWith('.')) {
                // Auto-Responder Social (Só responde se a palavra for EXATA para não ser chato)
                const greets = ["oi", "olá", "kmk", "bom dia"];
                if (greets.includes(textLow)) {
                    await socket.sendMessage(from, { text: `🔵 Olá @${sender.split('@')[0]}! Que bom que estás aqui para aprender mais sobre produção musical! 🇲🇿🇦🇴`, mentions: [sender] }, { quoted: msg });
                }
                return;
            }

            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            switch (command) {
                case "menu":
                    await socket.sendMessage(from, { text: `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ .marcar | .link | .ban\n║ ◽ .infoadm | .infogrupo\n║\n║ ⚪ *PRODUÇÃO & BUSCAS*\n║ ◽ .play | .yt | .drums | .vst\n║ ◽ .apps | .dicas | .foto\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n╚══════════════════════════════════╝` });
                    break;
                
                case "marcar":
                    const promoText = `📢 🔴 *ＡＴＥＮＣ̧Ａ̃Ｏ ＭＥＭＢＲＯＳ* 🔴\n\n🚀 Vamos promover o grupo para que tenhamos mais produtores ativos! Atualmente o nosso número de membros é menor do que o necessário. Vamos crescer juntos! 🇲🇿🇦🇴\n\n🔗 *PARTILHEM O LINK:* https://chat.whatsapp.com/${await socket.groupInviteCode(from)}`;
                    await socket.sendMessage(from, { text: promoText, mentions: groupMetadata.participants.map(p => p.id) });
                    break;

                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - (msg.messageTimestamp * 1000)}ms\n🤖 *BOT:* Ativo 🇲🇿🇦🇴` });
                    break;
            }
        } catch (e) { console.log(e); }
    });
}
startBot();