import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// REGIÃO 1: INFRAESTRUTURA & ESTABILIDADE (RENDER)
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema de Elite Ativo 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor Web ativo na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

async function startBot() {
    // =========================================================================
    // REGIÃO 2: SEGURANÇA ANTI-BAN & SESSÃO
    // =========================================================================
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
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    socket.ev.on("creds.update", saveCreds);

    // =========================================================================
    // REGIÃO 3: SISTEMA DE BOAS-VINDAS (PERSONALIDADE MZ & AO)
    // =========================================================================
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔═══════ ✨ *BEM-VINDO* ✨ ═══════╗\n║ 👋 Olá, @${jid.split('@')[0]}!\n║ Bem-vindo à união musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 *ADMIN:* JACKSON@7VIDAS\n║ 🔵 Digite *!menu* para navegar.\n║ 🔴 Proibido Links/Status/Insultos!\n╚══════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: welcome, mentions: [jid] });
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
            // REGIÃO 4: CÉREBRO DE CAPTAÇÃO (ÁUDIO/VÍDEO/VOZ)
            // =====================================================================
            
            // 4.1. Reconhecimento de Áudio (Voz vs Instrumental)
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } }); // Gravação de Voz
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } }); // Arquivo/Música
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // 4.2. Reconhecimento de Vídeo
            if (type === 'videoMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                return;
            }

            if (!isGroup) return;

            // =====================================================================
            // REGIÃO 5: XERIFE MÃO DE FERRO (ADMINISTRAÇÃO AUTOMÁTICA)
            // =====================================================================
            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            if (isBotAdmin && !isSenderAdmin) {
                // Detecção de Links, Status/Estados e Insultos
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);
                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("estado de");
                const isInsulto = ["lixo", "fdp", "estupido", "bullying", "macaco", "preto", "burro"].some(p => textLow.includes(p));

                if (isLink || isStatus || isInsulto) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(300);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA IMEDIATAMENTE

                    let v = (global.advertencias.get(sender) || 0) + 1;
                    global.advertencias.set(sender, v);

                    if (v >= 3 || isInsulto) {
                        await socket.groupParticipantsUpdate(from, [sender], "remove"); // BAN AUTOMÁTICO
                        const motive = isInsulto ? "Insultos" : "Spam de Links/Status";
                        await socket.sendMessage(from, { text: `🔴 *BANIDO:* @${sender.split('@')[0]} expulso por ${motive}. Mantenha o grupo limpo! 🇲🇿🇦🇴`, mentions: [sender] });
                    } else {
                        await socket.sendMessage(from, { text: `🔴 *AVISO DE SEGURANÇA* 🔴\n\n@${sender.split('@')[0]}, não é permitido links ou status neste grupo. Por favor, mantenha este grupo limpo! (Aviso ${v}/3)`, mentions: [sender] });
                    }
                    return;
                }
            }

            // =====================================================================
            // REGIÃO 6: AUTO-RESPONDER SOCIAL (SAUDAÇÕES)
            // =====================================================================
            const greets = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "kmk família", "kmk beatmakers", "cheguei"];
            if (greets.includes(textLow)) {
                await socket.sendMessage(from, { react: { text: "👋", key: msg.key } });
                const r = `✨ *[@7viDASBotMusic]* ✨\n\n🔵 Olá @${sender.split('@')[0]}! Bem-vindo à sessão. Como está a produção por aí? 🇲🇿🇦🇴`;
                await socket.sendMessage(from, { text: r, mentions: [sender] }, { quoted: msg });
                return;
            }
            if (textLow === "obrigado" || textLow === "valeu") return socket.sendMessage(from, { react: { text: "❤️", key: msg.key } });

            // =====================================================================
            // REGIÃO 7: COMANDOS MANUAIS (PESQUISAS & INFO ADM)
            // =====================================================================
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            const pesquisar = async (t) => {
                await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                return await yts(t);
            };

            switch (command) {
                case "menu":
                    await socket.sendMessage(from, { text: `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ !infoadm | !infogrupo | !link\n║ ◽ !promover | !rebaixar | !ban\n║\n║ ⚪ *PRODUÇÃO & BUSCAS*\n║ ◽ !yt [busca] | !foto [nome]\n║ ◽ !drums [estilo] | !vst [nome]\n║ ◽ !apps [nome] | !dicas [tema]\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n╚══════════════════════════════════╝` });
                    break;

                case "infoadm":
                    const bio = `╔══════ ✨ *ADMIN INFO* ✨ ══════╗\n║\n║ 👑 *NOME:* JACKSON@7VIDAS\n║ 📺 *CANAL:* JACKSON@7VIDAS\n║ 🎨 *ARTES:* JACKSON PROD\n║\n║ 🎵 Cantor, Compositor & Produtor\n║ 💳 Agente Vodacom & Movitel\n║ 💻 Estudante e Programador\n║ 📞 +258 87 733 8300\n║\n╚══════ 🇲🇿 *ELITE PRO* 🇦🇴 ══════╝`;
                    await socket.sendMessage(from, { text: bio });
                    break;

                case "yt": case "drums": case "vst": case "apps": case "dicas":
                    const s = await pesquisar(query + (command === "apps" ? " download" : " production"));
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO @7viDASBotMusic*\n\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
                    break;

                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - m.messageTimestamp * 1000}ms\n🤖 *BOT:* Ativo 🇲🇿🇦🇴` });
                    break;
            }
        } catch (e) { console.log(e); }
    });
}
startBot();