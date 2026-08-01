async function startBot() {
    try {
        console.log("Tentando conectar ao MongoDB...");
        // Verifique se a variável mongoURL abaixo tem o seu link real!
        await mongoose.connect(mongoURL, { serverSelectionTimeoutMS: 5000 });
        console.log("✅ Conectado ao MongoDB!");
    } catch (err) {
        console.log("❌ Erro ao conectar no MongoDB: ", err.message);
        console.log("O bot continuará iniciando sem banco de dados (Modo de Emergência)...");
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');
    // ... resto do código