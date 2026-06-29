 const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const { Pastebin } = require('pastebin-js'); // Opcional para decodificar
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot Jackson Beatz Online!'));
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));

async function startBot() {
    // O BOT VAI LER A CHAVE QUE VOCÊ VAI COLOCAR NO RENDER
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop')
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') console.log('✅ CONECTADO VIA SESSION_ID!');
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const chat = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        if (texto === '!menu') {
            await sock.sendMessage(chat, { text: "🤖 *BOT JACKSON BEATZ ONLINE 24H*\n\n!dica - Dica de Produção\n!ping - Status" });
        }
        if (texto === '!dica') {
            await sock.sendMessage(chat, { text: "🎹 *Dica:* Use saturação no seu Bass para ele aparecer em colunas pequenas!" });
        }
    });
}
startBot();   
