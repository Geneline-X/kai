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
            merge_logs: true,
        },
    ],
};
