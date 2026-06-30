const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, delay } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

// INTERFACE PARA O SITE
app.get("/", (req, res) => {
    res.send(`
        <html>
            <body style="background:#000; color:#fff; text-align:center; padding-top:50px; font-family:sans-serif;">
                <h1>Jackson Beatz V3</h1>
                <p>O bot está pronto para o Cron-job.</p>
                <input type="text" id="n" placeholder="Seu número (Ex: 244900000000)" style="padding:10px;">
                <button onclick="g()" style="padding:10px; cursor:pointer;">GERAR CÓDIGO</button>
                <h1 id="c" style="color:yellow; font-size:50px;"></h1>
                <p id="status"></p>
                <script>
                    function g() {
                        const num = document.getElementById('n').value;
                        document.getElementById('status').innerText = 'Solicitando código...';
                        fetch('/pairing?nh=' + num).then(r => r.json()).then(d => {
                            document.getElementById('c').innerText = d.code || 'Erro';
                            document.getElementById('status').innerText = d.code ? 'CÓDIGO GERADO!' : 'Erro';
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

async function startBot() {
    // 1. Inicia o estado do zero (limpo)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Jackson Beatz V3", "Chrome", "1.0.0"]
    });

    // Rota do site
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            let code = await sock.requestPairingCode(nh);
            res.json({ code });
        } catch { res.json({ code: "Erro" }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "close") {
            // Só reinicia se não for erro de logoff
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("\n🚀 CONECTADO COM SUCESSO!");
            
            // --- ESTA É A KEY QUE VOCÊ VAI COPIAR ---
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n================ SESSION_DATA (COPIE TUDO) ================\n");
            console.log(sessionStr);
            console.log("\n===========================================================\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        if (m.message.conversation === "!ping") {
            await sock.sendMessage(m.key.remoteJid, { text: "🏓 V3 Respondendo!" });
        }
    });
}

app.listen(port);
startBot();
