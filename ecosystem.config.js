module.exports = {
    apps: [
        {
            name: 'whatsapp-geneline-bridge',
            script: 'dist/index.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                // In VPS, we often use the system installed chromium
                PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium-browser'
            },
            // Log management
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: 'logs/pm2-error.log',
            out_file: 'logs/pm2-out.log',
        },
        {
            name: 'webjs-auto-updater',
            script: './scripts/auto-update-webjs.sh',
            instances: 1,
            exec_mode: 'fork',
            cron_restart: '0 3 * * *', // Run every day at 3 AM
            watch: false,
            autorestart: false, // Don't restart automatically after it finishes
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: 'logs/updater-error.log',
            out_file: 'logs/updater-out.log',
            merge_logs: true,
        }
    ],
};
