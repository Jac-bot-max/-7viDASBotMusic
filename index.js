const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, downloadContentFromMessage } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const http = require("http");
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// Servidor para manter o Render ligado
http.createServer((req, res) => res.end('Jackson AI Titanium Online')).listen(process.env.PORT || 3000);

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
        browser: ["Jackson AI", "Chrome", "1.0.0"]
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "";
        const prefix = ".";
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return;

        // --- DADOS DE SEGURANÇA ---
        const groupMetadata = await conn.groupMetadata(from);
        const participants = groupMetadata.participants;
        const groupAdmins = participants.filter(v => v.admin !== null).map(v => v.id);
        const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        const isBotAdmin = groupAdmins.includes(botNumber);
        const isSenderAdmin = groupAdmins.includes(msg.key.participant);

        // --- 🚨 MODERAÇÃO AUTOMÁTICA (SÓ PARA NÃO-ADMINS) 🚨 ---
        if (isBotAdmin && !isSenderAdmin) {
            // Apaga links
            if (body.includes('chat.whatsapp.com') || body.includes('http')) {
                return await conn.sendMessage(from, { delete: msg.key });
            }
        }

        // --- COMANDOS ---
        if (!body.startsWith(prefix)) return;
        const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        // Pegar o alvo (quem foi marcado ou respondido)
        const getTarget = () => {
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) return msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            if (msg.message.extendedTextMessage?.contextInfo?.participant) return msg.message.extendedTextMessage.contextInfo.participant;
            return null;
        };

        switch (command) {
            case 'menu':
                const menu = `┏━━━━━『 *JACKSON AI* 』━━━━━┓\n┃\n┃ 🛠️ .marcar | .ban\n┃ 🛠️ .promover | .rebaixar\n┃ 🛠️ .infogrupo | .del\n┃ ✨ .s (figurinha)\n┃\n┗━━━━━━━━━━━━━━━━━━━━━┛`;
                await conn.sendMessage(from, { text: menu });
                break;

            case 'infogrupo':
                const info = `🏠 *DADOS DO GRUPO*\n\n*Nome:* ${groupMetadata.subject}\n*Membros:* ${participants.length}\n*Admins:* ${groupAdmins.length}`;
                await conn.sendMessage(from, { text: info });
                break;

            case 'marcar':
                if (!isSenderAdmin) return;
                let texto = `📢 *AVISO GERAL*\n\n${args.join(" ") || "Olá família!"}\n\n`;
                for (let p of participants) { texto += `@${p.id.split('@')[0]} `; }
                await conn.sendMessage(from, { text: texto, mentions: participants.map(a => a.id) });
                break;

            case 'ban':
                if (!isBotAdmin || !isSenderAdmin) return conn.sendMessage(from, {text: "Erro: Verifique se eu e você somos ADMS!"});
                const tBan = getTarget();
                if (!tBan) return conn.sendMessage(from, {text: "Responda ou marque alguém!"});
                await conn.groupParticipantsUpdate(from, [tBan], 'remove');
                await conn.sendMessage(from, { text: "👢 Removido." });
                break;

            case 'promover':
                if (!isBotAdmin || !isSenderAdmin) return;
                const tPro = getTarget();
                await conn.groupParticipantsUpdate(from, [tPro], 'promote');
                await conn.sendMessage(from, { text: "🆙 Promovido!" });
                break;

            case 'rebaixar':
                if (!isBotAdmin || !isSenderAdmin) return;
                const tDem = getTarget();
                await conn.groupParticipantsUpdate(from, [tDem], 'demote');
                await conn.sendMessage(from, { text: "⚠️ Rebaixado!" });
                break;

            case 'del':
                if (!isBotAdmin || !isSenderAdmin) return;
                if (!msg.message.extendedTextMessage?.contextInfo?.stanzaId) return;
                await conn.sendMessage(from, { 
                    delete: { 
                        remoteJid: from, 
                        fromMe: false, 
                        id: msg.message.extendedTextMessage.contextInfo.stanzaId, 
                        participant: msg.message.extendedTextMessage.contextInfo.participant 
                    } 
                });
                break;

            case 's':
            case 'sticker':
                if (type === 'imageMessage') {
                    const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                    const sticker = new Sticker(buffer, { pack: 'Jackson AI', author: 'Bot', type: StickerTypes.FULL, quality: 70 });
                    await conn.sendMessage(from, await sticker.toMessage());
                }
                break;
        }
    });

    conn.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log("✅ TITANIUM V15 ONLINE!");
        if (u.connection === 'close') startBot();
    });
}

startBot();