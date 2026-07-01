import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- MANTENDO SISTEMA DE CONEXÃO E LOGIN ---
const app = express();
app.get('/', (req, res) => res.send('@7viDASBotMusic Etapa 2 Ativa'));
app.listen(process.env.PORT || 3000);

// BANCO DE DADOS TEMPORÁRIO PARA ADVERTÊNCIAS
const warnDB = new Map(); 

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
    });

    socket.ev.on("creds.update", saveCreds);

    // --- ETAPA 2: SISTEMA DE BOAS-VINDAS COM FOTO ---
    socket.ev.on("group-participants.update", async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let ppUrl;
                    try {
                        ppUrl = await socket.profilePictureUrl(jid, 'image');
                    } catch {
                        ppUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
                    }
                    
                    const welcome = `╔══════ ⚪ *WELCOME* ⚪ ══════╗\n║\n║ 👋 Olá, @${jid.split('@')[0]}!\n║ Bem-vindo ao *@7viDASBotMusic*.\n║ 👑 ADM: *JACKSON@7VIDAS*\n║\n║ 🔵 Use *!menu* para começar.\n║\n╚══════════════════════════╝`;
                    
                    await socket.sendMessage(anu.id, { 
                        image: { url: ppUrl }, 
                        caption: welcome, 
                        mentions: [jid] 
                    });
                } catch (e) { console.log("Erro nas boas-vindas:", e); }
            }
        }
    });

    socket.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startBot();
        if (connection === "open") console.log("✅ @7viDASBotMusic: ONLINE - ETAPA 2 ATIVA");
    });

    socket.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();
            const sender = msg.key.participant || msg.key.remoteJid;

            if (!isGroup) return;

            // CONFIGURAÇÕES DE ADMIN
            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            const args = text.split(" ");
            const command = args[0];

            // FUNÇÃO PARA PEGAR QUEM FOI MARCADO OU RESPONDIDO
            const getTarget = () => {
                return msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                       msg.message.extendedTextMessage?.contextInfo?.participant;
            };

            // --- ETAPA 2: COMANDOS DE ADMINISTRAÇÃO ---

            // !WARN (DAR ADVERTÊNCIA)
            if (command === "!warn" && isSenderAdmin && isBotAdmin) {
                const target = getTarget();
                if (!target) return socket.sendMessage(from, { text: "❌ Marque ou responda a mensagem de alguém para dar advertência." });
                if (admins.includes(target)) return socket.sendMessage(from, { text: "❌ Não posso advertir administradores." });

                let count = (warnDB.get(target) || 0) + 1;
                warnDB.set(target, count);

                if (count >= 3) {
                    await socket.groupParticipantsUpdate(from, [target], "remove");
                    await socket.sendMessage(from, { text: `🔴 *LIMITE ATINGIDO!* \n\nO usuário @${target.split('@')[0]} foi banido após 3 advertências.`, mentions: [target] });
                    warnDB.delete(target);
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *ADVERTÊNCIA [${count}/3]* \n\nO usuário @${target.split('@')[0]} recebeu um aviso de JACKSON@7VIDAS.`, mentions: [target] });
                }
            }

            // !UNWARN (REMOVER ADVERTÊNCIA)
            if (command === "!unwarn" && isSenderAdmin && isBotAdmin) {
                const target = getTarget();
                if (!target) return;
                let count = warnDB.get(target) || 0;
                if (count > 0) warnDB.set(target, count - 1);
                await socket.sendMessage(from, { text: `✅ Advertência removida. Total: [${warnDB.get(target) || 0}/3].` });
            }

            // !WARNLIST (LISTA DE ADVERTIDOS)
            if (command === "!warnlist" && isSenderAdmin) {
                let lista = "📋 *LISTA DE ADVERTÊNCIAS*\n\n";
                warnDB.forEach((val, key) => {
                    lista += `👤 @${key.split('@')[0]}: [${val}/3]\n`;
                });
                if (warnDB.size === 0) lista = "✅ Nenhum membro advertido no momento.";
                await socket.sendMessage(from, { text: lista, mentions: Array.from(warnDB.keys()) });
            }

            // !BAN (REMOVER NA HORA)
            if (command === "!ban" && isSenderAdmin && isBotAdmin) {
                const target = getTarget();
                if (!target) return;
                await socket.groupParticipantsUpdate(from, [target], "remove");
                await socket.sendMessage(from, { text: `🔴 Usuário removido por JACKSON@7VIDAS.` });
            }

            // MANTENDO COMANDO !MENU ATUALIZADO
            if (command === "!menu") {
                const menu = `╔════ 🔵 *@7viDASBotMusic* 🔵 ════╗
║
║ 🔴 *ADMINISTRAÇÃO (JACKSON@7VIDAS)*
║ ◽ !warn - Dar advertência (1/3)
║ ◽ !unwarn - Tirar advertência
║ ◽ !warnlist - Lista de avisos
║ ◽ !ban - Remover imediatamente
║
║ ⚪ *PRODUÇÃO & BUSCAS*
║ ◽ !yt [busca] | !drums [estilo]
║ ◽ !flpc | !flmobile | !foto
║
║ 🔵 *GRUPO*
║ ◽ !link - Link do grupo
║ ◽ !ping - Status do bot
║
╚══════════════════════════╝`;
                await socket.sendMessage(from, { text: menu });
            }

            // MANTENDO COMANDO !YT E OUTROS
            if (command === "!yt") {
                const query = text.slice(3).trim();
                if (!query) return;
                const s = await yts(query);
                if (s.videos[0]) {
                    const v = s.videos[0];
                    await socket.sendMessage(from, { text: `📺 *YouTube:* ${v.title}\n🔗 ${v.url}\n👤 *Canal:* ${v.author.name}` });
                }
            }

        } catch (e) { console.log(e); }
    });
}

startBot();
