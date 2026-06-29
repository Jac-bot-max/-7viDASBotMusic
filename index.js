const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// Página para manter o Render acordado e gerar código se precisar
app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; text-align:center; background:#111; color:white; padding-top:50px;">
            <h1>🤖 Jackson Beatz Bot</h1>
            <p>Status: Servidor Ativo</p>
            <form action="/getcode" method="POST">
                <input type="text" name="number" placeholder="25884..." required style="padding:10px; border-radius:5px;">
                <button type="submit" style="padding:10px; background:green; color:white; border:none; border-radius:5px;">Gerar Novo Código</button>
            </form>
        </body>
    `);
});

async function startBot(numberToPair, res) {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Desktop"),
        // --- CONFIGURAÇÕES PARA NÃO TRAVAR O RENDER ---
        syncFullHistory: false,            // Não baixa conversas antigas
        shouldSyncHistoryMessage: () => false, // Bloqueia sincronização pesada
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered && numberToPair) {
        await delay(5000);
        try {
            const code = await sock.requestPairingCode(numberToPair);
            if (res) res.send(`<h2>CÓDIGO: <span style="color:green;">${code}</span></h2><p>Cole no WhatsApp e aguarde.</p>`);
        } catch (e) { if (res) res.send("Erro ao gerar. Tente novamente."); }
    }

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log('✅ BOT JACKSON BEATZ ONLINE E ESTÁVEL!');
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log('Conexão fechada. Razão:', reason);
            // Se o erro for de rede, espera 5 segundos antes de tentar de novo para evitar o loop
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000);
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        
        if (texto === '!ping') {
            await sock.sendMessage(msg.key.remoteJid, { text: '🏓 *Pong!* Bot Jackson Beatz estável na nuvem!' });
        }
    });
}

app.post('/getcode', (req, res) => {
    const num = req.body.number.replace(/\D/g, '');
    startBot(num, res);
});

app.listen(port, () => console.log(`Servidor na porta ${port}`));
startBot();
