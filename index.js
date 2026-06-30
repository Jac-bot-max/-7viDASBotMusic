const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

// INTERFACE WEB (PARA PEDIR A NOTIFICAÇÃO)
app.get("/", (req, res) => {
    res.send(`
        <html>
            <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="background:#000; color:#fff; text-align:center; padding-top:50px; font-family:sans-serif;">
                <h1 style="color:#25D366;">JACKSON BEATZ V3</h1>
                <p>O bot está pronto. Digite o número para receber a NOTIFICAÇÃO:</p>
                <input type="number" id="num" placeholder="DDI + Número" style="padding:15px; border-radius:10px; width:250px; font-size:18px;">
                <br><br>
                <button onclick="gerar()" style="padding:15px 30px; background:#25D366; font-weight:bold; cursor:pointer; border-radius:10px;">RECEBER NOTIFICAÇÃO</button>
                <h1 id="res" style="color:#ffff00; font-size:45px; margin-top:30px;"></h1>
                <p id="st" style="color:#aaa;"></p>
                <script>
                    function gerar() {
                        const n = document.getElementById('num').value;
                        if(!n) return alert('Digite o número!');
                        document.getElementById('st').innerText = 'Enviando notificação ao WhatsApp...';
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

async function startJacksonBot() {
    // Começa uma sessão limpa, sem arquivos velhos
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // NAVEGADOR QUE FORÇA A NOTIFICAÇÃO (Simulando um Mac)
        browser: ["Mac OS", "Chrome", "10.15.7"],
        printQRInTerminal: false
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
            // Só reinicia se o erro NÃO for de "deslogado"
            const status = lastDisconnect?.error?.output?.statusCode;
            if (status !== 401) startJacksonBot();
        } else if (connection === "open") {
            console.log("\n🚀 BOT CONECTADO COM SUCESSO!");
            // GERA O TEXTO QUE VOCÊ VAI COPIAR PARA O RENDER
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE O TEXTO ABAIXO E SALVE NA SESSION_DATA ---\n");
            console.log(sessionStr);
            console.log("\n---------------------------------------------------\n");
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

app.listen(port, () => console.log("Servidor Web Ativo"));
startJacksonBot();
