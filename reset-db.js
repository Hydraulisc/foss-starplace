const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

function createBackup() {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `database_backup_${timestamp}.db`);
    fs.copyFileSync('./database.db', backupPath);
    return backupPath;
}


const resetDatabase = () => {
    const backupPath = createBackup();
    console.log(`🔒 Backup created at: ${backupPath}`);
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = OFF'); // Temporarily disable foreign keys for drop

        db.run(`DROP TABLE IF EXISTS posts`);
        db.run(`DROP TABLE IF EXISTS boards`);
        db.run(`DROP TABLE IF EXISTS invites`);
        db.run(`DROP TABLE IF EXISTS users`);

        db.run('PRAGMA foreign_keys = ON'); // Re-enable after drop

        console.log('All tables dropped.');
        initializeDatabase(); // Call your existing init function
    });
};

// copy pasted from index.js
const initializeDatabase = () => {
    db.serialize(() => {
        // Create Users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                hydraulisc_id TEXT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                pfp TEXT NOT NULL,
                theme TEXT NOT NULL,
                biography TEXT NOT NULL,
                isAdmin BOOLEAN DEFAULT 0 NOT NULL,
                discriminator TEXT,
                language TEXT NOT NULL
            )
        `);

        // Create Invites table
        db.run(`
            CREATE TABLE IF NOT EXISTS invites (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                used INTEGER DEFAULT 0
            )
        `);

        // Create Boards table
        db.run(`
            CREATE TABLE IF NOT EXISTS boards (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                name TEXT NOT NULL UNIQUE,
                icon TEXT NOT NULL,
                owner INTEGER NOT NULL,
                description TEXT NOT NULL,
                indexable BOOLEAN DEFAULT 0 NOT NULL,
                language TEXT NOT NULL
            )
        `);

        // Create Posts table
        db.run(`
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                board_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                filename TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
                    ON UPDATE CASCADE,
                FOREIGN KEY (board_id) REFERENCES boards(id)
                    ON DELETE CASCADE
                    ON UPDATE CASCADE
            )
        `);

        // Enable foreign key support
        db.run('PRAGMA foreign_keys = ON');
        console.log('Database initialized with required tables.');
    });
};

if (args.includes('--reset-db')) {
    console.log('Resetting database...');
    resetDatabase();
    return;
}