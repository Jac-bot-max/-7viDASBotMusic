const { default: makeWASocket, useMultiFileAuthState, delay, jidDecode, MessageType, ContentType } = require("@whiskeysockets/baileys");
const mongoose = require("mongoose");
const pino = require("pino");
const http = require("http");
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// --- CONFIGURAÇÃO ---
const mongoURL = "SEU_LINK_DO_MONGODB_AQUI"; 
const prefix = "."; 
const owner = "258865560063@s.whatsapp.net";
let aviso_db = {}; // Banco de avisos temporário

http.createServer((req, res) => { res.end('Jackson AI Pro Ativo'); }).listen(process.env.PORT || 3000);

async function startBot() {
    await mongoose.connect(mongoURL);
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const conn = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ["Jackson AI Elite", "Chrome", "1.0.0"]
    });

    // --- ANTI-TRAVA (Proteção de Mensagens Gigantes) ---
    conn.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const type = Object.keys(msg.message)[0];
        const body = (type === 'conversation') ? msg.message.conversation : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : (type === 'imageMessage' || type === 'videoMessage') ? msg.message[type].caption : '';
        
        // Bloqueio de mensagens muito longas (Anti-trava)
        if (isGroup && body.length > 4000) {
            await conn.sendMessage(from, { delete: msg.key });
            return conn.sendMessage(from, { text: "⚠️ Mensagem suspeita de trava removida." });
        }

        // --- REAÇÃO A ÁUDIOS ---
        if (type === 'audioMessage') {
            return conn.sendMessage(from, { text: "Obrigado por compartilhar esta obra, um dos nossos vai analisar. 🎵", quoted: msg });
        }

        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(1).trim().split(/ +/).shift().toLowerCase() : null;
        const args = body.trim().split(/ +/).slice(1);

        // --- INFO ADMINS ---
        const groupMetadata = isGroup ? await conn.groupMetadata(from) : null;
        const participants = isGroup ? groupMetadata.participants : [];
        const groupAdmins = isGroup ? participants.filter(v => v.admin !== null).map(v => v.id) : [];
        const isBotAdmin = isGroup ? groupAdmins.includes(conn.user.id.split(':')[0] + '@s.whatsapp.net') : false;
        const isSenderAdmin = isGroup ? groupAdmins.includes(msg.key.participant) : false;

        // --- ANTI-LINK ---
        if (isGroup && isBotAdmin && !isSenderAdmin && (body.includes('chat.whatsapp.com') || body.includes('http'))) {
            await conn.sendMessage(from, { delete: msg.key });
            return conn.sendMessage(from, { text: "❌ Links proibidos! Use .warn para avisar." });
        }

        if (!isCmd) return;

        switch (command) {
            case 'ia': // Resposta com Inteligência Artificial
                if (!args[0]) return conn.sendMessage(from, { text: "Diga algo para eu pensar..." });
                conn.sendMessage(from, { text: "🧠 Deixe-me ver... " + args.join(" ") + "\n\n(IA processando sua resposta...)" });
                // Aqui você pode integrar uma API real do GPT se quiser
                break;

            case 'sticker':
            case 's': // Criação de Figurinha
                if (type === 'imageMessage') {
                    const buffer = await conn.downloadMediaMessage(msg);
                    const sticker = new Sticker(buffer, {
                        pack: 'Jackson AI Pack',
                        author: 'Bot Jackson',
                        type: StickerTypes.FULL,
                        categories: ['🤩', '🎉'],
                        id: '12345',
                        quality: 50,
                    });
                    conn.sendMessage(from, await sticker.toMessage());
                } else {
                    conn.sendMessage(from, { text: "Envie uma imagem com a legenda *.sticker*" });
                }
                break;

            case 'warn': // Sistema de Aviso
                if (!isGroup || !isSenderAdmin) return;
                const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                if (!target) return conn.sendMessage(from, { text: "Marque o infrator." });
                aviso_db[target] = (aviso_db[target] || 0) + 1;
                if (aviso_db[target] >= 3) {
                    await conn.groupParticipantsUpdate(from, [target], 'remove');
                    conn.sendMessage(from, { text: `🚫 @${target.split('@')[0]} atingiu 3 avisos e foi banido!`, mentions: [target] });
                } else {
                    conn.sendMessage(from, { text: `⚠️ @${target.split('@')[0]}, você recebeu um aviso! (${aviso_db[target]}/3)`, mentions: [target] });
                }
                break;

            case 'ban':
                if (!isGroup || !isSenderAdmin) return;
                const victim = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                await conn.groupParticipantsUpdate(from, [victim], 'remove');
                conn.sendMessage(from, { text: "👢 Removido pelo sistema de segurança." });
                break;

            case 'marcar':
                if (!isGroup || !isSenderAdmin) return;
                let m_text = `📢 *MENSAGEM DO ADM*\n\n${args.join(" ") || "Olá família, compartilhem o grupo!"}\n\n`;
                participants.forEach(p => m_text += `@${p.id.split('@')[0]} `);
                conn.sendMessage(from, { text: m_text, mentions: participants.map(p => p.id) });
                break;
        }
    });

    conn.ev.on('group-participants.update', async (anu) => {
        if (anu.action == 'add') {
            conn.sendMessage(anu.id, { text: `✨ Bem-vindo(a) @${anu.participants[0].split('@')[0]}! Sou a Jackson AI, sua moderadora.`, mentions: anu.participants });
        }
    });

    conn.ev.on('creds.update', saveCreds);
    conn.ev.on('connection.update', (up) => { if (up.connection === 'close') startBot(); });
}

startBot();