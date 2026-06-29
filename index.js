const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// PÁGINA QUE VOCÊ VIU (AGORA COM CAMPO DE NÚMERO)
app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; text-align:center; padding-top:50px; background-color:#111; color:white;">
            <h1>🤖 Jackson Beatz Bot</h1>
            <p>Digite seu número para gerar o código de 8 letras</p>
            <form action="/getcode" method="POST">
                <input type="text" name="number" placeholder="258848786486" required 
                style="padding:15px; border-radius:10px; width:280px; border:none;">
                <br><br>
                <button type="submit" style="padding:15px 30px; background:#25d366; color:white; border:none; border-radius:10px; font-weight:bold; cursor:pointer;">GERAR CÓDIGO</button>
            </form>
            <p style="font-size:12px; color:#888;">Certifique-se de que o bot está Live no Render.</p>
        </body>
    `);
});

async function startBot(numberToPair, res) {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome")
    });

    if (!sock.authState.creds.registered && numberToPair) {
        await delay(5000);
        try {
            const code = await sock.requestPairingCode(numberToPair);
            res.send(`
                <body style="font-family:sans-serif; text-align:center; padding-top:50px; background-color:#111; color:white;">
                    <h1>TEU CÓDIGO: <span style="color:#25d366;">${code}</span></h1>
                    <p>1. Copie o código acima.</p>
                    <p>2. Clique na notificação que vai chegar.</p>
                    <p>3. Cole o código no WhatsApp.</p>
                    <br>
                    <button onclick="location.href='/'" style="background:#444; color:white; padding:10px; border:none; border-radius:5px;">Voltar</button>
                </body>
            `);
        } catch (e) { res.send("Erro ao gerar. Tente de novo."); }
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('✅ BOT ONLINE!');
        if (u.connection === 'close') startBot();
    });
}

app.post('/getcode', (req, res) => {
    const num = req.body.number.replace(/\D/g, '');
    startBot(num, res);
});

app.listen(port, () => console.log(`Servidor na porta ${port}`));
startBot();
