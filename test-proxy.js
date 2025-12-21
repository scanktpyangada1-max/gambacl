const axios = require("axios");
const https = require("https");

const client = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false,
    }),
});

const username = 'pukii_Cou33';
const password = '=QM6qrBrLC0tH7vL';

console.log('Testing Oxylabs proxy...');
console.log(`Username: user-${username}`);
console.log('Host: dc.oxylabs.io:8001\n');

client
    .get("https://ip.oxylabs.io/location", {
        proxy: {
            protocol: "http",
            host: "dc.oxylabs.io",
            port: 8001,
            auth: {
                username: `user-${username}`,
                password: password,
            },
        },
    })
    .then((res) => {
        console.log('✅ Proxy test successful!');
        console.log('Response:', res.data);
    })
    .catch((err) => {
        console.error('❌ Proxy test failed:');
        console.error(err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    });
