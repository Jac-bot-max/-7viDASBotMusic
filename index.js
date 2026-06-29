 const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const app = express();
const { Buffer } = require('buffer');

// Servidor para manter o bot vivo
app.get('/', (req, res) => res.send('Bot Jackson Beatz Online!'));
app.listen(process.env.PORT || 3000);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    // Pega a SESSION_ID das variáveis do Render
    const sessionId = process.env.SESSION_ID;

    if (!sessionId) {
        console.log("❌ ERRO: Você não colocou a SESSION_ID nas variáveis do Render!");
        return;
    }

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop')
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') console.log('✅ BOT CONECTADO COM SUCESSO!');
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        if (msg.message.conversation === '!ping') {
            await sock.sendMessage(msg.key.remoteJid, { text: "🏓 Pong! O bot está na nuvem!" });
        }
    });
}

startBot();
