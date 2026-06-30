const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const mongoose = require("mongoose");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

// 1. CONEXÃO MONGODB
const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI).then(() => console.log('✅ Banco de Dados OK'));

// 2. SERVIDOR WEB PARA PAREAMENTO
app.get("/", (req, res) => {
    res.send(`
        <html>
            <head><title>Jackson Beatz V3</title></head>
            <body style="font-family:sans-serif; text-align:center; background:#111; color:white; padding-top:50px;">
                <h1 style="color:#00ff00;">🎵 Jackson Beatz V3 🎵</h1>
                <p>Digite seu número com DDI para receber a notificação:</p>
                <input type="text" id="number" placeholder="Ex: 244900000000" style="padding:10px; border-radius:5px; border:none;">
                <button onclick="getCode()" style="padding:10px 20px; background:#00ff00; border:none; cursor:pointer; font-weight:bold;">PEDIR CÓDIGO</button>
                <h2 id="displayCode" style="margin-top:20px; color:#ffff00; font-size:30px; letter-spacing:5px;"></h2>
                <p id="status" style="color:#aaa;"></p>
                <script>
                    function getCode() {
                        const num = document.getElementById('number').value;
                        if(!num) return alert('Digite o número!');
                        document.getElementById('status').innerText = 'Conectando ao WhatsApp...';
                        fetch('/pairing?nh=' + num)
                            .then(res => res.json())
                            .then(data => {
                                if(data.code) {
                                    document.getElementById('displayCode').innerText = data.code;
                                    document.getElementById('status').innerText = 'NOTIFICAÇÃO ENVIADA! Verifique seu celular.';
                                } else {
                                    document.getElementById('status').innerText = 'Erro. Tente novamente.';
                                }
                            });
                    }
                </script>
            </body>
        </html>
    `);
});

let sock;
async function startJacksonBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // NOME DO APARELHO QUE APARECE NO WHATSAPP (Importante para a notificação)
        browser: ["JacksonBeatz-V3", "Safari", "1.0.0"],
        printQRInTerminal: false
    });

    // Rota que gera o código e manda a notificação
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh.replace(/[^0-9]/g, '');
        if (!sock.authState.creds.registered) {
            try {
                let code = await sock.requestPairingCode(nh);
                res.json({ code: code });
            } catch (e) {
                res.json({ error: true });
            }
        } else {
            res.json({ code: "JÁ CONECTADO" });
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") startJacksonBot();
        if (connection === "open") {
            console.log("🚀 Jackson Beatz V3: CONECTADO!");
            // MANDA MENSAGEM PARA VOCÊ QUANDO CONECTAR
            sock.sendMessage(sock.user.id, { text: "✅ Jackson Beatz V3 Online!" });
        }
    });

    // COMANDOS V3
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (body === "!ping") await sock.sendMessage(from, { text: "🏓 V3 Web Ativa!" });
        if (body === "!menu") await sock.sendMessage(from, { text: "🎵 *JACKSON BEATZ V3*\n\n🛡️ !status\n🔍 !drumkit\n📢 !anuncio" });
    });
}

app.listen(port, () => console.log(`Site no ar na porta ${port}`));
startJacksonBot();
