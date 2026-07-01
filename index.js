import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- SERVIDOR PARA MANTER ONLINE NO RENDER ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Online e Ativo'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

// ESTILIZAÇÃO DE TEXTO
const style = {
    h1: (t) => `╔═══════ 🔵 *${t.toUpperCase()}* 🔵 ═══════╗`,
    h2: (t) => `║ 🔴 *${t.toUpperCase()}*`,
    li: (t) => `║ ◽ ${t}`,
    end: "╚══════════════════════════════╝"
};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();
    const sessionID = process.env.SESSION_ID;

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        fs.writeFileSync('./session_data/creds.json', decoded);
    }

    const socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['@7viDASBotMusic', 'Chrome', '1.0.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") startBot();
        if (u.connection === "open") console.log("✅ @7viDASBotMusic: CONECTADO");
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

            // 1. RESPOSTAS AUTOMÁTICAS E EDUCADAS (SAUDAÇÕES)
            const responder = async (txt) => {
                await socket.sendMessage(from, { text: `⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 ${txt}` }, { quoted: msg });
            };

            if (textLow === "oi" || textLow === "olá" || textLow === "ola") {
                await responder(`Olá! @${sender.split('@')[0]}, como posso ajudar na sua produção hoje? 🎹`);
                return;
            }
            if (textLow === "como estão" || textLow === "tudo bem") {
                await responder("Tudo excelente por aqui, focado nos beats e na organização! E com vocês? 🚀");
                return;
            }
            if (textLow === "tudo bem por aqui") {
                await responder("Fico feliz em saber! Vamos manter esse clima positivo e criar grandes obras hoje. 🔥");
                return;
            }
            if (textLow === "cheguei") {
                await responder("Seja bem-vindo à sessão! A família estava à sua espera. Vamos produzir? 🎧");
                return;
            }
            if (textLow === "kmk família" || textLow === "kmk familia" || textLow === "kmk beatmakers") {
                await responder("Kmk! A união faz o hit. Os produtores de elite estão todos aqui! 🥁");
                return;
            }

            // 2. CÉREBRO DE ÁUDIO
            if (type === 'audioMessage') {
                const isPTT = msg.message.audioMessage.ptt;
                if (isPTT) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    if (isGroup) await socket.sendMessage(from, { text: "⚪ *[ @7viDASBotMusic ]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // 3. FILTRO AUTOMÁTICO (ANTI-LINK / ANTI-LIXO)
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                if (isBotAdmin && !isSenderAdmin) {
                    const linkRegex = /(https?:\/\/|chat\.whatsapp\.com)/gi;
                    const isMidiaFora = (type === 'imageMessage' || type === 'videoMessage');

                    if (linkRegex.test(textRaw) || isMidiaFora) {
                        await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                        await delay(800);
                        await socket.sendMessage(from, { delete: msg.key });
                        
                        let v = (global.advertencias.get(sender) || 0) + 1;
                        global.advertencias.set(sender, v);
                        
                        if (v >= 3) {
                            await socket.groupParticipantsUpdate(from, [sender], "remove");
                            await socket.sendMessage(from, { text: `🔴 *BANIDO:* @${sender.split('@')[0]} removido por excesso de avisos.` });
                        } else {
                            await socket.sendMessage(from, { text: `⚠️ *AVISO [${v}/3]:* @${sender.split('@')[0]}, evite conteúdo fora do tema!` });
                        }
                        return;
                    }
                }
            }

            // 4. SISTEMA DE COMANDOS
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            if (command === "menu") {
                const menu = `${style.h1("@7viDASBotMusic")}
║
${style.h2("PRODUÇÃO & DICAS")}
${style.li("!dicas [assunto] - Tutoriais YT")}
${style.li("!apps [nome] - Download de Apps")}
${style.li("!drums [estilo] - Packs Grátis")}
${style.li("!vst [nome] - Plugins VST")}
║
${style.h2("BUSCAS & UTILITÁRIOS")}
${style.li("!yt [busca] - Vídeo + Canal")}
${style.li("!foto [nome] - Capa do Vídeo")}
${style.li("!ping - Velocidade do Bot")}
║
${style.h2("ADMINISTRAÇÃO")}
${style.li("!link - Link do Grupo")}
║
║ 👑 ADMIN: JACKSON@7VIDAS
${style.end}`;
                await socket.sendMessage(from, { text: menu });
            }

            if (command === "ping") {
                const start = Date.now();
                await socket.sendMessage(from, { text: `🛰️ *PONG!* \n🔵 Latência: ${Date.now() - start}ms\n⚪ Bot: @7viDASBotMusic` });
            }

            if (command === "dicas" || command === "apps" || command === "yt") {
                if (!query && command !== "yt") return socket.sendMessage(from, { text: "❓ _Diga o que buscar!_" });
                const s = await yts(query || "jackson beatz");
                const v = s.videos[0];
                await socket.sendMessage(from, { text: `📺 *RESULTADO @7viDASBotMusic*\n\n📌 *Título:* ${v.title}\n🔗 *Link:* ${v.url}\n👤 *Canal:* ${v.author.name}` });
            }

            if (command === "foto") {
                const s = await yts(query);
                if (s.videos[0]) await socket.sendMessage(from, { image: { url: s.videos[0].thumbnail }, caption: `🔵 *Capa Encontrada:* ${s.videos[0].title}` });
            }

            if (command === "link") {
                const code = await socket.groupInviteCode(from);
                await socket.sendMessage(from, { text: `🔗 *LINK DO GRUPO:* https://chat.whatsapp.com/${code}` });
            }

        } catch (e) { console.log(e); }
    });
}
startBot();
