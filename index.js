const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const yts = require('yt-search');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

// --- PÁGINA WEB ---
app.get('/', (req, res) => {
    res.send(`<body style="font-family:sans-serif;text-align:center;background:#111;color:white;padding:50px;">
        <h1>🤖 Jackson Beatz Bot Pro Ativo</h1>
        <p>Bot gerenciando grupos e produção musical.</p>
        <form action="/getcode" method="POST">
            <input type="text" name="number" placeholder="25884..." required style="padding:10px;border-radius:5px;">
            <button type="submit" style="padding:10px;background:green;color:white;border:none;border-radius:5px;">Gerar Código</button>
        </form>
    </body>`);
});

const dicas = [
    "🎧 *Dica:* Use um filtro High-Pass em tudo que não for Bumbo ou Baixo para limpar a mixagem.",
    "🎹 *Dica:* No FL Studio, use 'Alt+R' no piano roll para humanizar as notas.",
    "🎙️ *Dica:* Grave vozes com o microfone levemente inclinado para evitar 'pufs' de ar.",
    "🔥 *Dica:* Use Soft Clipper no Master para ganhar volume sem distorcer.",
    "🎚️ *Dica:* Ajuste os ganhos (Gain Staging) antes de começar a colocar qualquer plugin."
];

async function startBot(numberToPair, res) {
    if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
    if (process.env.SESSION_DATA && !fs.existsSync('./session_data/creds.json')) {
        try {
            const decoded = Buffer.from(process.env.SESSION_DATA, 'base64').toString();
            fs.writeFileSync('./session_data/creds.json', decoded);
        } catch (e) { console.log("Erro ao carregar SESSION_DATA"); }
    }

    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Android", "Chrome", "20.0.04"],
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    // --- BOAS-VINDAS ---
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            const user = anu.participants[0];
            await sock.sendMessage(anu.id, { 
                text: `Olá @${user.split('@')[0]}, bem-vindo ao grupo *Jackson Beatz*! 🎹🔥\n\nDigite *!menu* para ver o que eu faço.`,
                mentions: [user]
            });
        }
    });

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') console.log('✅ BOT JACKSON BEATZ ONLINE!');
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const chat = msg.key.remoteJid;
        const isGroup = chat.endsWith('@g.us');
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // --- COMANDOS DO BOT ---

        // 1. MENU COMPLETO
        if (texto === '!menu') {
            const menu = `🤖 *JACKSON BEATZ PRO*\n\n` +
                         `*🎧 PRODUÇÃO MUSICAL:*\n` +
                         `👉 *!dica* - Dica aleatória de produção.\n` +
                         `👉 *!foto [nome]* - Capa e info de música.\n\n` +
                         `*👮 ADMINISTRAÇÃO:*\n` +
                         `👉 *!ban* - Responda a alguém para banir.\n` +
                         `👉 *!promover* - Responda para dar ADM.\n` +
                         `👉 *!rebaixar* - Responda para tirar ADM.\n` +
                         `👉 *!marcar* - Chama todos do grupo.\n` +
                         `👉 *!link* - Pega o link do grupo.\n\n` +
                         `*🛠️ UTILITÁRIOS:*\n` +
                         `👉 *!ping* - Testar velocidade.\n` +
                         `👉 *!regras* - Regras do grupo.\n\n` +
                         `🚫 *Anti-Link Ativado*`;
            await sock.sendMessage(chat, { text: menu }, { quoted: msg });
        }

        // 2. COMANDO !DICA
        if (texto === '!dica') {
            const d = dicas[Math.floor(Math.random() * dicas.length)];
            await sock.sendMessage(chat, { text: d }, { quoted: msg });
        }

        // 3. BUSCAR FOTO YOUTUBE
        if (texto.startsWith('!foto')) {
            const busca = texto.replace('!foto', '').trim();
            if (!busca) return sock.sendMessage(chat, { text: 'Diga o nome da música!' });
            const r = await yts(busca);
            const vid = r.videos[0];
            if (vid) await sock.sendMessage(chat, { image: { url: vid.thumbnail }, caption: `🎬 *${vid.title}*\n⏱️ ${vid.timestamp}` });
        }

        // 4. BANIR / PROMOVER / REBAIXAR (SÓ ADM)
        if (isGroup && (texto === '!ban' || texto === '!promover' || texto === '!rebaixar')) {
            const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!citado) return sock.sendMessage(chat, { text: '❌ Responda à mensagem de alguém!' });
            
            if (texto === '!ban') {
                await sock.groupParticipantsUpdate(chat, [citado], 'remove');
                await sock.sendMessage(chat, { text: '👤 Usuário removido!' });
            } else if (texto === '!promover') {
                await sock.groupParticipantsUpdate(chat, [citado], 'promote');
                await sock.sendMessage(chat, { text: '✅ Agora é Administrador!' });
            } else if (texto === '!rebaixar') {
                await sock.groupParticipantsUpdate(chat, [citado], 'demote');
                await sock.sendMessage(chat, { text: '❌ Não é mais Administrador.' });
            }
        }

        // 5. MARCAR TODOS
        if (texto === '!marcar' && isGroup) {
            const metadata = await sock.groupMetadata(chat);
            const participantes = metadata.participants.map(v => v.id);
            await sock.sendMessage(chat, { text: '📣 *ATENÇÃO TODOS!*', mentions: participantes });
        }

        // 6. LINK DO GRUPO
        if (texto === '!link' && isGroup) {
            const link = await sock.groupInviteCode(chat);
            await sock.sendMessage(chat, { text: `🔗 https://chat.whatsapp.com/${link}` });
        }

        // 7. REGRAS
        if (texto === '!regras') {
            await sock.sendMessage(chat, { text: "⚠️ *REGRAS:* \n1. Proibido Links\n2. Respeite os produtores\n3. Foco em Beats!" });
        }

        // --- ANTI-LINK ---
        if (isGroup && texto.includes('chat.whatsapp.com/')) {
            await sock.sendMessage(chat, { delete: msg.key });
            await sock.sendMessage(chat, { text: "🚫 *Links são proibidos!*" });
        }
    });
}

app.post('/getcode', (req, res) => {
    startBot(req.body.number.replace(/\D/g, ''), res);
});

app.listen(port, () => console.log(`Porta ${port}`));
startBot();
