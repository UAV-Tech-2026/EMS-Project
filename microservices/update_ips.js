const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const newDbUser = 'ems_db';
const newDbPass = '123';
const newDbName = 'ems_dbs1';
const newDatabaseUrl = `postgres://${newDbUser}:${newDbPass}@172.31.14.42:5432/${newDbName}`;

const services = fs.readdirSync(DIR).filter(f => fs.statSync(path.join(DIR, f)).isDirectory());

services.forEach(service => {
    const composePath = path.join(DIR, service, 'docker-compose.yml');
    if (fs.existsSync(composePath)) {
        let content = fs.readFileSync(composePath, 'utf-8');
        
        // Remove old DATABASE_URL
        content = content.replace(/\s+- DATABASE_URL=.*?\n/, '\n');

        // Insert new environment vars right after PORT=
        const insertion = `
      - DB_USER=${newDbUser}
      - DB_PASSWORD=${newDbPass}
      - DB_NAME=${newDbName}
      - DATABASE_URL=${newDatabaseUrl}`;
        
        content = content.replace(/- PORT=(\d+)/, `- PORT=$1${insertion}`);

        fs.writeFileSync(composePath, content);
        console.log(`Updated: ${service}/docker-compose.yml`);
    }
});
