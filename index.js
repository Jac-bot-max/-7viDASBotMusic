const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const express = require("express");
const qrcode = require("qrcode-terminal");

const app = express();
const port = process.env.PORT || 10000;

// 1. CONEXÃO MONGODB (Para advertências)
const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI).then(() => console.log('✅ Banco de Dados Conectado!'));

const User = mongoose.model('User', new mongoose.Schema({ userId: String, groupId: String, warnings: { type: Number, default: 0 } }));

// 2. SERVIDOR WEB (Para Pareamento e Cron-job)
app.get("/", (req, res) => {
    res.send(`
        <html>
            <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
                <h1>Jackson Beatz V3 Online</h1>
                <p>O bot está ativo e sendo vigiado pelo Cron-job.</p>
                <hr>
                <h3>Gerar Código de Pareamento</h3>
                <input type="text" id="number" placeholder="Ex: 244900000000">
                <button onclick="getCode()">Gerar Código</button>
                <h2 id="displayCode" style="color:blue;"></h2>
                <script>
                    function getCode() {
                        const num = document.getElementById('number').value;
                        if(!num) return alert('Digite o número!');
                        document.getElementById('displayCode').innerText = 'Gerando...';
                        fetch('/pairing?nh=' + num)
                            .then(res => res.json())
                            .then(data => {
                                document.getElementById('displayCode').innerText = data.code || 'Erro ao gerar';
                            });
                    }
                </script>
            </body>
        </html>
    `);
});

// Variável global para o Socket
let sock;

async function startJacksonBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Jackson Beatz", "Chrome", "1.0.0"],
    });

    // Rota para o Pareamento Web
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        if (!nh) return res.json({ error: "Número faltando" });
        try {
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) {
            res.json({ error: "Erro no servidor" });
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") startJacksonBot();
        if (connection === "open") console.log("🚀 BOT CONECTADO!");
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (body === "!ping") await sock.sendMessage(from, { text: "🏓 V3 Web Ativa!" });
        
        if (body === "!menu") {
            await sock.sendMessage(from, { text: "🎵 *JACKSON BEATZ V3*\n\n!status\n!drumkit\n!anuncio" });
        }
    });
}

app.listen(port, () => console.log(`Servidor na porta ${port}`));
startJacksonBot();
