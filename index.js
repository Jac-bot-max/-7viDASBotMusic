import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// REGIÃO 1: SERVIDOR WEB (ESTABILIDADE RENDER)
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema de Análise Beatmaker Ativo 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

async function startBot() {
    // =========================================================================
    // REGIÃO 2: ANTI-BAN & CONEXÃO (CÉREBRO DE ACESSO)
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
        browser: ['@7viDASBotMusic PRO', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    socket.ev.on("creds.update", saveCreds);

    // =========================================================================
    // REGIÃO 3: SISTEMA DE BOAS-VINDAS PROFISSIONAL (MZ & AO)
    // =========================================================================
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    const metadata = await socket.groupMetadata(anu.id);
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    
                    const welcomeTxt = `╔═══════ ✨ *WELCOME* ✨ ═══════╗
║
║ 👋 Olá, @${jid.split('@')[0]}!
║ Bem-vindo(a) à elite musical:
║ 🎼 *${metadata.subject}*
║
║ 🇲🇿 Moçambique & Angola 🇦🇴
║ 👑 ADMIN: *JACKSON@7VIDAS*
║
║ 🔵 Digite *!menu* para navegar.
║ 🔴 Respeite a arte e os produtores.
║
╚══════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: welcomeTxt, mentions: [jid] });
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
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // =====================================================================
            // REGIÃO 4: CÉREBRO DE CAPTAÇÃO DE SONS (DIFERENCIAÇÃO)
            // =====================================================================
            
            // 4.1. RECONHECIMENTO DE ÁUDIO (VOZ VS INSTRUMENTAL)
            if (type === 'audioMessage') {
                const isVoz = msg.message.audioMessage.ptt; 
                if (isVoz) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } }); // Gravação de Voz
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } }); // MP3/Arquivo
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // 4.2. RECONHECIMENTO DE VÍDEO (PROJETOS/BEATS)
            if (type === 'videoMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                return;
            }

            // =====================================================================
            // REGIÃO 5: XERIFE AUTOMÁTICO (SEGURANÇA & AUTO-BAN)
            // =====================================================================
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                if (isBotAdmin && !isSenderAdmin) {
                    const linkRegex = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi;
                    const isStatusSpam = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de");
                    const isInsulto = ["bullying", "lixo", "estupido", "macaco", "fdp"].some(p => textLow.includes(p));

                    if (linkRegex.test(textRaw) || isStatusSpam || isInsulto) {
                        await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                        await delay(500);
                        await socket.sendMessage(from, { delete: msg.key }); // APAGA

                        let v = (global.advertencias.get(sender) || 0) + 1;
                        global.advertencias.set(sender, v);

                        if (v >= 3 || isInsulto) {
                            await socket.groupParticipantsUpdate(from, [sender], "remove");
                            await socket.sendMessage(from, { text: `🔴 *BANIDO:* @${sender.split('@')[0]} removido por Spam/Insultos. Mantenha o grupo limpo! 🇲🇿🇦🇴`, mentions: [sender] });
                        } else {
                            await socket.sendMessage(from, { text: `⚠️ *AVISO [${v}/3]* @${sender.split('@')[0]}, não é permitido links ou status aqui!`, mentions: [sender] });
                        }
                        return;
                    }
                }
            }

            // =====================================================================
            // REGIÃO 6: AUTO-RESPONDER SOCIAL (DM & GRUPO)
            // =====================================================================
            const greet = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "kmk família", "kmk beatmakers", "cheguei"];
            if (greet.includes(textLow)) {
                await socket.sendMessage(from, { react: { text: "👋", key: msg.key } });
                const r = `✨ *[@7viDASBotMusic]* ✨\n\n🔵 Olá @${sender.split('@')[0]}! Bem-vindo à sessão. Como está a produção por aí? 🇲🇿🇦🇴`;
                await socket.sendMessage(from, { text: r, mentions: [sender] }, { quoted: msg });
                return;
            }

            if (textLow.includes("obrigado") || textLow.includes("valeu")) {
                await socket.sendMessage(from, { react: { text: "❤️", key: msg.key } });
                return;
            }

            // =====================================================================
            // REGIÃO 7: COMANDOS MANUAIS (PESQUISAS & INFO)
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
                    const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗
║
║ 🔴 *ADMINISTRAÇÃO*
║ ◽ !infoadm | !infogrupo
║ ◽ !link | !marcar | !ban
║
║ ⚪ *PRODUÇÃO & BUSCAS*
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
                    const bio = `╔══════ ✨ *ADMIN INFO* ✨ ══════╗\n║\n║ 👑 *NOME:* JACKSON@7VIDAS\n║ 📺 *CANAL:* JACKSON@7VIDAS\n║ 🎨 *ARTES:* JACKSON PROD\n║ 🎵 Cantor, Compositor & Produtor\n║ 💳 Agente Vodacom & Movitel\n║ 💻 Estudante e Programador\n║ 📞 +258 87 733 8300\n║\n╚══════ 🇲🇿 *ELITE PRO* 🇦🇴 ══════╝`;
                    await socket.sendMessage(from, { image: { url: fAdm }, caption: bio });
                    break;

                case "yt": case "drums": case "vst": case "apps": case "dicas":
                    const s = await pesquisar(query + (command === "apps" ? " download apk" : " production"));
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO @7viDASBotMusic*\n\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
                    break;

                case "foto":
                    await socket.sendMessage(from, { text: "📸 _Buscando foto, aguarde..._" });
                    const f = await yts(query);
                    if (f.videos[0]) await socket.sendMessage(from, { image: { url: f.videos[0].thumbnail }, caption: `🔵 *Thumbnail Encontrada*` });
                    break;

                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - m.messageTimestamp * 1000}ms\n🤖 *BOT:* @7viDASBotMusic Online` });
                    break;

                case "marcar":
                    if (!isGroup) return;
                    const g = await socket.groupMetadata(from);
                    await socket.sendMessage(from, { text: `📢 *ATENÇÃO:* ${query || 'JACKSON@7VIDAS chamando!'}`, mentions: g.participants.map(p => p.id) });
                    break;
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
