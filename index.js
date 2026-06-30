const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();
const port = process.env.PORT || 10000;

// INTERFACE PARA GERAR O CÓDIGO
app.get("/", (req, res) => {
    res.send(`
        <html>
            <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="background:#000; color:#fff; text-align:center; padding-top:50px; font-family:sans-serif;">
                <h1 style="color:#00ff00;">JACKSON BEATZ - LOGIN</h1>
                <p>Digite seu número com DDI (Ex: 258848786486):</p>
                <input type="number" id="num" placeholder="258xxxxxxxx" style="padding:15px; border-radius:10px; width:280px; font-size:18px;">
                <br><br>
                <button onclick="gerar()" style="padding:15px 30px; background:#00ff00; font-weight:bold; cursor:pointer; border-radius:10px;">GERAR CÓDIGO</button>
                <h1 id="res" style="color:#ffff00; font-size:45px; margin-top:30px;"></h1>
                <script>
                    function gerar() {
                        const n = document.getElementById('num').value;
                        if(!n) return alert('Digite o número!');
                        fetch('/pairing?nh=' + n).then(r => r.json()).then(d => {
                            document.getElementById('res').innerText = d.code || 'Erro';
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    // Se você já tiver a SESSION_DATA no Render, ele loga sozinho
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            state.creds = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
        } catch (e) {}
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // ESTE NAVEGADOR FAZ A NOTIFICAÇÃO PULAR NO CELULAR:
        browser: ["Mac OS", "Safari", "15.0"],
        printQRInTerminal: false
    });

    // Rota que o site usa para pedir o código
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        const { connection } = u;
        if (connection === "close") startBot();
        if (connection === "open") {
            console.log("\n🚀 CONECTADO COM SUCESSO!");
            // GERA A KEY PARA VOCÊ COLAR NO RENDER (SESSION_DATA)
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE O TEXTO ABAIXO PARA O RENDER ---\n");
            console.log(sessionStr);
            console.log("\n------------------------------------------\n");
        }
    });

    // COMANDO DE PING
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";

        if (body === "!ping") {
            await sock.sendMessage(from, { text: "🏓 Pong! O bot está ativo." });
        }
    });
}

app.listen(port);
startBot();
