const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Stockage simple des commandes
const COMMANDS_FILE = path.join(__dirname, 'commands.json');

if (!fs.existsSync(COMMANDS_FILE)) {
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify({ commands: [] }));
}

// API pour recevoir les commandes
app.post('/api/command', (req, res) => {
    const { command, chatId } = req.body;
    if (command && chatId) {
        const data = JSON.parse(fs.readFileSync(COMMANDS_FILE));
        data.commands.push({ command, chatId, timestamp: Date.now() });
        fs.writeFileSync(COMMANDS_FILE, JSON.stringify(data));
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// API pour lire les commandes (polling)
app.get('/api/commands/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    const data = JSON.parse(fs.readFileSync(COMMANDS_FILE));
    const userCommands = data.commands.filter(c => c.chatId === chatId);
    
    // Nettoyer les commandes lues
    const remaining = data.commands.filter(c => c.chatId !== chatId);
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify({ commands: remaining }));
    
    res.json({ commands: userCommands.map(c => c.command) });
});

app.listen(3000, () => {
    console.log('Serveur démarré sur http://localhost:3000');
});
