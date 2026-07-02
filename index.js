import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- 1. SERVIDOR WEB (ESTABILIDADE RENDER) ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema MZ & AO Online'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor ativo na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

// --- 2. CONFIGURAÇÕES DE PERSONALIDADE ---
const REGRAS = `📜 *REGRAS JACKSON@7VIDAS*
🔵 Proibido links e mídias fora do tema.
🔴 Proibido divulgar STATUS ou ESTADOS.
⚪ Proibido Bullying ou Insultos.
⚠️ *3 Avisos = BAN AUTOMÁTICO!*`;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;

    // RECUPERAR SESSÃO VIA KEY
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
        browser: ['7viDASBotMusic', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
    });

    socket.ev.on("creds.update", saveCreds);

    // --- 3. BOAS-VINDAS (MZ & AO) ---
    socket.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        if (action === 'add') {
            for (const num of participants) {
                try {
                    let foto; try { foto = await socket.profilePictureUrl(num, 'image'); } catch { foto = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcomeTxt = `╔══════ ⚪ *WELCOME* ⚪ ══════╗\n║\n║ 👋 Olá @${num.split('@')[0]}!\n║ Bem-vindo à elite musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║\n║ 🔵 Digite *!menu* para navegar.\n║\n╚══════════════════════════╝`;
                    await socket.sendMessage(id, { image: { url: foto }, caption: welcomeTxt, mentions: [num] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            const shouldReconnect = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (u.connection === "open") console.log("✅ @7viDASBotMusic: TUDO ATIVADO");
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

            // --- 4. 🧠 CÉREBRO SOCIAL (DM E GRUPO) ---
            const saudações = ["oi", "olá", "ola", "kmk", "tudo bem", "cheguei"];
            if (saudações.includes(textLow)) {
                await socket.sendMessage(from, { text: `✨ *[@7viDASBotMusic]* ✨\n\n🔵 Olá @${sender.split('@')[0]}! Como está a produção por aí? 🇲🇿🇦🇴`, mentions: [sender] }, { quoted: msg });
                return;
            }

            if (textLow === "obrigado" || textLow === "valeu") {
                await socket.sendMessage(from, { react: { text: "❤️", key: msg.key } });
                return;
            }

            // --- 5. 🎹 CÉREBRO DE ÁUDIO (VOZ VS BEAT) ---
            if (type === 'audioMessage') {
                const isPTT = msg.message.audioMessage.ptt; 
                if (isPTT) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // --- 6. 🛡️ MODERAÇÃO AUTOMÁTICA (SÓ GRUPOS) ---
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("estado de");
                const isLink = /(https?:\/\/|chat\.whatsapp\.com)/gi.test(textRaw);

                if ((isStatus || isLink) && !isSenderAdmin && isBotAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(500);
                    await socket.sendMessage(from, { delete: msg.key });
                    await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* @${sender.split('@')[0]}, links ou status não são permitidos. Mantenha o grupo limpo! 🇲🇿🇦🇴`, mentions: [sender] });
                    return;
                }
            }

            // --- 7. 📝 COMANDOS (DM & GRUPO) ---
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            const feedback = async (txt) => await socket.sendMessage(from, { text: txt });

            switch (command) {
                case "menu":
                    const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗
║
║ 🔴 *ADMINISTRAÇÃO*
║ ◽ !infoadm | !infogrupo
║ ◽ !ban | !link | !marcar
║
║ ⚪ *PRODUÇÃO & BUSCAS*
║ ◽ !yt [busca] | !foto [nome]
║ ◽ !drums [estilo] | !vst [nome]
║ ◽ !apps [nome] | !dicas [tema]
║
║ 🔵 *SISTEMA*
║ ◽ !ping - Velocidade
║ ◽ !key - Sua Sessão
║
║ 👑 ADMIN: JACKSON@7VIDAS
║ 🇲🇿 Moçambique & Angola 🇦🇴
╚══════════════════════════════╝`;
                    await feedback(menu);
                    break;

                case "ping":
                    const start = Date.now();
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - start}ms\n🤖 *BOT:* @7viDASBotMusic` });
                    break;

                case "infoadm":
                    let fAdm; try { fAdm = await socket.profilePictureUrl("258877338300@s.whatsapp.net", 'image'); } catch { fAdm = 'https://i.imgur.com/6V69j9X.png'; }
                    const bio = `╔══════ ✨ *ADMIN INFO* ✨ ══════╗\n║\n║ 👑 *JACKSON@7VIDAS*\n║ 🎵 Cantor, Compositor & Produtor\n║ 💳 Agente Vodacom & Movitel\n║ 💻 Estudante & Programador\n║ 📞 +258 87 733 8300\n║\n╚══════ 🇲🇿 MZ & AO 🇦🇴 ══════╝`;
                    await socket.sendMessage(from, { image: { url: fAdm }, caption: bio });
                    break;

                case "yt": case "drums": case "vst": case "apps": case "dicas":
                    if (!query) return feedback("🔍 _O que desejas procurar?_");
                    await feedback("🔍 _Procurando, aguarde..._");
                    const s = await yts(query + (command === "apps" ? " download apk" : " production"));
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO @7viDASBotMusic*\n\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}\n👤 *Canal:* ${s.videos[0].author.name}` });
                    break;

                case "foto":
                    await feedback("📸 _Buscando foto, aguarde..._");
                    const f = await yts(query);
                    if (f.videos[0]) await socket.sendMessage(from, { image: { url: f.videos[0].thumbnail }, caption: `🔵 *Thumbnail Encontrada*` });
                    break;

                case "marcar":
                    if (!isGroup) return;
                    const group = await socket.groupMetadata(from);
                    await socket.sendMessage(from, { text: `📢 *ATENÇÃO:* ${query || 'Convocatória JACKSON@7VIDAS!'}`, mentions: group.participants.map(p => p.id) });
                    break;
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
