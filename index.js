import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// REGIÃO 1: SERVIDOR WEB (ESTABILIDADE RENDER)
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('7viDASBotMusic PRO - Sistema MZ & AO Online 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor Jackson AI Ultra ativo na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

// IA GEMINI (Coloca a tua chave no Render como GEMINI_API_KEY)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "FALTA_CHAVE");
const aiModel = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "Tu és o @7viDASBotMusic, assistente de elite do JACKSON@7VIDAS para beatmakers de Moçambique e Angola. Responde com educação, profissionalismo e gírias de produção."
});

async function startBot() {
    // =========================================================================
    // REGIÃO 2: RECUPERAÇÃO DE SESSÃO (SESSION_ID)
    // =========================================================================
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data', { recursive: true });
        fs.writeFileSync('./session_data/creds.json', decoded);
        console.log("📂 Sessão restaurada com sucesso!");
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
    // REGIÃO 3: BOAS-VINDAS POR CARGO (WELCOME COM FOTO)
    // =========================================================================
    socket.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add') {
            for (let jid of update.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔═══════ ✨ *BEM-VINDO* ✨ ═══════╗\n║ 👋 Olá, @${jid.split('@')[0]}!\n║ Bem-vindo à união musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║ 🔵 Digite *.menu* para navegar.\n╚══════════════════════════════╝`;
                    await socket.sendMessage(update.id, { image: { url: pp }, caption: welcome, mentions: [jid] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === "open") console.log("✅ @7viDASBotMusic: TUDO PRONTO!");
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

            // =====================================================================
            // REGIÃO 4: CÉREBRO DE MÍDIA (ÁUDIO/VÍDEO/VOZ)
            // =====================================================================
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } }); // Gravação
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } }); // Beat/MP3
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            if (type === 'videoMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Vídeo recebido. Positivo, aguarde a análise dos beatmakers._" }, { quoted: msg });
                return;
            }

            // =====================================================================
            // REGIÃO 5: XERIFE MÃO DE FERRO (ADMINISTRAÇÃO AUTO)
            // =====================================================================
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);
                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("estado de");
                const isInsulto = ["lixo", "fdp", "macaco", "bullying"].some(p => textLow.includes(p));

                if ((isLink || isStatus || isInsulto) && isBotAdmin && !isSenderAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(300);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA IMEDIATAMENTE
                    await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* Links/Status são proibidos. Mantenha o grupo limpo! 🇲🇿🇦🇴` });
                    return;
                }
            }

            // =====================================================================
            // REGIÃO 6: AUTO-RESPONDER SOCIAL (CONVERSA COM IA)
            // =====================================================================
            const saudações = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "kmk família", "kmk beatmakers", "cheguei"];
            const isBotMentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');

            if (!textRaw.startsWith('.') && (saudações.includes(textLow) || isBotMentioned || !isGroup)) {
                if (process.env.GEMINI_API_KEY) {
                    await socket.sendMessage(from, { react: { text: "🧠", key: msg.key } });
                    const result = await aiModel.generateContent(textRaw);
                    await socket.sendMessage(from, { text: result.response.text() }, { quoted: msg });
                    return;
                }
            }
            
            if (textLow.includes("obrigado")) await socket.sendMessage(from, { react: { text: "❤️", key: msg.key } });

            // =====================================================================
            // REGIÃO 7: COMANDOS MANUAIS ESPECÍFICOS (.)
            // =====================================================================
            if (!textRaw.startsWith('.')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            const pesquisar = async (t) => {
                await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                return await yts(t);
            };

            switch (command) {
                case "menu":
                    await socket.sendMessage(from, { text: `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ .infoadm | .infogrupo | .link\n║ ◽ .ban | .marcar | .promover\n║\n║ ⚪ *PRODUÇÃO & BUSCAS*\n║ ◽ .play [musica] | .yt [busca]\n║ ◽ .foto [nome] | .drums | .vst\n║\n║ 🔵 *SISTEMA*\n║ ◽ .ping | .key\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n╚══════════════════════════════════╝` });
                    break;

                case "infoadm":
                    await socket.sendMessage(from, { text: `╔══════ ✨ *ADMIN INFO* ✨ ══════╗\n║ 👑 *NOME:* JACKSON@7VIDAS\n║ 📺 *CANAL:* JACKSON@7VIDAS\n║ 🎵 Cantor & Produtor\n║ 💳 Agente Vodacom & Movitel\n║ 💻 Programador & Estudante\n║ 📞 +258 87 733 8300\n╚══════ 🇲🇿 MZ & AO 🇦🇴 ══════╝` });
                    break;

                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - (msg.messageTimestamp * 1000)}ms\n🤖 *BOT:* Ativo e vigilante!` });
                    break;
                
                case "yt": case "play": case "drums": case "vst":
                    const s = await pesquisar(query || "jackson beatz");
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO:* ${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
                    break;
            }
        } catch (e) { console.log(e); }
    });
}
startBot();