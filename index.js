const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");

const PREFIX = "!";
const WARN_LIMIT = 3;

// banco simples em memória
let warns = {};

// anti-spam simples
let lastMsg = {};

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) startBot();
    }

    if (connection === "open") {
      console.log("🤖 BOT ONLINE COM SUCESSO!");
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    const { id, participants, action } = update;

    if (action === "add") {
      for (let user of participants) {
        await sock.sendMessage(id, {
          text: `👋 Bem-vindo ao grupo!\n\nUsuário: @${user.split("@")[0]}`,
          mentions: [user]
        });
      }
    }
  });

  sock.ev.on("messages.upsert", async (msg) => {
    try {
      const m = msg.messages[0];
      if (!m.message) return;

      const from = m.key.remoteJid;
      const sender = m.key.participant || from;
      const isGroup = from.endsWith("@g.us");

      const text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        "";

      const body = text.toLowerCase().trim();

      // =========================
      // ANTI-SPAM SIMPLES
      // =========================
      const now = Date.now();
      if (lastMsg[sender] && now - lastMsg[sender] < 2000) {
        return; // evita flood
      }
      lastMsg[sender] = now;

      // =========================
      // ANTILINK
      // =========================
      const linkRegex = /https?:\/\/|www\.|\.com|\.net|\.org/i;

      if (isGroup && linkRegex.test(body)) {
        await sock.sendMessage(from, {
          text: "🚫 Link removido! Não é permitido."
        });

        try {
          await sock.sendMessage(from, {
            delete: m.key
          });
        } catch {}

        warns[sender] = (warns[sender] || 0) + 1;

        await sock.sendMessage(from, {
          text: `⚠ Advertência ${warns[sender]}/${WARN_LIMIT}`
        });

        if (warns[sender] >= WARN_LIMIT) {
          await sock.groupParticipantsUpdate(from, [sender], "remove");
        }

        return;
      }

      // =========================
      // DETECÇÃO DE MÍDIA
      // =========================
      const msgType = Object.keys(m.message)[0];

      if (isGroup) {
        if (msgType === "imageMessage") {
          await sock.sendMessage(from, {
            text: "🖼 Imagem removida (não permitida)."
          });

          warns[sender] = (warns[sender] || 0) + 1;
          return;
        }

        if (msgType === "videoMessage") {
          await sock.sendMessage(from, {
            text: "🎥 Vídeo removido (não permitido)."
          });

          warns[sender] = (warns[sender] || 0) + 1;
          return;
        }
      }

      // =========================
      // COMANDOS
      // =========================
      if (!body.startsWith(PREFIX)) return;

      const cmd = body.slice(1).split(" ")[0];

      if (cmd === "ping") {
        return sock.sendMessage(from, { text: "🏓 Pong!" });
      }

      if (cmd === "menu") {
        return sock.sendMessage(from, {
          text: `
🤖 MENU DO BOT

!ping - testar bot
!menu - comandos
!warn - ver advertências
!info - info do usuário
`
        });
      }

      if (cmd === "warn") {
        const count = warns[sender] || 0;
        return sock.sendMessage(from, {
          text: `⚠ Tens ${count} advertência(s)`
        });
      }

      if (cmd === "info") {
        return sock.sendMessage(from, {
          text: `👤 Usuário: ${sender}`
        });
      }

    } catch (e) {
      console.log("Erro:", e);
    }
  });
}

startBot();
