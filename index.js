const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; text-align:center; background:#111; color:white; padding-top:50px;">
            <h1>Link Jackson Beatz</h1>
            <p>Digite o número para receber a NOTIFICAÇÃO</p>
            <form action="/getcode" method="POST">
                <input type="text" name="number" placeholder="25884..." required style="padding:15px; border-radius:10px; width:70%;">
                <br><br>
                <button type="submit" style="padding:15px 30px; background:#25d366; color:white; border:none; border-radius:10px; font-weight:bold;">SOLICITAR NOTIFICAÇÃO</button>
            </form>
        </body>
    `);
});

async function startBot(numberToPair, res) {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        // ESTA LINHA É O SEGREDO: Simular Android para forçar a notificação
        browser: ["Android", "Chrome", "20.0.04"],
        syncFullHistory: false,
        connectTimeoutMs: 120000,
        defaultQueryTimeoutMs: 0
    });

    if (!sock.authState.creds.registered && numberToPair) {
        // Espera 10 segundos para o servidor do Render estabilizar o IP
        await delay(10000); 
        try {
            const code = await sock.requestPairingCode(numberToPair);
            res.send(`
                <body style="font-family:sans-serif; text-align:center; background:#111; color:white; padding-top:50px;">
                    <h1>CÓDIGO: <span style="color:#25d366;">${code}</span></h1>
                    <p>A NOTIFICAÇÃO ACABOU DE CHEGAR!</p>
                    <p>Clique nela e cole o código acima.</p>
                    <p>Mantenha esta página aberta até conectar.</p>
                </body>
            `);
        } catch (e) { res.send("O WhatsApp bloqueou o pedido. Tente novamente em 2 minutos."); }
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('✅ BOT JACKSON BEATZ ONLINE!');
        if (u.connection === 'close') startBot();
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        if (msg.message.conversation === '!ping') {
            await sock.sendMessage(msg.key.remoteJid, { text: 'Estou online e rápido! 🚀' });
        }
    });
}

app.post('/getcode', (req, res) => {
    const num = req.body.number.replace(/\D/g, '');
    startBot(num, res);
});

app.listen(port, () => console.log(`Rodando na porta ${port}`));
startBot();
