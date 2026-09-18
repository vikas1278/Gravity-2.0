const dns = require('dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

const { MongoClient } = require('mongodb');
const colors = require('./UI/colors/colors');
const config = require("./config.js");
require('dotenv').config();

let client;

if (config.mongodbUri) {
    const uri = config.mongodbUri;
    client = new MongoClient(uri);
} else {
    try {
        const { getLangSync } = require('./utils/languageLoader.js');
        const lang = getLangSync();
        console.warn("\x1b[33m[ WARNING ]\x1b[0m " + (lang.console?.mongodb?.uriNotDefined || "MongoDB URI is not defined in the configuration."));
    } catch (e) {
        console.warn("\x1b[33m[ WARNING ]\x1b[0m MongoDB URI is not defined in the configuration.");
    }
}

async function connectToDatabase() {
    try {
        const { getLangSync } = require('./utils/languageLoader.js');
        const lang = getLangSync();
        if (!client) {
            console.warn("\x1b[33m[ WARNING ]\x1b[0m " + (lang.console?.mongodb?.skippingConnection || "Skipping MongoDB connection as URI is not provided."));
            return;
        }

        try {
            await client.connect();
            console.log('\n' + '─'.repeat(40));
            console.log(`${colors.magenta}${colors.bright}${lang.console?.bot?.databaseConnection || '🕸️  DATABASE CONNECTION'}${colors.reset}`);
            console.log('─'.repeat(40));
            console.log('\x1b[36m[ DATABASE ]\x1b[0m', '\x1b[32m' + (lang.console?.mongodb?.connected || 'Connected to MongoDB ✅') + '\x1b[0m');
        } catch (err) {
            console.warn("\x1b[33m[ WARNING ]\x1b[0m " + (lang.console?.mongodb?.connectionFailed || "Could not connect to MongoDB. Continuing without database functionality."));
            console.error(err.message);
            return;
        }

        // Connect Mongoose for AutoMod / Moderation models
        try {
            const mongoose = require('mongoose');
            const mongoUri = config.mongodbUri || process.env.MONGO_URI;
            if (mongoUri && mongoose.connection.readyState === 0) {
                await mongoose.connect(mongoUri, {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                });
                console.log('\x1b[36m[ DATABASE ]\x1b[0m', '\x1b[32mMongoose connected for AutoMod models ✅\x1b[0m');
            }
        } catch (mongooseErr) {
            console.warn('\x1b[33m[ WARNING ]\x1b[0m Mongoose connection failed:', mongooseErr.message);
        }
    } catch (e) {
        if (!client) {
            console.warn("\x1b[33m[ WARNING ]\x1b[0m Skipping MongoDB connection as URI is not provided.");
            return;
        }
        try {
            await client.connect();
            console.log('\n' + '─'.repeat(40));
            console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE CONNECTION${colors.reset}`);
            console.log('─'.repeat(40));
            console.log('\x1b[36m[ DATABASE ]\x1b[0m', '\x1b[32mConnected to MongoDB ✅\x1b[0m');
        } catch (err) {
            console.warn("\x1b[33m[ WARNING ]\x1b[0m Could not connect to MongoDB. Continuing without database functionality.");
            console.error(err.message);
            return;
        }
    }
    console.log('\x1b[36m[ DATABASE ]\x1b[0m', '\x1b[32mMongoDB Online ✅\x1b[0m');
}

function getDb() {
    return client ? client.db("GravityBot_3_0") : null;
}

function getPlaylistCollection() {
    const db = getDb();
    return db ? db.collection("SongPlayLists") : null;
}

function getAutoplayCollection() {
    const db = getDb();
    return db ? db.collection("AutoplaySettings") : null;
}

function getLanguageCollection() {
    const db = getDb();
    return db ? db.collection("GuildLanguages") : null;
}

// Legacy compatibility: allow direct property access (returns live collection)
const handler = {
    get(target, prop) {
        if (prop === 'playlistCollection') return getPlaylistCollection();
        if (prop === 'autoplayCollection') return getAutoplayCollection();
        if (prop === 'languageCollection') return getLanguageCollection();
        return target[prop];
    }
};

module.exports = new Proxy({
    connectToDatabase,
    getPlaylistCollection,
    getAutoplayCollection,
    getLanguageCollection,
    get playlistCollection() { return getPlaylistCollection(); },
    get autoplayCollection() { return getAutoplayCollection(); },
    get languageCollection() { return getLanguageCollection(); },
}, handler);
