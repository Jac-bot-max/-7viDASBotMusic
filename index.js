 const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();

app.get('/', (req, res) => res.send('Bot Jackson Beatz Online 24h!'));
app.listen(process.env.PORT || 3000);

async function startBot() {
    // 1. Criar a pasta da sessão
    if (!fs.existsSync('./auth_session')) {
        fs.mkdirSync('./auth_session');
    }

    // 2. BUSCAR A KEY QUE VOCÊ COLOCOU NO RENDER
    const session_id = process.env.SESSION_ID;

    if (session_id && !fs.existsSync('./auth_session/creds.json')) {
        console.log("--- TENTANDO LOGAR COM A SUA KEY ---");
        try {
            // O bot vai baixar o seu login usando a KEY que você gerou no site
            const { data } = await axios.get(`https://t-ct.org/session?id=${session_id}`);
            fs.writeFileSync('./auth_session/creds.json', JSON.stringify(data));
            console.log("✅ LOGIN RECUPERADO COM SUCESSO!");
        } catch (e) {
            console.log("❌ Erro ao usar a Key. Verifique se a SESSION_ID está certa no Render.");
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop')
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log('✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅');
            console.log('✅ JACKSON BEATZ BOT ESTÁ ONLINE!');
            console.log('✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅');
        }
        if (connection === 'close') {
            const restart = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (restart) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        if (texto === '!ping') await sock.sendMessage(msg.key.remoteJid, { text: "Estou vivo na nuvem! 🚀" });
    });
}

startBot();
