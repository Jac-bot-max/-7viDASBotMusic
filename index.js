const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const http = require("http");
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// Monitor de sobrevivência Render
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
        browser: ["Jackson AI Pro", "MacOS", "3.0.0"],
        syncFullHistory: false
    });

    conn.ev.on('creds.update', saveCreds);

    // --- 🏠 SISTEMA DE BOAS-VINDAS ---
    conn.ev.on('group-participants.update', async (anu) => {
        try {
            if (anu.action == 'add') {
                const metadata = await conn.groupMetadata(anu.id);
                for (let num of anu.participants) {
                    let welcomeMsg = `┏━━━━━━━  『 *BEM-VINDO(A)* 』 ━━━━━━━┓\n┃\n┃ 👋 Olá @${num.split('@')[0]}\n┃ ✨ Bem-vindo(a) ao grupo: \n┃ *${metadata.subject}*\n┃\n┃ 🤖 Sou a *JACKSON AI*, sua moderadora.\n┃ 📜 Por favor, respeite as regras do grupo.\n┃ 💡 Digite *.menu* para conhecer minhas funções.\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                    
                    await conn.sendMessage(anu.id, { 
                        text: welcomeMsg, 
                        mentions: [num] 
                    });
                }
            }
        } catch (err) {
            console.log("Erro no Boas-Vindas: ", err);
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

        // --- INFO DE GRUPO ---
        const groupMetadata = isGroup ? await conn.groupMetadata(from) : null;
        const participants = isGroup ? groupMetadata.participants : [];
        const groupAdmins = isGroup ? participants.filter(v => v.admin !== null).map(v => v.id) : [];
        const isBotAdmin = isGroup ? groupAdmins.includes(conn.user.id.split(':')[0] + '@s.whatsapp.net') : false;
        const isSenderAdmin = isGroup ? groupAdmins.includes(msg.key.participant) : false;

        // --- 🚨 MODERAÇÃO AUTOMÁTICA 🚨 ---
        if (isGroup && isBotAdmin && !isSenderAdmin) {
            // Detectar Links e Menções Externas
            if (body.includes('chat.whatsapp.com') || body.includes('whatsapp.com/channel') || body.includes('/status/')) {
                await conn.sendMessage(from, { delete: msg.key });
                return conn.sendMessage(from, { text: "❌ *SEGURANÇA:* Links e Status não são permitidos. Removido." });
            }
            // Detectar menção abusiva ao ID do grupo
            if (body.includes('@' + from.split('@')[0])) {
                await conn.sendMessage(from, { delete: msg.key });
            }
        }

        // --- REAÇÃO A ÁUDIO ---
        if (type === 'audioMessage') {
            await conn.sendMessage(from, { react: { text: "🎧", key: msg.key } });
            return conn.sendMessage(from, { text: '🎵 *Jackson AI Audio System* \n\nObrigado por compartilhar! Um dos nossos engenheiros vai analisar esta obra.', quoted: msg });
        }

        if (!body.startsWith(prefix)) return;
        const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        // --- COMANDOS REAIS ---
        switch (command) {
            case 'menu':
                const menuSupremo = `
┏━━━━━━━  『 *JACKSON AI* 』 ━━━━━━━┓
┃
┃  🚀 *ESTADO:* 24H ONLINE
┃  👑 *ENGINE:* SUPREME NEURAL V12
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *MODERAÇÃO REAL* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🛠️ .marcar (Tag Geral)
┃ 🛠️ .ban (@membro)
┃ 🛠️ .promover (@membro)
┃ 🛠️ .rebaixar (@membro)
┃ 🛠️ .del (Responder msg)
┃ 🛠️ .infogrupo (Scan)
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *CRIATIVIDADE REAL* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ ✨ .s (Foto em Figurinha)
┃ ✨ .sticker (Figurinha Full)
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *SIMULAÇÕES (BEAUTY)* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🎤 .mastervoz | 🎚️ .masterbeat 
┃ ✂️ .separar | 🎵 .criar | 🧠 .ia
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                await conn.sendMessage(from, { text: menuSupremo });
                break;

            case 's':
            case 'sticker':
                if (type === 'imageMessage') {
                    const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                    const sticker = new Sticker(buffer, {
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
                if (!isSenderAdmin) return;
                let aviso = `📢 *AVISO SUPREMO*\n\n${args.join(" ") || "Olá família, compartilhem o grupo!"}\n\n`;
                for (let p of participants) { aviso += `@${p.id.split('@')[0]} `; }
                await conn.sendMessage(from, { text: aviso, mentions: participants.map(a => a.id) });
                break;

            case 'ban':
                if (!isGroup || !isSenderAdmin || !isBotAdmin) return;
                const victim = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                if (!victim) return conn.sendMessage(from, { text: "Marque quem deseja banir." });
                await conn.groupParticipantsUpdate(from, [victim], 'remove');
                conn.sendMessage(from, { text: "👢 Membro expulso." });
                break;
        }
    });

    conn.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') console.log("✅ JACKSON AI SUPREME V12 ONLINE!");
        if (connection === 'close') startBot();
    });
}

startBot();