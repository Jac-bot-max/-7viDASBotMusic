 const { default: makeWASocket, useMultiFileAuthState, Browsers, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// PÁGINA PARA VOCÊ PEDIR O CÓDIGO NO SEU TELEMÓVEL
app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
            <h2>Jackson Beatz - Pareamento</h2>
            <p>Digite seu número com DDI (Ex: 258848786486)</p>
            <form action="/getcode" method="POST">
                <input type="text" name="number" placeholder="258..." required style="padding:10px; border-radius:5px;">
                <button type="submit" style="padding:10px; background:green; color:white; border:none; border-radius:5px;">Gerar Código</button>
            </form>
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
                <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
                    <h2>SEU CÓDIGO É: <span style="color:red;">${code}</span></h2>
                    <p>1. Copie o código acima.</p>
                    <p>2. Vá no seu WhatsApp (Aparelhos Conectados).</p>
                    <p>3. Conectar com número de telefone e COLE.</p>
                    <button onclick="location.href='/'">Voltar</button>
                </body>
            `);
        } catch (e) { res.send("Erro ao gerar. Tente de novo em 1 minuto."); }
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log('✅ BOT ONLINE!');
    });
}

app.post('/getcode', (req, res) => {
    const num = req.body.number.replace(/\D/g, '');
    startBot(num, res);
});

app.listen(port, () => console.log(`Site rodando em: http://localhost:${port}`));
startBot(); // Inicia o bot vazio apenas para monitorar
