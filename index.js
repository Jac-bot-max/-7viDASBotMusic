const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const http = require("http");
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// Servidor de Monitoramento
http.createServer((req, res) => res.end('Jackson AI Supreme Online')).listen(process.env.PORT || 3000);

async function startBot() {
    if (process.env.SESSION_ID && !fs.existsSync('session/creds.json')) {
        if (!fs.existsSync('session')) fs.mkdirSync('session');
        fs.writeFileSync('session/creds.json', Buffer.from(process.env.SESSION_ID, 'base64').toString('utf-8'));
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Jackson AI Pro", "MacOS", "3.0.0"]
    });

    // --- 🏠 SISTEMA DE BOAS-VINDAS ---
    conn.ev.on('group-participants.update', async (anu) => {
        if (anu.action == 'add') {
            const metadata = await conn.groupMetadata(anu.id);
            for (let num of anu.participants) {
                let welcome = `┏━━━━━━━  『 *BEM-VINDO(A)* 』 ━━━━━━━┓\n┃\n┃ 👋 Olá @${num.split('@')[0]}\n┃ ✨ Bem-vindo(a) ao grupo: \n┃ *${metadata.subject}*\n┃\n┃ 🤖 Sou a *JACKSON AI*, sua moderadora.\n┃ 💡 Digite *.menu* para ver as funções.\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                await conn.sendMessage(anu.id, { text: welcome, mentions: [num] });
            }
        }
    });

    conn.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "";
        const prefix = ".";
        const isGroup = from.endsWith('@g.us');

        // --- 🚨 MODERAÇÃO AUTOMÁTICA (LINKS/STATUS/MENÇÕES) 🚨 ---
        if (isGroup) {
            const groupMetadata = await conn.groupMetadata(from);
            const participants = groupMetadata.participants;
            const groupAdmins = participants.filter(v => v.admin !== null).map(v => v.id);
            const isBotAdmin = groupAdmins.includes(conn.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = groupAdmins.includes(msg.key.participant);

            if (isBotAdmin && !isSenderAdmin) {
                // Detectar Links e Menções Externas/Status
                if (body.includes('chat.whatsapp.com') || body.includes('whatsapp.com/channel') || body.includes('/status/')) {
                    await conn.sendMessage(from, { delete: msg.key });
                    return conn.sendMessage(from, { text: "❌ *SEGURANÇA:* Links e Status são proibidos aqui." });
                }
            }
        }

        // --- REAÇÃO A ÁUDIO ---
        if (type === 'audioMessage') {
            await conn.sendMessage(from, { react: { text: "🎧", key: msg.key } });
            return conn.sendMessage(from, { text: '🎵 *Jackson AI Audio System* \n\nObrigado por compartilhar esta obra! 🎵', quoted: msg });
        }

        if (!body.startsWith(prefix)) return;
        const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        // --- COMANDOS ---
        switch (command) {
            case 'menu':
                const menuSupremo = `
┏━━━━━━━  『 *JACKSON AI* 』 ━━━━━━━┓
┃
┃  🚀 *ESTADO:* 24H ONLINE
┃  👑 *ENGINE:* SUPREME NEURAL V12
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *MODERAÇÃO* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🛠️ .marcar (Tag Geral)
┃ 🛠️ .ban (@membro)
┃ 🛠️ .promover (@membro)
┃ 🛠️ .rebaixar (@membro)
┃ 🛠️ .del (Responder msg)
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *FIGURINHAS* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ ✨ .s (Foto em Figurinha)
┃ ✨ .sticker (Figurinha Full)
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                await conn.sendMessage(from, { text: menuSupremo });
                break;

            case 's':
            case 'sticker':
                if (type === 'imageMessage') {
                    const buffer = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                    let chunks = Buffer.from([]);
                    for await (const chunk of buffer) { chunks = Buffer.concat([chunks, chunk]); }
                    const sticker = new Sticker(chunks, {
                        pack: 'Jackson AI Pack',
                        author: 'Supreme Bot',
                        type: StickerTypes.FULL,
                        quality: 70
                    });
                    await conn.sendMessage(from, await sticker.toMessage());
                } else {
                    conn.sendMessage(from, { text: "Envie uma foto com a legenda *.s*" });
                }
                break;

            case 'marcar':
                const metadata = await conn.groupMetadata(from);
                let aviso = `📢 *AVISO SUPREMO*\n\n${args.join(" ") || "Olá família, compartilhem o grupo!"}\n\n`;
                for (let p of metadata.participants) { aviso += `@${p.id.split('@')[0]} `; }
                await conn.sendMessage(from, { text: aviso, mentions: metadata.participants.map(a => a.id) });
                break;
        }
    });

    conn.ev.on('creds.update', saveCreds);
    conn.ev.on('connection.update', (update) => {
        if (update.connection === 'open') console.log("✅ JACKSON AI SUPREME ONLINE!");
        if (update.connection === 'close') startBot();
    });
}

startBot();