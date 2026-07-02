import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// 🟢 REGIÃO 1: SERVIDOR & MANUTENÇÃO (RENDER)
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('7viDASBotMusic PRO - Sistema MZ & AO Ativo 🇲🇿🇦🇴'));
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
        browser: ['7viDASBotMusic PRO', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === "open") console.log("✅ @7viDASBotMusic: ONLINE PARA TODOS OS MEMBROS");
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return; // Se não houver mensagem, ignora

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const sender = msg.key.participant || msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // =====================================================================
            // 🧠 REGIÃO 2: CÉREBRO DE CAPTAÇÃO (PARA TODOS OS MEMBROS)
            // =====================================================================
            
            // 2.1. RECONHECIMENTO DE ÁUDIO (Membro enviou Voz ou Beat)
            if (type === 'audioMessage') {
                const isVoz = msg.message.audioMessage.ptt; 
                if (isVoz) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } }); // Só reage à voz (PTT)
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } }); // É arquivo MP3/Beat
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // 2.2. RECONHECIMENTO DE VÍDEO (Projeto do FL Studio ou Beat)
            if (type === 'videoMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                return;
            }

            // 2.3. RECONHECIMENTO DE SOUND KITS / ZIP (Como o do Beno)
            if (type === 'documentMessage') {
                await socket.sendMessage(from, { react: { text: "📦", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Arquivo de produção detectado! Um dos beatmakers vai analisar o conteúdo em breve._" }, { quoted: msg });
                return;
            }

            // =====================================================================
            // 🛡️ REGIÃO 3: XERIFE MÃO DE FERRO (MZ & AO ANTI-BAN)
            // =====================================================================
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                // Detecção de Status, Links e Insultos
                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("estado de");
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);
                const isInsulto = ["lixo", "macaco", "bullying", "estupido"].some(p => textLow.includes(p));

                if ((isStatus || isLink || isInsulto) && !isSenderAdmin && isBotAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(400);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA NA HORA
                    await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* Conteúdo proibido removido. Mantenha o grupo limpo! 🇲🇿🇦🇴` });
                    return;
                }
            }

            // =====================================================================
            // 😊 REGIÃO 4: AUTO-RESPONDER SOCIAL (PARA TODOS)
            // =====================================================================
            const saudações = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "kmk família", "kmk beatmakers", "kmk novidades", "cheguei"];
            if (saudações.includes(textLow)) {
                await socket.sendMessage(from, { react: { text: "👋", key: msg.key } });
                const r = `✨ *[@7viDASBotMusic]* ✨\n\n🔵 Olá @${sender.split('@')[0]}! Bem-vindo à sessão. Como está a produção por aí? 🇲🇿🇦🇴`;
                await socket.sendMessage(from, { text: r, mentions: [sender] }, { quoted: msg });
                return;
            }
            if (textLow.includes("obrigado") || textLow.includes("valeu")) return socket.sendMessage(from, { react: { text: "❤️", key: msg.key } });

            // =====================================================================
            // 📝 REGIÃO 5: COMANDOS MANUAIS (PESQUISAS & INFO)
            // =====================================================================
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            const aviso = async () => await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });

            switch (command) {
                case "menu":
                    await socket.sendMessage(from, { text: `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ !infoadm | !infogrupo | !link\n║ ◽ !ban | !marcar | !ping\n║\n║ ⚪ *PRODUÇÃO & BUSCAS*\n║ ◽ !yt [busca] | !foto [nome]\n║ ◽ !drums [estilo] | !vst [nome]\n║ ◽ !apps [nome] | !dicas [tema]\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n╚══════════════════════════════════╝` });
                    break;

                case "infoadm":
                    let fAdm; try { fAdm = await socket.profilePictureUrl("258877338300@s.whatsapp.net", 'image'); } catch { fAdm = 'https://i.imgur.com/6V69j9X.png'; }
                    const bio = `╔══════ ✨ *ADMIN INFO* ✨ ══════╗\n║\n║ 👑 *NOME:* JACKSON@7VIDAS\n║ 📺 *CANAL:* JACKSON@7VIDAS\n║ 🎨 *ARTES:* JACKSON PROD\n║\n║ 🎵 Cantor & Produtor\n║ 💳 Agente Vodacom/Movitel\n║ 💻 Programador\n║ 📞 +258 87 733 8300\n║\n╚══════ 🇲🇿 *ELITE PRO* 🇦🇴 ══════╝`;
                    await socket.sendMessage(from, { image: { url: fAdm }, caption: bio });
                    break;

                case "yt": case "drums": case "vst": case "apps": case "dicas":
                    await aviso();
                    const s = await yts(query + (command === "apps" ? " download apk" : " production"));
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO @7viDASBotMusic*\n\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
                    break;

                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - m.messageTimestamp * 1000}ms` });
                    break;
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
