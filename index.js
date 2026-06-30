const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, jidNormalizedUser } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const mongoose = require("mongoose");
const app = express();

const port = process.env.PORT || 10000;

// 1. CONEXÃO MONGODB (Para advertências V3)
const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI).then(() => console.log('✅ Banco de Dados Conectado!'));

// 2. SERVIDOR WEB (Interface para gerar o código)
app.get("/", (req, res) => {
    res.send(`
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { background: #0e0e0e; color: white; font-family: sans-serif; text-align: center; padding: 50px; }
                    input { padding: 15px; width: 80%; max-width: 300px; border-radius: 10px; border: none; font-size: 18px; }
                    button { padding: 15px 30px; background: #25D366; border: none; border-radius: 10px; color: black; font-weight: bold; cursor: pointer; margin-top: 20px; }
                    #code { color: #ffff00; font-size: 40px; margin-top: 30px; letter-spacing: 5px; }
                </style>
            </head>
            <body>
                <h1>Jackson Beatz V3</h1>
                <p>Digite o número (DDI + Número) para parear:</p>
                <input type="text" id="number" placeholder="Ex: 244900000000">
                <br>
                <button onclick="pedirCodigo()">GERAR CÓDIGO</button>
                <div id="code"></div>
                <p id="status"></p>
                <script>
                    function pedirCodigo() {
                        const num = document.getElementById('number').value;
                        if(!num) return alert('Digite o número!');
                        document.getElementById('status').innerText = 'Enviando notificação...';
                        fetch('/pairing?nh=' + num)
                            .then(res => res.json())
                            .then(data => {
                                document.getElementById('code').innerText = data.code || 'Erro';
                                document.getElementById('status').innerText = data.code ? 'CÓDIGO GERADO! Verifique a notificação.' : 'Erro ao gerar.';
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

    // BLINDAGEM: Se você colar a SESSION_DATA no Render, o bot ignora o login e entra direto
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            const sessData = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
            state.creds = sessData;
            console.log("📥 Sessão recuperada da SESSION_DATA!");
        } catch (e) { console.log("Erro ao ler SESSION_DATA"); }
    }

    sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // Esse navegador força a notificação a chegar no celular
        browser: ["Chrome (Linux)", "Chrome (Linux)", "1.0.0"],
        printQRInTerminal: false,
        syncFullHistory: false
    });

    // Rota para o Botão do Site funcionar
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
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
            console.log("🚀 BOT CONECTADO!");
            // ISSO GERA O TEXTO QUE VOCÊ VAI COLAR NA SESSION_DATA
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE ESSA KEY PARA SESSION_DATA ---\n" + sessionStr + "\n---------------------------------------\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (body === "!ping") await sock.sendMessage(from, { text: "🏓 Pong! V3 Restaurada." });
        
        // Comando para te enviar a Key pelo WhatsApp se você perder
        if (body === "!key") {
            const key = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            await sock.sendMessage(from, { text: `🛡️ *SUA KEY DE SESSÃO:* \n\n${key}` });
        }
    });
}

app.listen(port, () => console.log("Servidor Web Ativo!"));
startJacksonBot();
