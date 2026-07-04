import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// ==========================================
// REGIÃO 1: ESTABILIDADE RENDER
// ==========================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic MZ & AO Ativo!'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Porta ${port} aberta`));

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

    // --- BOAS-VINDAS ---
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔══════ ⚪ *WELCOME* ⚪ ══════╗\n║ 👋 Olá @${jid.split('@')[0]}!\n║ Bem-vindo à união musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║ 🔵 Digite *!menu* para navegar.\n╚══════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: welcome, mentions: [jid] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            const reason = u.lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === "open") console.log("✅ @7viDASBotMusic: TUDO PRONTO");
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return; // Se for mensagem do próprio bot, ignora

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const sender = msg.key.participant || msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // --- 🧠 CÉREBRO DE MÍDIA (ÁUDIO/VÍDEO) ---
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

            // --- 🛡️ XERIFE (SÓ PARA GRUPOS) ---
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de");
                const isLink = /(https?:\/\/|chat\.whatsapp\.com)/gi.test(textRaw);

                if ((isStatus || isLink) && !isSenderAdmin && isBotAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(500);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA STATUS/LINKS
                    return;
                }
            }

            // --- 😊 RESPOSTAS SOCIAIS ---
            const saudações = ["oi", "olá", "ola", "kmk", "bom dia", "boa tarde", "boa noite"];
            if (saudações.includes(textLow)) {
                await socket.sendMessage(from, { text: `🔵 Olá @${sender.split('@')[0]}! Como está a produção? 🇲🇿🇦🇴`, mentions: [sender] }, { quoted: msg });
                return;
            }
            if (textLow.includes("obrigado")) return socket.sendMessage(from, { react: { text: "❤️", key: msg.key } });

            // --- 📝 COMANDOS (PRIVADO E GRUPO) ---
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            if (command === "menu") {
                const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ !infoadm | !infogrupo | !link\n║\n║ ⚪ *PRODUÇÃO & BUSCAS*\n║ ◽ !yt [busca] | !foto [nome]\n║ ◽ !drums [estilo] | !vst [nome]\n║ ◽ !apps [nome] | !dicas [tema]\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n╚══════════════════════════════╝`;
                await socket.sendMessage(from, { text: menu });
            }

            if (command === "infoadm") {
                await socket.sendMessage(from, { text: `╔══════ ✨ *ADMIN INFO* ✨ ══════╗\n║ 👑 *NOME:* JACKSON@7VIDAS\n║ 🎵 Cantor & Produtor\n║ 💻 Programador\n║ 📞 +258 87 733 8300\n╚══════ 🇲🇿 MZ & AO 🇦🇴 ══════╝` });
            }

            if (["yt", "drums", "vst", "apps", "dicas"].includes(command)) {
                await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                const s = await yts(query + (command === "apps" ? " apk" : " production"));
                if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO*\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
