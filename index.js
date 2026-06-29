 const { default: makeWASocket, useMultiFileAuthState, Browsers, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const app = express();

// Servidor para o Render não desligar o bot
app.get('/', (req, res) => res.send('Bot Jackson Beatz Online'));
app.listen(process.env.PORT || 3000, () => console.log("--- SERVIDOR WEB ATIVO ---"));

async function start() {
    console.log("--- INICIANDO CONEXÃO ---");
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'info' }), // Ativamos logs para ver o erro
        browser: Browsers.macOS('Desktop')
    });

    if (!sock.authState.creds.registered) {
        const meuNumero = "258848786486"; 
        console.log("SOLICITANDO CÓDIGO PARA: " + meuNumero);
        await delay(10000);
        try {
            const code = await sock.requestPairingCode(meuNumero);
            console.log("================================");
            console.log("👉 SEU CÓDIGO É: " + code);
            console.log("================================");
        } catch (e) { console.log("Erro ao pedir código: " + e); }
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'open') console.log("✅ BOT CONECTADO!");
        if (u.connection === 'close') start();
    });
}
start();
