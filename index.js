import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// 1. SERVIDOR WEB IMEDIATO (PARA O RENDER)
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Mão de Ferro Ativa'));
app.listen(port, '0.0.0.0', () => console.log(`Porta ${port} aberta`));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    // RECUPERAR LOGIN VIA KEY
    const sessionID = process.env.SESSION_ID;
    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        fs.writeFileSync('./session_data/creds.json', decoded);
    }

    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['7viDASBotMusic', 'Safari', '3.0']
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") startBot();
        if (u.connection === "open") console.log("✅ @7viDASBotMusic: CONECTADO E MONITORANDO");
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

            // --- 🛡️ SISTEMA MÃO DE FERRO (APAGAR AUTOMÁTICO) ---
            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            // DETECÇÃO DE LINKS E COMPARTILHAMENTO DE STATUS
            const isLink = /(https?:\/\/|chat\.whatsapp\.com)/gi.test(textRaw);
            const isStatus = type === 'protocolMessage' || type === 'senderKeyDistributionMessage' || msg.message?.statusMentionMessage;

            if ((isLink || isStatus) && !isSenderAdmin && isBotAdmin) {
                // 1. REAGE COM X
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                
                // 2. APAGA EM SEGUNDOS
                await socket.sendMessage(from, { delete: msg.key });

                // 3. MANDA A MENSAGEM DE ALERTA QUE VOCÊ QUERIA
                await socket.sendMessage(from, { 
                    text: `🔴 *AVISO DE SEGURANÇA* 🔴\n\n@${sender.split('@')[0]}, não é permitido links ou status neste grupo. Por favor, mantenha este grupo limpo! 🇲🇿🇦🇴`,
                    mentions: [sender]
                });
                return;
            }

            // --- 📝 COMANDOS ---
            if (!textRaw.startsWith('!')) return;
            const command = textRaw.slice(1).trim().split(/\s+/)[0].toLowerCase();

            if (command === "menu") {
                const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗
║
║ 🔴 *XERIFE AUTOMÁTICO*
║ ◽ Apaga Links e Status na hora
║ ◽ Filtra Mídias Indesejadas
║ ◽ Diferencia Voz de Beats
║
║ ⚪ *PRODUÇÃO & BUSCAS*
║ ◽ !yt [busca] | !foto [nome]
║ ◽ !ping - Velocidade
║
║ 👑 ADMIN: JACKSON@7VIDAS
║ 🇲🇿 Moçambique & Angola 🇦🇴
╚══════════════════════════════╝`;
                await socket.sendMessage(from, { text: menu });
            }

            if (command === "ping") {
                await socket.sendMessage(from, { text: "🛰️ Jackson Beatz Online e Monitorando! 🇲🇿🇦🇴" });
            }

        } catch (e) { console.log(e); }
    });
}

startBot();
