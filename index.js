import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- 1. ESTABILIDADE RENDER (PORTA 10000) ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Elite MZ & AO Online'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

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
        browser: ['7viDASBotMusic', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    // --- 2. BOAS-VINDAS POR CARGO (MZ & AO) ---
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const txt = `╔═════ ⚪ *WELCOME* ⚪ ═════╗\n║\n║ 👋 Olá @${jid.split('@')[0]}!\n║ Bem-vindo ao *@7viDASBotMusic*\n║ 🇲🇿 União: Moçambique & Angola 🇦🇴\n║\n║ 👑 *Cargo:* Membro Produtor\n║ 🎹 Digite *!menu* para navegar.\n║\n╚══════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: txt, mentions: [jid] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            const reason = u.lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === "open") console.log("✅ @7viDASBotMusic: TUDO ATIVADO!");
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

            // --- 3. 🧠 CÉREBRO SOCIAL (RESPOSTAS E REAÇÕES) ---
            const saudações = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "kmk família", "kmk familia", "kmk beatmakers", "kmk novidades", "cheguei"];
            if (saudações.some(s => textLow === s)) {
                await socket.sendMessage(from, { react: { text: "👋", key: msg.key } });
                await socket.sendMessage(from, { text: `✨ *[@7viDASBotMusic]* ✨\n\n🔵 Olá @${sender.split('@')[0]}! Bem-vindo à sessão. Como está a produção por aí? 🇲🇿🇦🇴`, mentions: [sender] }, { quoted: msg });
                return;
            }

            if (textLow.includes("obrigado") || textLow.includes("valeu") || textLow.includes("thx")) {
                await socket.sendMessage(from, { react: { text: "❤️", key: msg.key } });
                return;
            }

            // --- 4. 🎹 CÉREBRO DE ÁUDIO (VOZ VS BEAT) ---
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // --- 5. 🛡️ MODERAÇÃO MÃO DE FERRO (SÓ GRUPOS) ---
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de");
                const isLink = /(https?:\/\/|chat\.whatsapp\.com)/gi.test(textRaw);
                const isMidia = (type === 'imageMessage' || type === 'videoMessage');

                if ((isStatus || isLink || isMidia) && !isSenderAdmin && isBotAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(500);
                    await socket.sendMessage(from, { delete: msg.key });
                    await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* @${sender.split('@')[0]}, links, status ou fotos não são permitidos. Mantenha o grupo limpo! 🇲🇿🇦🇴`, mentions: [sender] });
                    return;
                }
            }

            // --- 6. 📝 COMANDOS (LIVRAMENTO DE ESPAÇO) ---
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            // FUNÇÃO PESQUISAR COM AVISO
            const pesquisar = async (termo) => {
                await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                return await yts(termo);
            };

            switch (command) {
                case "menu":
                    const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗
║
║ 🔴 *ADMINISTRAÇÃO*
║ ◽ !infoadm | !infogrupo
║ ◽ !link | !ban | !warn
║
║ ⚪ *PRODUÇÃO & PESQUISA*
║ ◽ !yt [busca] | !foto [nome]
║ ◽ !drums [estilo] | !vst [nome]
║ ◽ !apps [nome] | !dicas [tema]
║
║ 🔵 *SISTEMA*
║ ◽ !ping - Velocidade
║
║ 👑 ADMIN: JACKSON@7VIDAS
║ 🇲🇿 Moçambique & Angola 🇦🇴
╚══════════════════════════════════╝`;
                    await socket.sendMessage(from, { text: menu });
                    break;

                case "infoadm":
                    let fAdm; try { fAdm = await socket.profilePictureUrl("258877338300@s.whatsapp.net", 'image'); } catch { fAdm = 'https://i.imgur.com/6V69j9X.png'; }
                    const bio = `╔══════ ✨ *ADMIN INFO* ✨ ══════╗
║
║ 👑 *NOME:* JACKSON@7VIDAS
║ 📺 *CANAL:* JACKSON@7VIDAS
║ 🎨 *ARTES:* JACKSON PROD
║
║ 🎵 *TALENTOS:*
║ ◽ Cantor, Compositor e Produtor
║
║ 💳 *SERVIÇOS:*
║ ◽ Agente Vodacom & Movitel
║
║ 💻 *PROFISSÃO:*
║ ◽ Estudante e Programador
║
║ 📞 *CONTACTO:* +258 87 733 8300
║
║ 🌐 *REDES:* YT, WA, IG, FB
║
╚══════ 🇲🇿 *ELITE PRO* 🇦🇴 ══════╝`;
                    await socket.sendMessage(from, { image: { url: fAdm }, caption: bio });
                    break;

                case "infogrupo":
                    if (!isGroup) return;
                    const group = await socket.groupMetadata(from);
                    const infoG = `╔════ 🔵 *INFO GRUPO* 🔵 ════╗\n║\n║ 👥 *Membros:* ${group.participants.length}\n║ 📜 *Criado por:* @${group.owner?.split('@')[0]}\n║ 🇲🇿 *Zona:* MZ & AO 🇦🇴\n║\n╚════════════════════════╝`;
                    await socket.sendMessage(from, { text: infoG, mentions: [group.owner] });
                    break;

                case "yt": case "drums": case "vst": case "apps": case "dicas":
                    const s = await pesquisar(query + (command === "apps" ? " download apk" : " production music"));
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO @7viDASBotMusic*\n\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
                    break;

                case "foto":
                    await socket.sendMessage(from, { text: "📸 _Buscando foto, aguarde..._" });
                    const f = await yts(query);
                    if (f.videos[0]) await socket.sendMessage(from, { image: { url: f.videos[0].thumbnail }, caption: `🔵 *Thumbnail Encontrada*` });
                    break;

                case "ping":
                    const start = Date.now();
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - start}ms\n🤖 *BOT:* @7viDASBotMusic` });
                    break;
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
