const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, jidNormalizedUser, downloadContentFromMessage } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const http = require("http");
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// Servidor Keep-Alive
http.createServer((req, res) => res.end('Jackson AI Ultra V16')).listen(process.env.PORT || 3000);

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
        browser: ["Jackson AI", "Chrome", "1.0.0"],
        syncFullHistory: false
    });

    conn.ev.on('creds.update', saveCreds);

    // --- EVENTO DE MENSAGENS ---
    conn.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const isGroup = from.endsWith('@g.us');
        if (!isGroup) return;

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "";
        const prefix = ".";
        
        // --- DADOS DE AUTORIDADE ---
        const groupMetadata = await conn.groupMetadata(from);
        const participants = groupMetadata.participants;
        const groupAdmins = participants.filter(v => v.admin !== null).map(v => v.id);
        const botId = jidNormalizedUser(conn.user.id);
        const isBotAdmin = groupAdmins.includes(botId);
        const isSenderAdmin = groupAdmins.includes(msg.key.participant);

        // --- ANTI-LINK (PROTEÇÃO ATIVA) ---
        if (isBotAdmin && !isSenderAdmin) {
            if (body.includes('chat.whatsapp.com') || body.includes('http')) {
                await conn.sendMessage(from, { delete: msg.key });
                return;
            }
        }

        // --- REAÇÃO A ÁUDIO ---
        if (type === 'audioMessage') {
            await conn.sendMessage(from, { react: { text: "🎧", key: msg.key } });
            return conn.sendMessage(from, { text: '🎵 *Analista Jackson AI:* Obra de arte recebida. Aguardando análise da engenharia sonora...', quoted: msg });
        }

        if (!body.startsWith(prefix)) return;
        const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        // --- AJUDANTE DE ALVO (REPLY OU MENTION) ---
        const quoted = msg.message.extendedTextMessage?.contextInfo;
        const target = quoted?.mentionedJid?.[0] || quoted?.participant || (args[0] ? args[0].replace('@', '') + '@s.whatsapp.net' : null);

        // --- COMANDOS ---
        switch (command) {
            case 'menu':
                const menuTxt = `┏━━━━『 *JACKSON AI V16* 』━━━━┓\n┃\n┃ 🛠️ .marcar | .ban\n┃ 🛠️ .promover | .rebaixar\n┃ 🛠️ .infogrupo | .del\n┃ ✨ .s (Sticker)\n┃\n┗━━━━━━━━━━━━━━━━━━━━━┛`;
                await conn.sendMessage(from, { text: menuTxt });
                break;

            case 'marcar':
                if (!isSenderAdmin) return;
                let texto = `📢 *AVISO GERAL*\n\n${args.join(" ") || "Olá família!"}\n\n`;
                participants.forEach(p => texto += `@${p.id.split('@')[0]} `);
                await conn.sendMessage(from, { text: texto, mentions: participants.map(a => a.id) });
                break;

            case 'ban':
                if (!isBotAdmin || !isSenderAdmin) return;
                if (!target) return conn.sendMessage(from, { text: "Marca ou responde a alguém!" });
                await conn.groupParticipantsUpdate(from, [target], 'remove');
                await conn.sendMessage(from, { text: "👢 Alvo removido com sucesso." });
                break;

            case 'promover':
                if (!isBotAdmin || !isSenderAdmin) return;
                if (!target) return;
                await conn.groupParticipantsUpdate(from, [target], 'promote');
                await conn.sendMessage(from, { text: "🆙 Agora é Administrador!" });
                break;

            case 'rebaixar':
                if (!isBotAdmin || !isSenderAdmin) return;
                if (!target) return;
                await conn.groupParticipantsUpdate(from, [target], 'demote');
                await conn.sendMessage(from, { text: "⚠️ Rebaixado a membro comum." });
                break;

            case 'del':
                if (!isBotAdmin || !isSenderAdmin) return;
                if (!quoted?.stanzaId) return;
                await conn.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: quoted.stanzaId, participant: quoted.participant } });
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

    conn.ev.on('group-participants.update', async (anu) => {
        if (anu.action == 'add') {
            for (let num of anu.participants) {
                await conn.sendMessage(anu.id, { text: `👋 Olá @${num.split('@')[0]}! Bem-vindo(a). Digite *.menu* para começar.`, mentions: [num] });
            }
        }
    });

    conn.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log("✅ V16 SUPREME ONLINE!");
        if (u.connection === 'close') startBot();
    });
}

startBot();