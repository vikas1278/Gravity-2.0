const config = require('../config.js');

function isOwner(userId) {
    if (!userId) return false;
    const ownerIds = new Set();

    if (config.ownerID) {
        if (Array.isArray(config.ownerID)) {
            config.ownerID.forEach(id => ownerIds.add(String(id).trim()));
        } else if (typeof config.ownerID === 'string') {
            config.ownerID.split(',').forEach(id => ownerIds.add(id.trim()));
        }
    }
    if (process.env.OWNER_IDS) {
        process.env.OWNER_IDS.split(',').forEach(id => ownerIds.add(id.trim()));
    }
    if (process.env.OWNER_ID) {
        ownerIds.add(process.env.OWNER_ID.trim());
    }

    return ownerIds.has(String(userId));
}

module.exports = { isOwner };
