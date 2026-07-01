import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic - Limpeza de Status Ativa'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor ativo na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

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
        browser: ['@7viDASBotMusic', 'Chrome', '1.0.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") startBot();
        if (u.connection === "open") console.log("✅ @7viDASBotMusic: TUDO ONLINE E LIMPANDO STATUS");
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

            // 1. CÉREBRO DE MÍDIA (VOZ VS BEAT)
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
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
                    // --- DETECÇÃO DE STATUS E SPAM ---
                    const isViewOnce = msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage; // Foto que se apaga
                    const mentionsStatus = textLow.includes("status") || textLow.includes("vê lá") || textLow.includes("ve la");
                    const isSharedStatus = type === 'protocolMessage' || msg.message.imageMessage?.viewOnce; 
                    const isLink = /(https?:\/\/|chat\.whatsapp\.com)/gi.test(textRaw);

                    if (isViewOnce || (mentionsStatus && msg.message.extendedTextMessage?.contextInfo?.mentionedJid) || isSharedStatus || isLink) {
                        await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                        await delay(500);
                        
                        // APAGAR DE VEZ
                        await socket.sendMessage(from, { 
                            delete: { remoteJid: from, fromMe: false, id: msg.key.id, participant: sender } 
                        });

                        let v = (global.advertencias.get(sender) || 0) + 1;
                        global.advertencias.set(sender, v);

                        if (v >= 3) {
                            await socket.groupParticipantsUpdate(from, [sender], "remove");
                            await socket.sendMessage(from, { text: `🔴 *EXPULSO:* @${sender.split('@')[0]} banido por spam de status/links.`, mentions: [sender] });
                        } else {
                            await socket.sendMessage(from, { text: `⚠️ *AVISO [${v}/3]* @${sender.split('@')[0]}, é proibido divulgar status ou links aqui!` });
                        }
                        return;
                    }
                }
            }

            // 2. SISTEMA DE COMANDOS (LIVRAMENTO DE ESPAÇO)
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            if (command === "menu") {
                const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗
║
║ 🔴 *MODERAÇÃO (AUTO)*
║ ◽ Anti-Status (Visualização Única)
║ ◽ Anti-Link | Anti-Bullying
║ ◽ Sistema de 3 Avisos (Auto-Ban)
║
║ ⚪ *PRODUÇÃO & BUSCAS*
║ ◽ !dicas [tema] | !apps [nome]
║ ◽ !drums | !vst | !yt | !foto
║
║ 👑 ADMIN: JACKSON@7VIDAS
╚══════════════════════════════╝`;
                await socket.sendMessage(from, { text: menu });
            }

            // ... (Resto dos comandos de busca como !yt, !dicas permanecem iguais)
            if (command === "yt") {
                const s = await yts(query || "jackson beatz");
                await socket.sendMessage(from, { text: `📺 *YouTube:* ${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
