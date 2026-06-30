const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

// INTERFACE WEB (PARA O CRON-JOB E PARA GERAR O CÓDIGO)
app.get("/", (req, res) => {
    res.send(`
        <html>
            <body style="background:#000; color:#fff; text-align:center; padding-top:50px; font-family:sans-serif;">
                <h1 style="color:#00ff00;">JACKSON BEATZ V3 - NOVO PROJETO</h1>
                <p>1. Digite seu número com DDI (Ex: 244900000000)<br>2. Clique no botão e aguarde a NOTIFICAÇÃO no seu WhatsApp.</p>
                <input type="number" id="num" placeholder="DDI + Número" style="padding:15px; border-radius:10px; width:250px; font-size:18px;">
                <br><br>
                <button onclick="gerar()" style="padding:15px 30px; background:#00ff00; font-weight:bold; cursor:pointer; border-radius:10px;">RECEBER NOTIFICAÇÃO</button>
                <h1 id="res" style="color:#ffff00; font-size:40px; margin-top:30px;"></h1>
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
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // Se você colar a SESSION_DATA no Render depois, o bot já nasce logado
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            state.creds = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
            console.log("✅ SESSION_DATA CARREGADA!");
        } catch (e) {}
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // NAVEGADOR PARA FORÇAR NOTIFICAÇÃO NO CELULAR
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    app.get("/pairing", async (req, res) => {
        try {
            await delay(1500);
            let code = await sock.requestPairingCode(req.query.nh);
            res.json({ code });
        } catch { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        if (u.connection === "close") startBot();
        if (u.connection === "open") {
            console.log("\n🚀 CONECTADO COM SUCESSO!");
            // ESTA É A KEY QUE VOCÊ VAI COPIAR PARA A SESSION_DATA
            const str = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE O TEXTO ABAIXO E SALVE NA SESSION_DATA ---\n" + str + "\n----------------------------\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        if (messages[0].message?.conversation === "!ping") {
            await sock.sendMessage(messages[0].key.remoteJid, { text: "🏓 V3 On no Novo Projeto!" });
        }
    });
}

app.listen(port);
startBot();
