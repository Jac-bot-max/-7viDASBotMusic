const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

// Servidor para o Cron-job e para você ver o código
app.get("/", (req, res) => res.send("Jackson Beatz V3 - Sistema de Pareamento Ativo"));
app.listen(process.env.PORT || 10000);

async function startJacksonBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: true
    });

    // Rota para você pedir o código pelo link do Render
    app.get("/pairing", async (req, res) => {
        let num = req.query.nh;
        try {
            let code = await sock.requestPairingCode(num);
            res.json({ code: code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startJacksonBot();
        if (connection === "open") {
            console.log("🚀 CONECTADO!");
            // ISSO AQUI É O QUE VOCÊ VAI COPIAR:
            console.log("SUA NOVA SESSION_DATA ABAIXO:");
            console.log(JSON.stringify(sock.authState.creds));
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        // Comandos simples para testar
        if (body === "!ping") await sock.sendMessage(from, { text: "🏓 V3 Rodando!" });
        if (body === "!menu") await sock.sendMessage(from, { text: "🎵 *JACKSON BEATZ V3*\n\n!status\n!drumkit" });
    });
}

startJacksonBot();
