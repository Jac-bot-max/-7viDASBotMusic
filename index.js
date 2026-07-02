import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, disconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- SERVIDOR WEB (ESTABILIDADE RENDER) ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('7viDASBotMusic PRO - Online MZ & AO'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    // RECUPERAR SESSÃO VIA SESSION_ID
    const sessionID = process.env.SESSION_ID;
    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        fs.writeFileSync('./session_data/creds.json', decoded);
    }

    // --- CONFIGURAÇÃO ANTI-BAN PROFISSIONAL ---
    const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['7viDASBotMusic', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
    });

    socket.ev.on("creds.update", saveCreds);

    // --- BOAS-VINDAS POR CARGO (MZ & AO) ---
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const txt = `✨ *BEM-VINDO À ELITE MUSICAL* ✨\n\n👋 Olá @${jid.split('@')[0]}!\n🇲🇿 *UNIÃO:* Moçambique & Angola 🇦🇴\n\n👑 *Cargo:* Membro Produtor\n🎹 Digite *!menu* para navegar.\n\n⚠️ *Respeite para não ser Banido!*`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: txt, mentions: [jid] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") startBot();
        if (u.connection === "open") console.log("✅ @7viDASBotMusic: TUDO PRONTO!");
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
            const saudações = ["oi", "olá", "ola", "olá família", "olá familia", "olá beatmakers", "kmk família", "kmk familia"];
            if (saudações.includes(textLow)) {
                await socket.sendMessage(from, { react: { text: "👋", key: msg.key } });
                await socket.sendMessage(from, { text: `✨ *[@7viDASBotMusic]* ✨\n\n🔵 Olá @${sender.split('@')[0]}! Bem-vindo à sessão. O respeito aqui é a base da arte. Como está a produção? 🇲🇿🇦🇴`, mentions: [sender] }, { quoted: msg });
                return;
            }

            // REAÇÃO AO OBRIGADO
            if (textLow.includes("obrigado") || textLow.includes("valeu")) {
                await socket.sendMessage(from, { react: { text: "❤️", key: msg.key } });
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

            // --- 🛡️ MODERAÇÃO MÃO DE FERRO (STATUS / LINKS) ---
            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de");
            const isLink = /(https?:\/\/|chat\.whatsapp\.com)/gi.test(textRaw);

            if ((isStatus || isLink) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await delay(500);
                await socket.sendMessage(from, { delete: msg.key });
                await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* @${sender.split('@')[0]}, links ou status não são permitidos. Mantenha o grupo limpo! 🇲🇿🇦🇴`, mentions: [sender] });
                return;
            }

            // --- 📝 COMANDOS ---
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            // FUNÇÃO BUSCA COM AVISO
            const buscar = async (termo, emoji) => {
                await socket.sendMessage(from, { text: `🔍 _Procurando ${termo}, aguarde..._` });
                const s = await yts(query || termo);
                return s.videos[0];
            };

            // --- COMANDO INFO ADM (BIOGRAFIA) ---
            if (command === "infoadm") {
                let fotoAdm;
                try { fotoAdm = await socket.profilePictureUrl("258877338300@s.whatsapp.net", 'image'); } catch { fotoAdm = 'https://i.imgur.com/6V69j9X.png'; }
                const bio = `╔══════ ✨ *ADMIN INFO* ✨ ══════╗
║
║ 👑 *NOME:* JACKSON@7VIDAS
║ 📺 *CANAL:* JACKSON@7VIDAS
║ 🎨 *ARTES & SERVIÇOS:* JACKSON PROD
║
║ 🎵 *TALENTOS:*
║ ◽ Cantor, Compositor e Produtor
║
║ 💳 *SERVIÇOS MÓVEIS:*
║ ◽ Agente Vodacom & Movitel
║
║ 💻 *PROFISSÃO:*
║ ◽ Estudante & Programador
║
║ 📞 *CONTACTO:* +258 87 733 8300
║
║ 🌐 *REDES SOCIAIS:*
║ ◽ YouTube | Instagram | Facebook
║
╚══════ 🇲🇿 *ELITE PRO* 🇦🇴 ══════╝`;
                await socket.sendMessage(from, { image: { url: fotoAdm }, caption: bio });
            }

            if (command === "infogrupo") {
                const infoG = `╔════ 🔵 *INFO GRUPO* 🔵 ════╗\n║\n║ 👥 *Membros:* ${groupMetadata.participants.length}\n║ 📜 *Regras:* Use !regras\n║ 🇲🇿 *Zona:* Moçambique & Angola 🇦🇴\n║\n╚════════════════════════╝`;
                await socket.sendMessage(from, { text: infoG });
            }

            if (command === "menu") {
                const menu = `╔═════ 🔵 *@7viDASBotMusic* 🔵 ═════╗
║
║ 🔴 *ADMINISTRAÇÃO*
║ ◽ !infoadm | !infogrupo
║ ◽ !promover | !rebaixar | !ban
║
║ ⚪ *PRODUÇÃO & BUSCAS*
║ ◽ !yt [busca] | !foto [nome]
║ ◽ !drums [estilo] | !vst [nome]
║ ◽ !apps [nome] | !dicas [tema]
║
║ 🔵 *SISTEMA*
║ ◽ !ping | !link
║
║ 👑 ADMIN: JACKSON@7VIDAS
╚══════════════════════════════╝`;
                await socket.sendMessage(from, { text: menu });
            }

            // BUSCAS COM FEEDBACK "AGUARDE"
            if (command === "yt") {
                const v = await buscar(query, "📺");
                if (v) await socket.sendMessage(from, { text: `📺 *YOUTUBE*\n\n📌 *Título:* ${v.title}\n🔗 *Link:* ${v.url}` });
            }

            if (command === "foto") {
                await socket.sendMessage(from, { text: "🔍 _Buscando foto, aguarde..._" });
                const f = await yts(query);
                if (f.videos[0]) await socket.sendMessage(from, { image: { url: f.videos[0].thumbnail }, caption: `🔵 *Thumbnail:* ${f.videos[0].title}` });
            }

            if (["drums", "vst", "apps", "dicas"].includes(command)) {
                const v = await buscar(command + " " + query, "🥁");
                if (v) await socket.sendMessage(from, { text: `✨ *ENCONTRADO @7viDASBotMusic* ✨\n\n📌 ${v.title}\n🔗 ${v.url}` });
            }

            // COMANDOS DE ADM
            if (command === "ban" && isSenderAdmin && isBotAdmin) {
                const t = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
                if (t) await socket.groupParticipantsUpdate(from, [t], "remove");
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
