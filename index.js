import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage } from "@whiskeysockets/baileys";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- REGIÃO 1: SERVIDOR & IA ---
const app = express();
app.listen(process.env.PORT || 10000, '0.0.0.0');
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO Ativo 🇲🇿🇦🇴'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "FALTA_CHAVE");
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
if (!global.db) global.db = { warns: new Map() };

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
        browser: ['@7viDASBotMusic PRO', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

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

            // --- REGIÃO 2: XERIFE (STATUS / LINKS) ---
            if (isGroup) {
                const meta = await socket.groupMetadata(from);
                const admins = meta.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                if (isBotAdmin && !admins.includes(sender)) {
                    const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);
                    const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de");
                    if (isLink || isStatus) {
                        await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                        await delay(300);
                        return await socket.sendMessage(from, { delete: msg.key });
                    }
                }
            }

            // --- REGIÃO 3: CÉREBRO DE MÍDIA (BEATS / VOZ) ---
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    return await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    return await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
            }

            // --- REGIÃO 4: COMANDOS MANUAIS (.) ---
            if (textRaw.startsWith('.')) {
                const args = textRaw.slice(1).trim().split(/\s+/);
                const cmd = args.shift().toLowerCase();
                const query = args.join(" ");

                if (cmd === "menu") {
                    const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ .ban | .link | .marcar\n║\n║ ⚪ *PRODUÇÃO*\n║ ◽ .play | .yt | .drums | .vst\n║ ◽ .sticker (Responda a uma foto)\n║\n║ 🔵 *INTELIGÊNCIA ARTIFICIAL*\n║ ◽ Mencione o bot para conversar\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n╚══════════════════════════════╝`;
                    return await socket.sendMessage(from, { text: menu });
                }

                // COMANDO STICKER (O que tu já tinhas)
                if (cmd === "sticker" || cmd === "s") {
                    const isMedia = type === 'imageMessage' || type === 'videoMessage';
                    const isQuoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    const targetMsg = isQuoted ? msg.message.extendedTextMessage.contextInfo.quotedMessage : msg.message;
                    
                    if (targetMsg.imageMessage || targetMsg.videoMessage) {
                        await socket.sendMessage(from, { text: "⏳ _Criando seu sticker brilhante..._" });
                        const stream = await downloadContentFromMessage(targetMsg.imageMessage || targetMsg.videoMessage, targetMsg.imageMessage ? 'image' : 'video');
                        let buffer = Buffer.from([]);
                        for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                        
                        const sticker = new Sticker(buffer, {
                            pack: 'Jackson@7Vidas Pack',
                            author: '@7viDASBotMusic',
                            type: StickerTypes.FULL,
                            quality: 50
                        });
                        return await socket.sendMessage(from, { sticker: await sticker.toBuffer() });
                    }
                }

                if (cmd === "ping") return await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - (msg.messageTimestamp * 1000)}ms` });

                if (["yt", "play", "drums", "vst"].includes(cmd)) {
                    await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                    const s = await yts(query || "jackson beatz");
                    if (s.videos[0]) return await socket.sendMessage(from, { text: `📺 *RESULTADO*\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
                }
            }

            // --- REGIÃO 5: IA GEMINI (AUTO-RESPONDER) ---
            const greets = ["oi", "olá", "kmk", "bom dia"];
            if (greets.includes(textLow) || !isGroup) {
                if (process.env.GEMINI_API_KEY) {
                    await socket.sendMessage(from, { react: { text: "🧠", key: msg.key } });
                    const result = await aiModel.generateContent(textRaw);
                    return await socket.sendMessage(from, { text: result.response.text() }, { quoted: msg });
                }
            }

        } catch (e) { console.log(e); }
    });

    socket.ev.on("connection.update", (u) => { if (u.connection === "close") startBot(); });
}
startBot();