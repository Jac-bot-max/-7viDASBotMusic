import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, delay } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Protocolo Baileys Ativado'));
app.listen(process.env.PORT || 3000);

const advertencias = new Map();

async function startBot() {
    if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
    const sessionID = process.env.SESSION_ID;
    
    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decodedSession = Buffer.from(sessionID, 'base64').toString('utf-8');
        fs.writeFileSync('./session_data/creds.json', decodedSession);
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        shouldSyncHistoryMessage: () => false,
        printQRInTerminal: false,
        browser: ["@7viDASBotMusic", "Chrome", "1.0.0"]
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startBot();
        if (connection === "open") console.log("✅ @7viDASBotMusic: PROTOCOLO DE ADM ATIVADO");
    });

    socket.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
            const sender = msg.key.participant || msg.key.remoteJid;

            if (!isGroup) return;

            // --- LÓGICA DE ADMINISTRAÇÃO (CONFORME DICA DO GEMINI) ---
            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            // 1. ANTI-LINK COM DELEÇÃO PROFISSIONAL
            const linkRegex = /(https?:\/\/|chat\.whatsapp\.com)/gi;
            if (linkRegex.test(textRaw) && !isSenderAdmin && isBotAdmin) {
                // Reage com X
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await delay(500);

                // PROTOCOLO DE DELEÇÃO CORRETO (BAILEYS)
                await socket.sendMessage(from, { 
                    delete: { 
                        remoteJid: from, 
                        fromMe: false, 
                        id: msg.key.id, 
                        participant: sender 
                    } 
                });

                // Lógica de Banimento Automático (3 avisos)
                let avisos = (advertencias.get(sender) || 0) + 1;
                advertencias.set(sender, avisos);

                if (avisos >= 3) {
                    await socket.groupParticipantsUpdate(from, [sender], "remove");
                    await socket.sendMessage(from, { text: `🔴 *BANIDO:* @${sender.split('@')[0]} atingiu o limite de links.`, mentions: [sender] });
                    advertencias.delete(sender);
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *AVISO [${avisos}/3]* @${sender.split('@')[0]}, links são proibidos!`, mentions: [sender] });
                }
                return;
            }

            // 2. ANTI-BULLYING COM REMOÇÃO DIRETA
            const bullying = ["bullying", "bully", "preto", "macaco", "estupido", "burro"];
            if (bullying.some(p => textRaw.toLowerCase().includes(p)) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { 
                    delete: { remoteJid: from, fromMe: false, id: msg.key.id, participant: sender } 
                });
                await socket.groupParticipantsUpdate(from, [sender], "remove");
                return;
            }

            // --- RECONHECIMENTO DE MÍDIA (CÉREBRO) ---
            if (type === 'audioMessage') {
                const isVoz = msg.message.audioMessage.ptt;
                if (isVoz) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[ @7viDASBotMusic ]* ⚪\n\n🔵 _Instrumental recebido. JACKSON@7VIDAS vai analisar._" }, { quoted: msg });
                }
                return;
            }

            // --- COMANDOS ---
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            if (command === "menu") {
                const menu = `╔═════ 🔵 *@7viDASBotMusic* 🔵 ═════╗
║
║ 🔴 *ADMINISTRAÇÃO*
║ ◽ !warn | !unwarn | !ban
║ ◽ !link | !marcar
║
║ ⚪ *PRODUÇÃO & BUSCAS*
║ ◽ !yt [busca] | !foto [nome]
║ ◽ !drums [estilo] | !vst [nome]
║ ◽ !flpc | !flmobile
║
║ 🔵 *STATUS*
║ ◽ !ping - Velocidade
║
║ 👑 ADMIN: JACKSON@7VIDAS
╚════════════════════════════╝`;
                await socket.sendMessage(from, { text: menu });
            }

            if (command === "ping") {
                const start = Date.now();
                await socket.sendMessage(from, { text: `🔵 *LATÊNCIA:* ${Date.now() - start}ms` });
            }

            if (command === "yt") {
                if (!query) return;
                const s = await yts(query);
                if (s.videos[0]) {
                    const v = s.videos[0];
                    await socket.sendMessage(from, { text: `📺 *YouTube:* ${v.title}\n🔗 ${v.url}\n👤 *Canal:* ${v.author.url}` });
                }
            }

            // ... (Outros comandos permanecem iguais)

        } catch (e) { console.log("Erro no Processamento:", e); }
    });
}

startBot();
