const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mongoose = require('mongoose');
const express = require('express'); // Adicionado para o Render

const app = express();
const port = process.env.PORT || 10000;

// Servidor para o Render não desligar o bot
app.get('/', (req, res) => res.send('Bot Jackson Beatz Online!'));
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));

// ==========================================
// 1. CONEXÃO COM O BANCO DE DADOS (MONGO)
// ==========================================
const MONGO_URI = 'mongodb+srv://Jackson:Bot123@cluster0.qrdsoog.mongodb.net/?appName=Cluster0'; 

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Jackson Beatz: Banco de Dados Conectado!'))
    .catch(err => console.error('❌ Erro no MongoDB:', err));

const UserSchema = new mongoose.Schema({
    userId: String,
    groupId: String,
    warnings: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

// ==========================================
// 2. CONFIGURAÇÃO DO BOT (COM FIX PARA RENDER)
// ==========================================
const client = new Client({
    authStrategy: new LocalAuth(), 
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

client.on('qr', qr => qrcode.generate(qr, {small: true}));
client.on('ready', () => console.log('🚀 Bot Jackson Beatz V3 Online!'));

// Lógica de Mensagens
client.on('message_create', async (msg) => {
    if (msg.fromMe) return;
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const isGroup = chat.isGroup;
    const body = msg.body || '';
    const authorId = msg.author || msg.from;

    // ANTI-LINK
    if (isGroup) {
        const admins = chat.participants.filter(p => p.isAdmin).map(p => p.id._serialized);
        const isSenderAdmin = admins.includes(authorId);
        if (body.includes('http') && !isSenderAdmin) {
            await msg.delete(true);
            await chat.removeParticipants([authorId]);
            return;
        }
    }

    // COMANDOS
    const prefix = "!";
    if (!body.startsWith(prefix)) return;
    const command = body.split(' ')[0].toLowerCase();
    const args = body.slice(command.length).trim();

    if (command === `${prefix}menu`) {
        msg.reply("🎵 *JACKSON BEATZ V3*\n\n🛡️ !status\n🔍 !drumkit\n💡 !dica");
    }

    if (command === `${prefix}status`) {
        const data = await User.findOne({ userId: authorId, groupId: chat.id._serialized });
        msg.reply(`⚠️ @${contact.id.user}, avisos: ${data ? data.warnings : 0}/3`, null, { mentions: [contact] });
    }
});

client.initialize();
