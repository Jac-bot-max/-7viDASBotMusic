import express from 'express';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, delay } from "baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

const app = express();
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Sistema de Elite Ativo'));
app.listen(process.env.PORT || 3000);

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
        browser: ["@7viDASBotMusic", "Chrome", "1.0.0"]
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startBot();
        if (connection === "open") console.log("✅ @7viDASBotMusic: CONECTADO COM 20+ COMANDOS");
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

            // CONFIGURAÇÕES DE GRUPO
            const groupMetadata = await socket.groupMetadata(from);
            const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
            const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = admins.includes(sender);

            // --- 1. ANTI-LINK AUTOMÁTICO (REAGIR E APAGAR) ---
            const linkRegex = /(https?:\/\/|chat\.whatsapp\.com)/gi;
            if (linkRegex.test(textRaw) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await delay(1000);
                await socket.sendMessage(from, { delete: msg.key });
                await socket.sendMessage(from, { text: "🔴 *LINKS PROIBIDOS:* Apenas administradores podem enviar links aqui." });
                return;
            }

            // --- 2. ANTI-BULLYING / INSULTOS ---
            const bullying = ["bullying", "lixo", "macaco", "preto", "estupido", "burro", "fdp", "macaco", "anormal"];
            if (bullying.some(p => textRaw.toLowerCase().includes(p)) && !isSenderAdmin && isBotAdmin) {
                await socket.sendMessage(from, { react: { text: "🚫", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });
                await socket.groupParticipantsUpdate(from, [sender], "remove");
                await socket.sendMessage(from, { text: `🔴 *BANIDO:* @${sender.split('@')[0]} expulso por falta de respeito.`, mentions: [sender] });
                return;
            }

            // --- 3. REAÇÃO INSTRUMENTAL ---
            if (type === 'audioMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[ @7viDASBotMusic ]* ⚪\n\n🔵 _Instrumental recebido. JACKSON@7VIDAS vai analisar._" }, { quoted: msg });
                return;
            }

            // --- PARSER DE COMANDOS ---
            if (!textRaw.startsWith('!')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            // FUNÇÃO PARA PEGAR ALVO (MENTION OU REPLY)
            const getTarget = () => msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;

            // --- 4. LISTA DE 20+ COMANDOS ---

            switch (command) {
                case "menu":
                    const menu = `╔════ 🔵 *@7viDASBotMusic* 🔵 ════╗
║
║ 🔴 *ADMINISTRAÇÃO*
║ ◽ !warn | !unwarn | !ban
║ ◽ !warnlist | !link | !marcar
║ ◽ !admins | !infogrupo | !sair
║
║ ⚪ *PRODUÇÃO & DICAS*
║ ◽ !dica [assunto] (Ex: masterizar)
║ ◽ !drums [estilo] | !vst [nome]
║ ◽ !flpc | !flmobile | !bandlab
║ ◽ !voloco | !key (Sua Sessão)
║
║ 🔵 *BUSCAS YT & STATUS*
║ ◽ !yt [busca] | !foto [nome]
║ ◽ !ping - Velocidade
║
║ 👑 ADMIN: JACKSON@7VIDAS
╚══════════════════════════╝`;
                    await socket.sendMessage(from, { text: menu });
                    break;

                case "ping":
                    const start = Date.now();
                    await socket.sendMessage(from, { text: `🔵 *LATÊNCIA:* ${Date.now() - start}ms\n⚪ *NOME:* @7viDASBotMusic` });
                    break;

                case "dica": // COMANDO DE DICA DINÂMICA
                    if (!query) return socket.sendMessage(from, { text: "❓ _Diga o que quer aprender. Ex: !dica masterizar voz_" });
                    await socket.sendMessage(from, { text: `🔍 _Procurando as melhores dicas sobre ${query}..._` });
                    const dicaSearch = await yts(`como ${query} tutorial produção musical`);
                    if (dicaSearch.videos[0]) {
                        const v = dicaSearch.videos[0];
                        await socket.sendMessage(from, { text: `💡 *DICA JACKSON@7VIDAS:* \n\n📌 *Tema:* ${v.title}\n🔗 *Assista aqui:* ${v.url}\n\n_Espero que ajude na sua produção!_` });
                    }
                    break;

                case "yt":
                    const s = await yts(query || "jackson beatz");
                    const v = s.videos[0];
                    await socket.sendMessage(from, { text: `📺 *YouTube:* ${v.title}\n🔗 ${v.url}\n👤 *Canal:* ${v.author.url}` });
                    break;

                case "foto":
                    const f = await yts(query);
                    if (f.videos[0]) await socket.sendMessage(from, { image: { url: f.videos[0].thumbnail }, caption: `🔵 *Thumbnail:* ${f.videos[0].title}` });
                    break;

                case "warn":
                    if (!isSenderAdmin || !isBotAdmin) return;
                    const targetW = getTarget();
                    if (!targetW) return;
                    let count = (warnDB.get(targetW) || 0) + 1;
                    warnDB.set(targetW, count);
                    await socket.sendMessage(from, { text: `⚠️ *AVISO [${count}/3]* para @${targetW.split('@')[0]}`, mentions: [targetW] });
                    if (count >= 3) {
                        await socket.groupParticipantsUpdate(from, [targetW], "remove");
                        warnDB.delete(targetW);
                    }
                    break;

                case "unwarn":
                    if (!isSenderAdmin) return;
                    const targetU = getTarget();
                    if (targetU) { warnDB.set(targetU, 0); await socket.sendMessage(from, { text: "✅ Advertências zeradas." }); }
                    break;

                case "ban":
                    if (!isSenderAdmin || !isBotAdmin) return;
                    const targetB = getTarget();
                    if (targetB) await socket.groupParticipantsUpdate(from, [targetB], "remove");
                    break;

                case "link":
                    if (!isBotAdmin) return;
                    const code = await socket.groupInviteCode(from);
                    await socket.sendMessage(from, { text: `🔗 *LINK:* https://chat.whatsapp.com/${code}` });
                    break;

                case "marcar":
                    if (!isSenderAdmin) return;
                    const tps = groupMetadata.participants.map(p => p.id);
                    await socket.sendMessage(from, { text: `📢 *ATENÇÃO TODOS:* \n\n${query || 'JACKSON@7VIDAS chamando!'}`, mentions: tps });
                    break;

                case "admins":
                    const adms = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                    await socket.sendMessage(from, { text: `👑 *ADMINS DO GRUPO:*`, mentions: adms });
                    break;

                case "infogrupo":
                    const info = `📋 *INFO DO GRUPO*\n\n👥 *Membros:* ${groupMetadata.participants.length}\n👑 *Criador:* @${groupMetadata.owner?.split('@')[0]}\n📜 *Descrição:* \n${groupMetadata.desc}`;
                    await socket.sendMessage(from, { text: info, mentions: [groupMetadata.owner] });
                    break;
                
                case "drums": case "vst": case "flpc": case "flmobile": case "bandlab": case "voloco":
                    const res = await yts(`${command} ${query || 'free download pack'}`);
                    await socket.sendMessage(from, { text: `🥁 *ENCONTRADO:* \n\n${res.videos[0].title}\n🔗 ${res.videos[0].url}` });
                    break;
                
                case "key":
                    const creds = fs.readFileSync('./session_data/creds.json');
                    await socket.sendMessage(sender, { text: `🔐 *SUA SESSION_ID:* \n\n${Buffer.from(creds).toString('base64')}` });
                    await socket.sendMessage(from, { text: "✅ Enviei sua chave de acesso no seu privado!" });
                    break;
            }

        } catch (e) { console.log(e); }
    });
}

startBot();
