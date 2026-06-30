const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

// 1. SERVIDOR PARA "CUTUCAR" E GERAR O CÓDIGO
app.get("/", (req, res) => {
    res.send(`
        <html>
            <body style="background:#000; color:#fff; text-align:center; padding-top:50px; font-family:sans-serif;">
                <h1>Jackson Beatz V3</h1>
                <p>O bot está sendo cutucado pelo Cron-job.</p>
                <input type="text" id="n" placeholder="Seu número (Ex: 244900000000)" style="padding:10px;">
                <button onclick="g()" style="padding:10px; cursor:pointer;">GERAR CÓDIGO</button>
                <h1 id="c" style="color:yellow; font-size:50px;"></h1>
                <script>
                    function g() {
                        const num = document.getElementById('n').value;
                        fetch('/pairing?nh=' + num).then(r => r.json()).then(d => {
                            document.getElementById('c').innerText = d.code || 'Erro';
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // BLINDAGEM: Se você já tiver colado a SESSION_DATA no Render, o bot entra direto por aqui
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            state.creds = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
            console.log("✅ SESSÃO CARREGADA DA SESSION_DATA!");
        } catch (e) { console.log("Erro ao carregar SESSION_DATA"); }
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Jackson Beatz V3", "Chrome", "1.0.0"]
    });

    // Rota para o botão do site gerar o código
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            let code = await sock.requestPairingCode(nh);
            res.json({ code });
        } catch { res.json({ code: "Erro" }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        if (u.connection === "close") startBot();
        if (u.connection === "open") {
            console.log("\n🚀 CONECTADO COM SUCESSO!");
            
            // AQUI GERA O TEXTO QUE VOCÊ VAI COLAR NO RENDER
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE O TEXTO ABAIXO E COLE NA SESSION_DATA NO RENDER ---\n");
            console.log(sessionStr);
            console.log("\n----------------------------------------------------------\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        if (m.message.conversation === "!ping") {
            await sock.sendMessage(m.key.remoteJid, { text: "🏓 Pong! V3 Online." });
        }
    });
}

app.listen(port);
startBot();
