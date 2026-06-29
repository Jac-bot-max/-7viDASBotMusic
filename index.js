 const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; text-align:center; padding-top:50px; background-color:#f0f2f5;">
            <h2>Jackson Beatz - Conexão Direta</h2>
            <p>Digite seu número (Ex: 258848786486)</p>
            <form action="/getcode" method="POST">
                <input type="text" name="number" placeholder="258..." required style="padding:15px; border-radius:10px; border:1px solid #ccc; width:80%;">
                <br><br>
                <button type="submit" style="padding:15px 30px; background:#25d366; color:white; border:none; border-radius:10px; font-weight:bold;">GERAR CÓDIGO AGORA</button>
            </form>
        </body>
    `);
});

async function startBot(numberToPair, res) {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Chrome"),
        // CONFIGURAÇÕES DE VELOCIDADE
        connectTimeoutMs: 120000, 
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        markOnlineOnConnect: true
    });

    if (!sock.authState.creds.registered && numberToPair) {
        await delay(3000); // Espera 3 seg apenas
        try {
            const code = await sock.requestPairingCode(numberToPair);
            res.send(`
                <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
                    <h1 style="font-size:50px;">CÓDIGO: <span style="color:#25d366;">${code}</span></h1>
                    <p style="font-size:20px;">1. COPIE ESTE CÓDIGO.</p>
                    <p style="font-size:20px;">2. CLIQUE NA NOTIFICAÇÃO QUE ACABOU DE CHEGAR.</p>
                    <p style="font-size:20px;">3. COLE E AGUARDE NESSA TELA DO WHATSAPP.</p>
                    <br>
                    <p>Mantenha esta aba do navegador aberta até conectar!</p>
                </body>
            `);
        } catch (e) { res.send("Servidor ocupado. Tente novamente em 30 segundos."); }
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') console.log('✅ BOT JACKSON BEATZ ONLINE!');
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });
}

app.post('/getcode', (req, res) => {
    const num = req.body.number.replace(/\D/g, '');
    startBot(num, res);
});

app.listen(port, () => console.log(`Servidor ativo na porta ${port}`));
