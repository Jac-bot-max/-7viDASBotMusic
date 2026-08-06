import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// REGIÃO 1: SERVIDOR & IA (ESTABILIDADE)
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema Ativo 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "FALTA_CHAVE");
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// MEMÓRIA GLOBLAL
if (!global.db) global.db = { warns: new Map(), chatCount: new Map() };

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

    socket.ev.on("connection.update", (u) => { if (u.connection === "close") startBot(); });

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

            // =====================================================================
            // 🛡️ REGIÃO: XERIFE (ANTI-STATUS & LINKS)
            // =====================================================================
            if (isGroup) {
                const meta = await socket.groupMetadata(from);
                const admins = meta.participants.filter(p => p.admin).map(p => p.id);
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

                // --- LÓGICA DE CONTADOR DE MENSAGENS (MOTIVAÇÃO) ---
                let count = (global.db.chatCount.get(from) || 0) + 1;
                global.db.chatCount.set(from, count);

                if (count === 10) { // Dispara a cada 10 mensagens
                    await socket.sendMessage(from, { text: "✨ *[@7viDASBotMusic]* ✨\n\n🔵 _Que bom que vocês estão aqui para aprender mais sobre produção musical! Vamos continuar focados nos hits!_ 🇲🇿🇦🇴" });
                    global.db.chatCount.set(from, 0); // Reseta o contador
                }
            }

            // =====================================================================
            // 🎹 REGIÃO: CÉREBRO DE MÍDIA (DIFERENCIAÇÃO AVANÇADA)
            // =====================================================================
            
            // 1. Áudio de Microfone (Voz)
            if (type === 'audioMessage' && msg.message.audioMessage.ptt === true) {
                return await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
            }

            // 2. Áudio em Arquivo (MP3/Música)
            if (type === 'audioMessage' && msg.message.audioMessage.ptt === false) {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                return await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar este áudio._" }, { quoted: msg });
            }

            // 3. Áudio Documentado (Documento/ZIP/RAR) - COMO NO SEU PRINT
            if (type === 'documentMessage') {
                await socket.sendMessage(from, { react: { text: "📦", key: msg.key } });
                return await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Material de produção documentado recebido! Jackson@7Vidas ou a equipa analisará este kit/projeto em breve._" }, { quoted: msg });
            }

            // =====================================================================
            // 😊 REGIÃO: AUTO-RESPONDER & IA
            // =====================================================================
            const greets = ["oi", "olá", "kmk", "bom dia", "tudo bem"];
            if (!textRaw.startsWith('.') && (greets.includes(textLow) || !isGroup)) {
                if (process.env.GEMINI_API_KEY) {
                    await socket.sendMessage(from, { react: { text: "🧠", key: msg.key } });
                    const result = await aiModel.generateContent(textRaw);
                    await socket.sendMessage(from, { text: result.response.text() }, { quoted: msg });
                    return;
                }
            }

            // =====================================================================
            // 📝 REGIÃO: COMANDOS MANUAIS (.)
            // =====================================================================
            if (!textRaw.startsWith('.')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const cmd = args.shift().toLowerCase();
            const query = args.join(" ");

            if (cmd === "menu") {
                await socket.sendMessage(from, { text: `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO MÃO DE FERRO*\n║ ◽ Auto-Ban Status | Auto-Ban Links\n║ ◽ .marcar (Promover grupo)\n║\n║ ⚪ *PRODUÇÃO & IA*\n║ ◽ IA Gemini (Conversa Livre)\n║ ◽ .yt | .play | .drums | .vst\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n╚══════════════════════════════╝` });
            }

            if (cmd === "marcar") {
                const g = await socket.groupMetadata(from);
                const promo = `📢 🔴 *ＡＴＥＮＣ̧Ａ̃Ｏ ＭＥＭＢＲＯＳ* 🔴\n\n🚀 Vamos promover o grupo para que tenhamos mais produtores ativos! Atualmente o nosso número de membros é menor do que o necessário. Vamos crescer juntos! 🇲🇿🇦🇴`;
                await socket.sendMessage(from, { text: promo, mentions: g.participants.map(p => p.id) });
            }

        } catch (e) { console.log(e); }
    });
}
startBot();