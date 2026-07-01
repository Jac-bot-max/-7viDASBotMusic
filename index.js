import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
app.get('/', (req, res) => res.send('Jackson Beatz V3 - Central de Produção Ativa!'));
app.listen(process.env.PORT || 3000);

async function startJackson() {
    // Recuperação de Sessão via Chave (SESSION_ID)
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
        printQRInTerminal: false,
        auth: state,
        logger: pino({ level: "silent" }),
        shouldSyncHistoryMessage: () => false,
    });

    socket.ev.on("creds.update", saveCreds);

    // BOAS-VINDAS AUTOMÁTICAS
    socket.ev.on("group-participants.update", async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                await socket.sendMessage(anu.id, { text: `🎧 Bem-vindo(a) à família Jackson Beatz, @${jid.split('@')[0]}! \n\nUsa o comando *!menu* para ver os packs e plugins disponíveis no YouTube.`, mentions: [jid] });
            }
        }
    });

    socket.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startJackson();
        if (connection === "open") console.log("✅ JACKSON BEATZ V3: SISTEMA PRONTO!");
    });

    socket.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
            const args = text.split(" ");
            const command = args[0];
            const query = text.slice(command.length).trim();

            // MENU DE COMANDOS
            if (command === "!menu") {
                const menu = `--- 🎹 JACKSON BEATZ V3 ---

*PRODUÇÃO (YOUTUBE):*
!drums [estilo] - Busca packs de bateria (Ex: !drums trap)
!vst [nome] - Busca plugins (Ex: !vst piano)
!foto [nome] - Foto da capa de um vídeo
!yt [busca] - Link de qualquer vídeo

*ADMINISTRAÇÃO:*
!ban - Remover alguém (marcar a pessoa)
!link - Link de convite do grupo`;
                await socket.sendMessage(from, { text: menu });
            }

            // COMANDO !DRUMS FLEXÍVEL
            if (command === "!drums") {
                // Se o usuário não digitar o estilo, busca packs grátis gerais
                const buscaDrums = query ? `drum kit ${query} free download` : "best free drum kits 2024 pack";
                await socket.sendMessage(from, { text: `🔍 Procurando Drums de *${query || 'Geral'}* no YouTube...` });
                
                const search = await yts(buscaDrums);
                if (search.videos[0]) {
                    const v = search.videos[0];
                    await socket.sendMessage(from, { text: `🥁 *DRUM KIT ENCONTRADO:* \n\n*Título:* ${v.title}\n*Canal:* ${v.author.name}\n*Link:* ${v.url}` });
                } else {
                    await socket.sendMessage(from, { text: "❌ Não encontrei nenhum pack para este estilo." });
                }
            }

            // COMANDO !VST FLEXÍVEL
            if (command === "!vst") {
                const buscaVst = query ? `best free ${query} vst plugin` : "top free vst plugins 2024";
                const search = await yts(buscaVst);
                if (search.videos[0]) {
                    const v = search.videos[0];
                    await socket.sendMessage(from, { text: `🎹 *VST ENCONTRADO:* \n\n*Título:* ${v.title}\n*Link:* ${v.url}` });
                }
            }

            // BUSCA GERAL
            if (command === "!yt") {
                if (!query) return;
                const search = await yts(query);
                if (search.videos[0]) {
                    await socket.sendMessage(from, { text: `📺 *YouTube:* \n\n${search.videos[0].title}\n${search.videos[0].url}` });
                }
            }

            // FOTO
            if (command === "!foto") {
                const search = await yts(query);
                if (search.videos[0]) {
                    await socket.sendMessage(from, { image: { url: search.videos[0].thumbnail }, caption: `*Capa:* ${search.videos[0].title}` });
                }
            }

            // MODERAÇÃO
            if ((command === "!ban" || command === "!remover") && isGroup) {
                let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [msg.message.extendedTextMessage?.contextInfo?.participant];
                if (!users[0]) return;
                await socket.groupParticipantsUpdate(from, users, "remove");
                await socket.sendMessage(from, { text: "✅ Utilizador removido." });
            }

        } catch (e) { console.log(e); }
    });
}

startJackson();
