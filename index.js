const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const express = require("express");

const app = express();
app.get("/", (req, res) => res.send("Jackson Beatz V3 - Online"));
app.listen(process.env.PORT || 10000);

// Conexão Mongo
const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI).then(() => console.log('✅ MongoDB OK'));

async function startJacksonBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Interface de Pareamento
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        if (!nh) return res.json({ error: "Falta o número" });
        try {
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startJacksonBot();
        if (connection === "open") {
            console.log("🚀 CONECTADO!");
            // Gera a String no Log do Render para você copiar
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE PARA SESSION_DATA ---\n" + sessionStr + "\n----------------------------\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (body === "!ping") await sock.sendMessage(from, { text: "🏓 Pong!" });
        if (body === "!session") {
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            await sock.sendMessage(from, { text: sessionStr });
        }
    });
}

startJacksonBot();
