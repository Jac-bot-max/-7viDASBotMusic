const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const http = require("http");
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// Servidor de Monitoramento Render
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

    conn.ev.on('creds.update', saveCreds);

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

        // --- 🚨 SEGURANÇA E MODERAÇÃO AUTOMÁTICA 🚨 ---
        if (isGroup) {
            const groupMetadata = await conn.groupMetadata(from);
            const participants = groupMetadata.participants;
            const groupAdmins = participants.filter(v => v.admin !== null).map(v => v.id);
            const isBotAdmin = groupAdmins.includes(conn.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = groupAdmins.includes(msg.key.participant);

            if (isBotAdmin && !isSenderAdmin) {
                // 1. Apagar Links e Status de membros comuns
                if (body.includes('chat.whatsapp.com') || body.includes('whatsapp.com/channel') || body.includes('/status/')) {
                    await conn.sendMessage(from, { delete: msg.key });
                    return conn.sendMessage(from, { text: "❌ *SEGURANÇA:* Links e Status são proibidos aqui." });
                }
                // 2. Apagar menção ao ID do grupo (Proteção de Status/Spam)
                if (body.includes('@' + from.split('@')[0])) {
                    await conn.sendMessage(from, { delete: msg.key });
                }
            }
        }

        // --- REAÇÃO A ÁUDIO ---
        if (type === 'audioMessage') {
            await conn.sendMessage(from, { react: { text: "🎧", key: msg.key } });
            return conn.sendMessage(from, { text: '🎵 *Jackson AI Audio System* \n\nObrigado por compartilhar! Analisando... 🎵', quoted: msg });
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
┃  👑 *ENGINE:* SUPREME NEURAL V13
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *MODERAÇÃO REAL* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🛠️ .infogrupo (Dados do Grupo)
┃ 🛠️ .infoadm (Lista de Chefes)
┃ 🛠️ .marcar (Tag Geral)
┃ 🛠️ .ban (@membro)
┃ 🛠️ .promover (@membro)
┃ 🛠️ .rebaixar (@membro)
┃ 🛠️ .del (Responder msg)
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *CRIATIVIDADE* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ ✨ .s (Foto em Figurinha)
┃ ✨ .sticker (Figurinha Full)
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                await conn.sendMessage(from, { text: menuSupremo });
                break;

            case 'infogrupo':
                if (!isGroup) return;
                const gMeta = await conn.groupMetadata(from);
                const infoG = `🏠 *DADOS DO GRUPO*\n\n*Nome:* ${gMeta.subject}\n*ID:* ${from}\n*Membros:* ${gMeta.participants.length}\n*Criado em:* ${new Date(gMeta.creation * 1000).toLocaleString()}`;
                await conn.sendMessage(from, { text: infoG });
                break;

            case 'infoadm':
                if (!isGroup) return;
                const gMeta2 = await conn.groupMetadata(from);
                const adms = gMeta2.participants.filter(v => v.admin !== null).map(v => v.id);
                let listaAdms = "👮‍♂️ *ADMINS DO GRUPO:*\n\n";
                for (let a of adms) { listaAdms += `• @${a.split('@')[0]}\n`; }
                await conn.sendMessage(from, { text: listaAdms, mentions: adms });
                break;

            case 's':
            case 'sticker':
                if (type === 'imageMessage') {
                    const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                    let chunks = Buffer.from([]);
                    for await (const chunk of stream) { chunks = Buffer.concat([chunks, chunk]); }
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

            case 'ban':
                const groupMetadata = await conn.groupMetadata(from);
                const groupAdmins = groupMetadata.participants.filter(v => v.admin !== null).map(v => v.id);
                const isBotAdmin = groupAdmins.includes(conn.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = groupAdmins.includes(msg.key.participant);

                if (!isGroup || !isSenderAdmin || !isBotAdmin) return;
                
                // Pega quem foi marcado ou quem a mensagem respondeu
                const victim = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
                
                if (!victim) return conn.sendMessage(from, { text: "Marca alguém ou responde à mensagem dele para banir." });
                await conn.groupParticipantsUpdate(from, [victim], 'remove');
                conn.sendMessage(from, { text: "👢 Membro expulso." });
                break;
        }
    });

    conn.ev.on('connection.update', (update) => {
        if (update.connection === 'open') console.log("✅ JACKSON AI SUPREME ONLINE!");
        if (update.connection === 'close') startBot();
    });
}

startBot();
