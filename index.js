const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Servidor para o Render não desligar o bot
app.get('/', (req, res) => res.send('Bot Jackson Beatz Online!'));
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));

// Dicas de Produção Musical
const dicas = [
    "🎧 *Dica:* Use compressão paralela no seu Kick para dar peso sem perder o impacto.",
    "🎹 *Dica:* No FL Studio, use o 'Strum' (Alt+S) no piano roll para as notas soarem mais reais.",
    "🎙️ *Dica:* Grave a voz com um pouco de distância do microfone para evitar 'pops'.",
    "🎚️ *Dica:* Uma boa mix começa no ajuste de volumes antes de qualquer plugin.",
    "🔥 *Dica:* Use Saturação suave para dar brilho ao som sem distorcer."
];

async function startBot() {
    // Usamos a SESSION_ID que você já colocou no Render
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') console.log('✅ BOT JACKSON BEATZ ONLINE!');
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

        // COMANDOS
        if (texto === '!menu') {
            await sock.sendMessage(chat, { text: "🤖 *BOT JACKSON BEATZ*\n\n!dica - Dica de Produção\n!ping - Testar bot\n!foto - Em breve" });
        }
        if (texto === '!dica') {
            const d = dicas[Math.floor(Math.random() * dicas.length)];
            await sock.sendMessage(chat, { text: `🔥 *DICA:* ${d}` });
        }
        if (texto === '!ping') {
            await sock.sendMessage(chat, { text: "🏓 *Pong!* Estou na nuvem!" });
        }
        // ANTI-LINK
        if (texto.includes("chat.whatsapp.com/")) {
            await sock.sendMessage(chat, { delete: msg.key });
            await sock.sendMessage(chat, { text: "🚫 *Links proibidos!*" });
        }
    });
}
startBot();
