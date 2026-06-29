 const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const yts = require('yt-search');
const app = express();

// Mantém o bot vivo
app.get('/', (req, res) => res.send('Bot Jackson Beatz está Vivo! 🚀'));
app.listen(process.env.PORT || 3000, () => console.log('Servidor Web Ativo'));

const dicas = [
    "🎧 *Dica:* Use compressão paralela no seu Kick para dar peso!",
    "🎹 *Dica:* Varie a 'velocity' das notas no piano para soar real.",
    "🎙️ *Dica:* Ajuste os volumes antes de colocar plugins.",
    "🔥 *Dica:* Use Saturação suave para dar brilho à voz."
];

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false,
        // Configurações para o Render não desconectar
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect, qr } = u;
        
        // Se precisar de novo código, ele avisa nos Logs
        if (qr) console.log("⚠️ A SESSÃO EXPIROU. REFAÇA O PAREAMENTO NO NAVEGADOR!");

        if (connection === 'open') {
            console.log('✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅');
            console.log('✅ JACKSON BEATZ BOT ESTÁ ONLINE!');
            console.log('✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const chat = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        console.log("Recebi: " + texto);

        if (texto === '!menu') {
            await sock.sendMessage(chat, { text: "🤖 *BOT JACKSON BEATZ*\n\n!foto [nome] - Capa de música\n!dica - Dica de Produção\n!ping - Status" });
        }

        if (texto === '!dica') {
            const d = dicas[Math.floor(Math.random() * dicas.length)];
            await sock.sendMessage(chat, { text: `🔥 *DICA:* ${d}` });
        }

        if (texto === '!ping') {
            await sock.sendMessage(chat, { text: "🏓 *Pong!* Estou ativo na nuvem!" });
        }

        if (texto.startsWith('!foto')) {
            const busca = texto.replace('!foto', '').trim();
            if (!busca) return sock.sendMessage(chat, { text: 'Diga o nome da música!' });
            const r = await yts(busca);
            const vid = r.videos[0];
            if (vid) {
                await sock.sendMessage(chat, { image: { url: vid.thumbnail }, caption: `🎬 *${vid.title}*\n⏱️ ${vid.timestamp}` });
            }
        }
    });
}
startBot();
