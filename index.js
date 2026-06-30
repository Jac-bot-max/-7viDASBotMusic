const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const yts = require('yt-search');
const fs = require('fs');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.get('/', (req, res) => res.send('Bot Jackson Beatz Ativo! 🚀'));
app.listen(process.env.PORT || 3000);

async function startBot(numberToPair, res) {
    if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');

    // TENTA LER A CHAVE QUE SALVASTE NO RENDER
    if (process.env.SESSION_DATA && !fs.existsSync('./session_data/creds.json')) {
        try {
            const decoded = Buffer.from(process.env.SESSION_DATA, 'base64').toString();
            fs.writeFileSync('./session_data/creds.json', decoded);
            console.log("✅ LOGIN RECUPERADO!");
        } catch (e) { console.log("❌ Erro na SESSION_DATA"); }
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Android", "Chrome", "20.0.04"],
        // --- ESSAS LINHAS ABAIXO EVITAM O ERRO 428 ---
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 120000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        const creds = fs.readFileSync('./session_data/creds.json');
        console.log("\n--- COPIE O NOVO BLOCO SE PRECISAR ---\n" + Buffer.from(creds).toString('base64') + "\n-----------------------------------\n");
    });

    if (!sock.authState.creds.registered && numberToPair) {
        await delay(5000);
        try {
            const code = await sock.requestPairingCode(numberToPair);
            res.send(`<h1>CÓDIGO: ${code}</h1>`);
        } catch (e) { res.send("Erro ao gerar. Tente de novo."); }
    }

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') console.log('✅ BOT ONLINE E ESTÁVEL!');
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Reiniciando por queda de sinal...");
                setTimeout(() => startBot(), 5000);
            }
        }
    });

    // COMANDOS BÁSICOS
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        if (texto === '!ping') await sock.sendMessage(msg.key.remoteJid, { text: "Estou vivo! 🚀" });
    });
}

app.post('/getcode', (req, res) => {
    startBot(req.body.number.replace(/\D/g, ''), res);
});

startBot();
