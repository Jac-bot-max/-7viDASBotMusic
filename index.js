import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- SERVIDOR PARA MANTER ONLINE ---
const app = express();
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema de Elite Ativo'));
app.listen(process.env.PORT || 3000);

// MEMÓRIA TEMPORÁRIA
const advertencias = new Map();

async function startBot() {
    // Recuperação de Sessão via Environment Variable (SESSION_ID)
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
        browser: ["@7viDASBotMusic", "Safari", "1.0.0"]
    });

    socket.ev.on("creds.update", saveCreds);

    // --- BOAS-VINDAS PROFISSIONAL COM FOTO ---
    socket.ev.on("group-participants.update", async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let ppUrl;
                    try { ppUrl = await socket.profilePictureUrl(jid, 'image'); } catch { ppUrl = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔══════ ⚪ *WELCOME* ⚪ ══════╗\n║\n║ 👋 Olá, @${jid.split('@')[0]}!\n║ Bem-vindo ao *@7viDASBotMusic*.\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║\n║ 🔵 Use *!menu* para navegar.\n║ 🔴 Respeite as regras do grupo!\n║\n╚════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: ppUrl }, caption: welcome, mentions: [jid] });
                } catch (e) { console.log(e); }
            }
        }
    });

    socket.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startBot();
        if (connection === "open") console.log("✅ @7viDASBotMusic: ONLINE E PROTEGIDO");
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

            // --- CONFIGURAÇÕES DE ADMINISTRAÇÃO ---
            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            // --- 1. FILTRO ANTI-BULLYING (BAN IMEDIATO) ---
            const bullying = ["bullying", "bully", "macaco", "preto", "estupido", "burro", "lixo", "verme", "anormal", "aleijado", "fdp"];
            if (bullying.some(p => textRaw.toLowerCase().includes(p)) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "🚫", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });
                await socket.groupParticipantsUpdate(from, [sender], "remove");
                await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* @${sender.split('@')[0]} banido por Bullying/Insultos.`, mentions: [sender] });
                return;
            }

            // --- 2. ANTI-LINK E MÍDIA (SISTEMA DE 3 AVISOS) ---
            const linkRegex = /(https?:\/\/|chat\.whatsapp\.com)/gi;
            const isMedia = (type === 'imageMessage' || type === 'videoMessage');
            if ((linkRegex.test(textRaw) || isMedia) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });
                let avisos = (advertencias.get(sender) || 0) + 1;
                advertencias.set(sender, avisos);
                if (avisos >= 3) {
                    await socket.groupParticipantsUpdate(from, [sender], "remove");
                    await socket.sendMessage(from, { text: `🔴 *LIMITE ATINGIDO:* @${sender.split('@')[0]} expulso.`, mentions: [sender] });
                    advertencias.delete(sender);
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *AVISO [${avisos}/3]:* @${sender.split('@')[0]}, evite links/mídia irrelevante.`, mentions: [sender] });
                }
                return;
            }

            // --- 3. REAÇÃO INSTRUMENTAL (ÁUDIO) ---
            if (type === 'audioMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[ @7viDASBotMusic ]* ⚪\n\n🔵 _Instrumental recebido. JACKSON@7VIDAS vai analisar._" }, { quoted: msg });
                return;
            }

            // --- LÓGICA DE ESPAÇO DE LIVRAMENTO ---
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            // --- 4. COMANDOS ---

            // MENU PROFISSIONAL
            if (command === "menu") {
                const menuUltra = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗
║
║ 🔴 *ADMINISTRAÇÃO*
║ ◽ !warn | !unwarn | !ban
║ ◽ !warnlist | !link (Link do Grupo)
║
║ ⚪ *SOFTWARES & PRODUÇÃO*
║ ◽ !flpc | !flmobile | !bandlab
║ ◽ !voloco | !drums | !vst
║
║ 🔵 *BUSCAS & STATUS*
║ ◽ !yt [busca] | !foto [nome]
║ ◽ !ping - Velocidade do Bot
║
║ 👑 ADMIN: JACKSON@7VIDAS
╚══════════════════════════════════╝`;
                await socket.sendMessage(from, { text: menuUltra });
            }

            // PING
            if (command === "ping") {
                const start = Date.now();
                await socket.sendMessage(from, { text: `🔵 *LATÊNCIA:* ${Date.now() - start}ms\n⚪ *BOT:* @7viDASBotMusic\n🔴 *ADMIN:* JACKSON@7VIDAS` });
            }

            // YOUTUBE + CANAL
            if (command === "yt") {
                if (!query) return;
                const s = await yts(query);
                if (s.videos[0]) {
                    const v = s.videos[0];
                    await socket.sendMessage(from, { text: `📺 *YouTube Search*\n\n🔵 *Título:* ${v.title}\n⚪ *Link:* ${v.url}\n🔴 *Canal:* ${v.author.name}\n🔗 *Canal Link:* ${v.author.url}` });
                }
            }

            // FOTO
            if (command === "foto") {
                const s = await yts(query);
                if (s.videos[0]) await socket.sendMessage(from, { image: { url: s.videos[0].thumbnail }, caption: `🔵 *Thumbnail Encontrada*` });
            }

            // DRUMS / VST / SOFTWARE
            if (["drums", "vst", "flpc", "flmobile", "bandlab", "voloco"].includes(command)) {
                const s = await yts(`${command} ${query || 'free download pack'}`);
                await socket.sendMessage(from, { text: `🥁 *ENCONTRADO:* \n\n${s.videos[0].title}\n🔗 ${s.videos[0].url}` });
            }

            // --- FUNÇÕES DE ADMINISTRAÇÃO ---
            if (command === "warn" && isSenderAdmin && isBotAdmin) {
                const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
                if (!target) return;
                let c = (advertencias.get(target) || 0) + 1;
                advertencias.set(target, c);
                await socket.sendMessage(from, { text: `⚠️ *AVISO [${c}/3]* para @${target.split('@')[0]}`, mentions: [target] });
                if (c >= 3) {
                    await socket.groupParticipantsUpdate(from, [target], "remove");
                    advertencias.delete(target);
                }
            }

            if (command === "unwarn" && isSenderAdmin) {
                const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
                if (target) {
                    advertencias.set(target, 0);
                    await socket.sendMessage(from, { text: "✅ Advertências zeradas." });
                }
            }

            if (command === "warnlist" && isSenderAdmin) {
                let l = "📋 *LISTA DE ADVERTÊNCIAS*\n\n";
                advertencias.forEach((v, k) => { if(v > 0) l += `👤 @${k.split('@')[0]}: [${v}/3]\n` });
                await socket.sendMessage(from, { text: l || "✅ Nenhum advertido.", mentions: Array.from(advertencias.keys()) });
            }

            if (command === "link" && isBotAdmin) {
                const code = await socket.groupInviteCode(from);
                await socket.sendMessage(from, { text: `🔗 *LINK:* https://chat.whatsapp.com/${code}` });
            }

            if (command === "ban" && isSenderAdmin && isBotAdmin) {
                const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
                if (target) await socket.groupParticipantsUpdate(from, [target], "remove");
            }

        } catch (e) { console.log(e); }
    });
}

startBot();
