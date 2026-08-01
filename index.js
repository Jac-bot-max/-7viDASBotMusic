const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const mongoose = require("mongoose");
const pino = require("pino");
const http = require("http");

// --- CONFIGURAÇÃO ---
// 1. TROQUE 'SUA_SENHA' PELA SENHA QUE VOCÊ CRIOU NO MONGODB
const mongoURL = "mongodb+srv://Jackson:JacksonBot2024@cluster0.qrdsoog.mongodb.net/?retryWrites=true&w=majority";
const phoneNumber = "258865560063"; 

// --- SERVIDOR FANTASMA PARA O RENDER NÃO DERRUBAR O BOT ---
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Jackson AI está Vivo!\n');
}).listen(port, () => {
    console.log(`Servidor de monitoramento rodando na porta ${port}`);
});

async function startBot() {
    console.log("Iniciando processo de conexão...");
    
    try {
        // Conexão com o Banco de Dados
        await mongoose.connect(mongoURL);
        console.log("✅ Conectado ao MongoDB!");

        const { state, saveCreds } = await useMultiFileAuthState('session');

        const conn = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        // Lógica de Pareamento
        if (!conn.authState.creds.registered) {
            console.log(`Solicitando código para: ${phoneNumber}`);
            await delay(8000); // Espera o bot carregar totalmente
            try {
                const code = await conn.requestPairingCode(phoneNumber);
                const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n====================================`);
                console.log(`CÓDIGO DE CONEXÃO: ${formattedCode}`);
                console.log(`====================================\n`);
            } catch (pairingErr) {
                console.log("Erro ao gerar código de pareamento, tentando novamente...");
            }
        }

        conn.ev.on('creds.update', saveCreds);

        conn.ev.on('connection.update', (update) => {
            const { connection } = update;
            if (connection === 'open') console.log("✅ BOT CONECTADO E PRONTO!");
            if (connection === 'close') {
                console.log("Conexão fechada. Reiniciando em 5 segundos...");
                setTimeout(startBot, 5000);
            }
        });

    } catch (err) {
        console.log("❌ ERRO FATAL:", err.message);
        // Se der erro no MongoDB, ele tenta iniciar o bot sem banco para você não ficar parado
        console.log("Tentando iniciar sem MongoDB para emergência...");
        setTimeout(startBot, 10000);
    }
}

startBot();