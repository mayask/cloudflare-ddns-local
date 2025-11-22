const https = require('https');
const http = require('http');

// Logging helpers with timestamps
function getTimestamp() {
    return new Date().toISOString();
}

function log(...args) {
    console.log(`[${getTimestamp()}]`, ...args);
}

function logError(...args) {
    console.error(`[${getTimestamp()}]`, ...args);
}

// Add these environment variables or replace with your values
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ZONE_ID = process.env.CF_ZONE_ID;
const CF_RECORD_NAME = process.env.CF_RECORD_NAME;
const CF_ZONES = process.env.CF_ZONES;
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL || '3600000', 10); // 1 hour default

// Parse zone configuration (supports both single and multi-zone)
let zones = [];
if (CF_ZONES) {
    try {
        zones = JSON.parse(CF_ZONES);
        log(`Multi-zone mode: Managing ${zones.length} zones`);
    } catch (error) {
        logError('Error parsing CF_ZONES:', error.message);
        process.exit(1);
    }
} else if (CF_ZONE_ID && CF_RECORD_NAME) {
    zones = [{ zone_id: CF_ZONE_ID, record_name: CF_RECORD_NAME }];
    log('Single-zone mode: Managing 1 zone');
} else {
    logError('Configuration required: Either CF_ZONES or (CF_ZONE_ID + CF_RECORD_NAME)');
    process.exit(1);
}

// Function to fetch public IP
function updatePublicIP() {
    const options = {
        hostname: 'myip.dk',
        path: '/',
        headers: {
            'User-Agent': 'curl/7.88.1'
        }
    };

    https.get(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            // Extract IP from the response using regex
            const ipMatch = data.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
            if (ipMatch) {
                log(`IP: "${ipMatch[0]}"`);
                // Update DNS records for all configured zones
                zones.forEach((zone, index) => {
                    log(`Updating zone ${index + 1}/${zones.length}: ${zone.record_name}`);
                    updateCloudflareDNS(ipMatch[0], zone.zone_id, zone.record_name);
                });
            } else {
                log('Could not extract IP from response');
                process.exit(1);
            }
        });
    }).on('error', (err) => {
        logError('Error fetching public IP:', err.message);
    });
}

function updateCloudflareDNS(newIP, zoneId, recordName) {
    // List all A records without name filter
    const listOptions = {
        hostname: 'api.cloudflare.com',
        path: `/client/v4/zones/${zoneId}/dns_records?type=A`,
        headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json'
        }
    };

    https.get(listOptions, (res) => {
        let data = '';

        res.on('data', chunk => data += chunk);

        res.on('end', () => {
            const response = JSON.parse(data);
            if (!response.success) {
                logError('Failed to fetch DNS records:', response.errors);
                return;
            }

            // Convert wildcard pattern to regex
            const wildcardToRegex = recordName.replace(/\./g, '\\.').replace(/\*/g, '.*');
            const namePattern = new RegExp(`^${wildcardToRegex}$`);

            // Filter records that match the pattern
            const matchingRecords = response.result.filter(record => namePattern.test(record.name));

            if (matchingRecords.length === 0) {
                logError('No matching DNS records found for pattern:', recordName);
                return;
            }

            log(`Found ${matchingRecords.length} matching records`);

            // Update all matching records
            matchingRecords.forEach(record => {
                // Skip if IP hasn't changed
                if (record.content === newIP) {
                    log(`IP unchanged for ${record.name}, skipping`);
                    return;
                }

                const updateOptions = {
                    hostname: 'api.cloudflare.com',
                    path: `/client/v4/zones/${zoneId}/dns_records/${record.id}`,
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${CF_API_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                };

                const updateReq = https.request(updateOptions, (updateRes) => {
                    let updateData = '';
                    
                    updateRes.on('data', chunk => updateData += chunk);
                    
                    updateRes.on('end', () => {
                        const updateResponse = JSON.parse(updateData);
                        if (updateResponse.success) {
                            log(`DNS record ${record.name} updated successfully to ${newIP}`);
                        } else {
                            logError(`Failed to update DNS record ${record.name}:`, updateResponse.errors);
                        }
                    });
                });

                updateReq.on('error', (error) => {
                    logError(`Error updating DNS record ${record.name}:`, error);
                });

                updateReq.write(JSON.stringify({
                    type: 'A',
                    name: record.name,
                    content: newIP,
                    proxied: record.proxied  // Maintain existing proxied status
                }));

                updateReq.end();
            });
        });
    }).on('error', (error) => {
        logError('Error fetching DNS records:', error);
    });
}

// Health check endpoint for Docker/Portainer
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200);
        res.end('OK');
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(3000, () => {
    log('Health endpoint listening on port 3000');
});

// Run immediately on startup
updatePublicIP();

// Then run based on UPDATE_INTERVAL environment variable
setInterval(updatePublicIP, UPDATE_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', () => {
    log('Shutting down...');
    server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
    log('Shutting down...');
    server.close(() => process.exit(0));
});
