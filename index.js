const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage, jidDecode } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const http = require("http");
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// Servidor de Monitoramento
http.createServer((req, res) => res.end('Jackson AI Supreme V14 Online')).listen(process.env.PORT || 3000);

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
        browser: ["Jackson AI Supreme", "Safari", "1.0.0"]
    });

    conn.ev.on('creds.update', saveCreds);

    // --- 🏠 SISTEMA DE BOAS-VINDAS ---
    conn.ev.on('group-participants.update', async (anu) => {
        if (anu.action == 'add') {
            const metadata = await conn.groupMetadata(anu.id);
            for (let num of anu.participants) {
                let welcome = `┏━━━━━━━  『 *BEM-VINDO* 』 ━━━━━━━┓\n┃\n┃ 👋 Olá @${num.split('@')[0]}\n┃ ✨ Grupo: *${metadata.subject}*\n┃\n┃ 🤖 Sou a *JACKSON AI*\n┃ 💡 Digite *.menu*\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                await conn.sendMessage(anu.id, { text: welcome, mentions: [num] });
            }
        }
    });

    conn.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const body = (type === 'conversation') ? msg.message.conversation : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : (type === 'imageMessage') ? msg.message.imageMessage.caption : "";
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

        // --- 🚨 MODERAÇÃO AUTOMÁTICA (LINKS E STATUS) 🚨 ---
        if (isBotAdmin && !isSenderAdmin) {
            const linkKeywords = ['chat.whatsapp.com', 'whatsapp.com/channel', '/status/', 'instagram.com', 'facebook.com'];
            if (linkKeywords.some(keyword => body.toLowerCase().includes(keyword))) {
                await conn.sendMessage(from, { delete: msg.key });
                return conn.sendMessage(from, { text: "❌ *SEGURANÇA:* Links ou Menções externas não são permitidos aqui!" });
            }
        }

        // --- REAÇÃO A ÁUDIO ---
        if (type === 'audioMessage') {
            await conn.sendMessage(from, { react: { text: "🎧", key: msg.key } });
            return conn.sendMessage(from, { text: '🎵 *Jackson AI System:* Obra recebida! Analisando...', quoted: msg });
        }

        if (!body.startsWith(prefix)) return;
        const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        // Funções de Ajuda para pegar o alvo (mention ou reply)
        const getTarget = () => {
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) return msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            if (msg.message.extendedTextMessage?.contextInfo?.participant) return msg.message.extendedTextMessage.contextInfo.participant;
            return args[0] ? args[0].replace('@', '') + '@s.whatsapp.net' : null;
        };

        // --- COMANDOS ---
        switch (command) {
            case 'menu':
                const menuSupremo = `
┏━━━━━━━  『 *JACKSON AI* 』 ━━━━━━━┓
┃
┃  🚀 *ESTADO:* ONLINE 24H
┃  👑 *MODO:* SUPREME V14
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *MODERAÇÃO REAL* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🛠️ .promover (Dar Admin)
┃ 🛠️ .rebaixar (Tirar Admin)
┃ 🛠️ .ban (Expulsar)
┃ 🛠️ .del (Apagar Mensagem)
┃ 🛠️ .marcar (Chamar Todos)
┃ 🛠️ .infogrupo | .infoadm
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃  『 *OUTROS* 』
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ ✨ .s (Foto p/ Figurinha)
┃ 🧠 .ia (Inteligência)
┃ 🎵 .criar (Música - Simulação)
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                await conn.sendMessage(from, { text: menuSupremo });
                break;

            case 'promover':
                if (!isBotAdmin || !isSenderAdmin) return conn.sendMessage(from, { text: "Preciso ser ADM e você também!" });
                const tPromote = getTarget();
                if (!tPromote) return;
                await conn.groupParticipantsUpdate(from, [tPromote], 'promote');
                conn.sendMessage(from, { text: "✅ Usuário promovido a Administrador!" });
                break;

            case 'rebaixar':
                if (!isBotAdmin || !isSenderAdmin) return conn.sendMessage(from, { text: "Preciso ser ADM!" });
                const tDemote = getTarget();
                if (!tDemote) return;
                await conn.groupParticipantsUpdate(from, [tDemote], 'demote');
                conn.sendMessage(from, { text: "⚠️ Usuário rebaixado a Membro Comum." });
                break;

            case 'ban':
                if (!isBotAdmin || !isSenderAdmin) return;
                const tBan = getTarget();
                if (!tBan) return;
                await conn.groupParticipantsUpdate(from, [tBan], 'remove');
                conn.sendMessage(from, { text: "👢 Alvo removido com sucesso." });
                break;

            case 'del':
            case 'delete':
                if (!isBotAdmin || !isSenderAdmin) return;
                if (!msg.message.extendedTextMessage?.contextInfo?.stanzaId) return conn.sendMessage(from, { text: "Responda à mensagem que deseja apagar!" });
                const key = {
                    remoteJid: from,
                    fromMe: false,
                    id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: msg.message.extendedTextMessage.contextInfo.participant
                };
                await conn.sendMessage(from, { delete: key });
                break;

            case 'ia':
                if (!args[0]) return;
                conn.sendMessage(from, { text: "🤖 *Pensando:* " + args.join(" ") + "\n\nResposta: Estarei pronto para processar isso na V15!" });
                break;
        }
    });

    conn.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log("✅ V14 ONLINE!");
        if (u.connection === 'close') startBot();
    });
}

startBot();
