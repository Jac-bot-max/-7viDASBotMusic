const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();
const port = process.env.PORT || 10000;

// INTERFACE WEB - A página que você abre pelo link do Render
app.get("/", (req, res) => {
    res.send(`
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { background: #000; color: #fff; font-family: sans-serif; text-align: center; padding: 50px 20px; }
                    input { padding: 15px; width: 100%; max-width: 300px; border-radius: 10px; border: none; font-size: 18px; margin-bottom: 20px; }
                    button { padding: 15px 30px; background: #25D366; border: none; border-radius: 10px; color: black; font-weight: bold; cursor: pointer; font-size: 18px; }
                    #res { color: #ffff00; font-size: 45px; margin-top: 30px; letter-spacing: 5px; }
                </style>
            </head>
            <body>
                <h1 style="color:#25D366;">JACKSON BEATZ V3</h1>
                <p>Digite seu número com DDI (Ex: 244923000000)</p>
                <input type="number" id="num" placeholder="Número com DDI">
                <br>
                <button onclick="gerar()">RECEBER NOTIFICAÇÃO</button>
                <h1 id="res"></h1>
                <p id="st" style="color:#888;"></p>
                <script>
                    function gerar() {
                        const n = document.getElementById('num').value;
                        if(!n) return alert('Digite o número!');
                        document.getElementById('st').innerText = 'Solicitando notificação ao WhatsApp...';
                        fetch('/pairing?nh=' + n).then(r => r.json()).then(d => {
                            document.getElementById('res').innerText = d.code || 'Erro';
                            document.getElementById('st').innerText = d.code ? 'NOTIFICAÇÃO ENVIADA! Verifique seu celular.' : 'Erro ao gerar.';
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // BLINDAGEM: Se você já tiver a SESSION_DATA, ele loga direto
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            state.creds = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
            console.log("✅ SESSÃO CARREGADA DA SESSION_DATA!");
        } catch (e) {}
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // ESTA LINHA É A QUE FAZ A NOTIFICAÇÃO CHEGAR (Simula Chrome no Linux)
        browser: ["Chrome (Linux)", "Chrome (Linux)", "1.0.0"],
        printQRInTerminal: false
    });

    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            let code = await sock.requestPairingCode(nh);
            res.json({ code });
        } catch { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        if (u.connection === "close") startBot();
        if (u.connection === "open") {
            console.log("\n🚀 BOT CONECTADO!");
            // GERA O BLOCO GIGANTE PARA VOCÊ COPIAR (Igual ao seu print)
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE O BLOCO ABAIXO E SALVE NA SESSION_DATA ---\n");
            console.log(sessionStr);
            console.log("\n----------------------------------------------------\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        if (m.message.conversation === "!ping") {
            await sock.sendMessage(m.key.remoteJid, { text: "🏓 Pong! V3 está ativa." });
        }
    });
}

app.listen(port);
startBot();
