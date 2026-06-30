const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mongoose = require('mongoose');

// ==========================================
// 1. CONEXÃO COM O BANCO DE DADOS (MONGO)
// ==========================================
// TROQUE 'SUA_SENHA_AQUI' PELA SENHA DO MONGODB!
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
// 2. CONFIGURAÇÃO DO BOT
// ==========================================
const client = new Client({
    authStrategy: new LocalAuth(), 
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', qr => qrcode.generate(qr, {small: true}));
client.on('ready', () => console.log('🚀 Bot Jackson Beatz V3 Online!'));

client.on('message_create', async (msg) => {
    if (msg.fromMe) return;

    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const isGroup = chat.isGroup;
    const body = msg.body || '';
    const authorId = msg.author || msg.from;

    // --- SEGURANÇA: ANTI-LINK ---
    if (isGroup) {
        const admins = chat.participants.filter(p => p.isAdmin).map(p => p.id._serialized);
        const isSenderAdmin = admins.includes(authorId);
        const hasLink = /(https?:\/\/[^\s]+)/g.test(body);

        if (hasLink && !isSenderAdmin) {
            await msg.delete(true);
            await chat.removeParticipants([authorId]);
            return; 
        }
    }

    // --- FILTRO DE VÍDEO (ADVERTÊNCIA) ---
    if (isGroup && msg.hasMedia && msg.type === 'video') {
        const isBeat = body.toLowerCase().includes('beat') || body.toLowerCase().includes('instrumental');
        if (!isBeat) {
            await aplicarAviso(authorId, chat.id._serialized, msg, contact, chat);
        }
    }

    // --- COMANDOS ---
    const prefix = "!";
    if (!body.startsWith(prefix)) return;
    const command = body.split(' ')[0].toLowerCase();
    const args = body.slice(command.length).trim();

    switch (command) {
        case `${prefix}menu`:
            msg.reply(`🎵 *JACKSON BEATZ V3* 🎵\n\n🛡️ *Anti-Link:* Ativado\n⚠️ *Avisos:* !status\n🔍 *Drum Kits:* !drumkit [nome]\n💡 *Dica:* !dica`);
            break;

        case `${prefix}status`:
            const data = await User.findOne({ userId: authorId, groupId: chat.id._serialized });
            msg.reply(`⚠️ @${contact.id.user}, você tem *${data ? data.warnings : 0}/3* advertências.`, null, { mentions: [contact] });
            break;

        case `${prefix}drumkit`:
            if (!args) return msg.reply("❌ Digite o gênero. Ex: !drumkit Kizomba");
            msg.reply(`🔎 Buscando Drum Kits de *${args}*...\n\nResultados:\n1️⃣ YouTube: https://www.youtube.com/results?search_query=drum+kit+${args.replace(/ /g, '+')}+download`);
            break;
            
        case `${prefix}dica`:
            msg.reply("💡 Jackson Beatz Dica: Mantenha seus instrumentais organizados por BPM para facilitar as vendas!");
            break;
    }
});

async function aplicarAviso(userId, groupId, msg, contact, chat) {
    let user = await User.findOne({ userId, groupId });
    if (!user) user = new User({ userId, groupId, warnings: 0 });
    user.warnings += 1;
    await user.save();

    if (user.warnings >= 3) {
        msg.reply(`🚨 @${contact.id.user} expulso por excesso de avisos!`, null, { mentions: [contact] });
        await chat.removeParticipants([userId]);
        await User.deleteOne({ userId, groupId });
    } else {
        msg.reply(`⚠️ @${contact.id.user}, vídeo proibido! Aviso ${user.warnings}/3.`, null, { mentions: [contact] });
    }
}

client.initialize();
