const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

// INTERFACE WEB (PARA O CRON-JOB E PARA GERAR O CÓDIGO)
app.get("/", (req, res) => {
    res.send(`
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { background: #000; color: #fff; font-family: sans-serif; text-align: center; padding-top: 50px; }
                    input { padding: 15px; width: 80%; max-width: 300px; border-radius: 10px; border: none; font-size: 18px; margin-bottom: 20px; }
                    button { padding: 15px 30px; background: #25D366; border: none; border-radius: 10px; color: black; font-weight: bold; cursor: pointer; font-size: 18px; }
                    #res { color: #ffff00; font-size: 40px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <h1>JACKSON BEATZ V3</h1>
                <p>O bot está ativo. Digite seu número para parear:</p>
                <input type="number" id="num" placeholder="Ex: 244900000000">
                <br>
                <button onclick="gerar()">RECEBER NOTIFICAÇÃO</button>
                <h1 id="res"></h1>
                <p id="st" style="color:#888;"></p>
                <script>
                    function gerar() {
                        const n = document.getElementById('num').value;
                        if(!n) return alert('Digite o número!');
                        document.getElementById('st').innerText = 'Enviando notificação...';
                        fetch('/pairing?nh=' + n).then(r => r.json()).then(d => {
                            document.getElementById('res').innerText = d.code || 'Erro';
                            document.getElementById('st').innerText = d.code ? 'NOTIFICAÇÃO ENVIADA!' : 'Erro ao gerar.';
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

async function startBot() {
    // 1. LÓGICA DE SESSÃO
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // Se você já tiver a SESSION_DATA salva no Render, o bot entra direto:
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            state.creds = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
            console.log("✅ SESSION_DATA CARREGADA!");
        } catch (e) { console.log("Erro ao carregar SESSION_DATA"); }
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // ESTA LINHA ABAIXO É O QUE FAZ A NOTIFICAÇÃO APARECER NO CELULAR:
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: false,
        syncFullHistory: false
    });

    // Rota de Pareamento
    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            await delay(1500); // Espera estabilizar
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "close") {
            const status = lastDisconnect?.error?.output?.statusCode;
            if (status !== 401) startBot();
        } else if (connection === "open") {
            console.log("\n🚀 BOT CONECTADO COM SUCESSO!");
            
            // --- ESTE É O BLOCO QUE VOCÊ VAI COPIAR ---
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
            await sock.sendMessage(m.key.remoteJid, { text: "🏓 V3 Online!" });
        }
    });
}

app.listen(port, () => console.log("Servidor Online"));
startBot();
