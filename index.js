const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();
const port = process.env.PORT || 10000;

// Interface simples para digitar o número
app.get("/", (req, res) => {
    res.send(`
        <html>
            <body style="font-family:sans-serif; text-align:center; background:#111; color:white; padding:50px;">
                <h2>Jackson Beatz - Conexão V3</h2>
                <input type="text" id="num" placeholder="DDI + Número (Ex: 244900...)" style="padding:10px; width:250px;">
                <button onclick="gerar()" style="padding:10px; cursor:pointer;">GERAR CÓDIGO</button>
                <h1 id="code" style="color:yellow; font-size:50px;"></h1>
                <script>
                    function gerar() {
                        const n = document.getElementById('num').value;
                        fetch('/pairing?nh=' + n).then(r => r.json()).then(d => {
                            document.getElementById('code').innerText = d.code || 'Erro';
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

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
        if (u.connection === "open") console.log("✅ LOGADO COM SUCESSO!");
    });
}

app.listen(port);
startBot();
