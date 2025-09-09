# Cloudflare DDNS Updater

## About

This project provides a simple and secure way to update Cloudflare DNS records with your dynamic public IP address, specifically designed to address limitations of traditional DDNS approaches with Unifi equipment.

### Why not use Unifi's built-in custom DDNS?

Custom DDNS solution often require:
- Hosting a publicly accessible server with open ports
- Managing authentication and security for the public endpoint
- Complex setup when running behind NAT
- Inability to run the DDNS service inside your local network

This solution runs entirely inside your local network, requires no open ports, and uses Cloudflare's secure API for DNS updates.

## How It Works

The service:
1. Periodically checks your public IP using myip.dk (configurable interval)
2. Fetches all A records from your Cloudflare zone
3. Updates matching records based on your wildcard pattern
4. Maintains each record's Cloudflare proxy status

### Features

- **Wildcard Support**: Update multiple records using patterns like `*.example.com` or `service*.example.com`
- **Multiple A Records**: Updates all matching records in a single run
- **No External Dependencies**: Uses only Node.js standard library
- **Proxy Status Preservation**: Maintains Cloudflare proxy settings for each record
- **Docker Support**: Easy deployment using Docker

## Usage

### Docker (Recommended)

#### Single Zone
```bash
docker run -d \
  -e CF_API_TOKEN='your-cloudflare-api-token' \
  -e CF_ZONE_ID='your-zone-id' \
  -e CF_RECORD_NAME='*.example.com' \
  -e UPDATE_INTERVAL='3600000' \
  raregoat8804/cloudflare-ddns-local:latest
```

#### Multiple Zones
```bash
docker run -d \
  -e CF_API_TOKEN='your-cloudflare-api-token' \
  -e CF_ZONES='[{"zone_id":"zone1_id","record_name":"*.domain1.com"},{"zone_id":"zone2_id","record_name":"*.domain2.com"}]' \
  -e UPDATE_INTERVAL='3600000' \
  raregoat8804/cloudflare-ddns-local:latest
```

### Environment Variables

#### Single Zone Mode
| Variable | Description | Default |
|----------|-------------|---------|
| CF_API_TOKEN | Cloudflare API token | Required |
| CF_ZONE_ID | Cloudflare Zone ID | Required |
| CF_RECORD_NAME | DNS record pattern to update | Required |
| UPDATE_INTERVAL | Update interval in milliseconds | 3600000 (1 hour) |

#### Multi-Zone Mode
| Variable | Description | Default |
|----------|-------------|---------|
| CF_API_TOKEN | Cloudflare API token | Required |
| CF_ZONES | JSON array of zone configurations | Required |
| UPDATE_INTERVAL | Update interval in milliseconds | 3600000 (1 hour) |

**CF_ZONES Format:**
```json
[
  {
    "zone_id": "your-first-zone-id",
    "record_name": "*.domain1.com"
  },
  {
    "zone_id": "your-second-zone-id", 
    "record_name": "specific.domain2.com"
  }
]
```

### Cloudflare Setup

1. Create an API token in Cloudflare with:
   - Zone:DNS:Edit permissions
   - Zone:Zone:Read permissions
   - **For multiple zones:** Include all zones in the token permissions, or use "All zones"
2. Get your Zone ID(s) from Cloudflare dashboard
3. Configure the record pattern(s) to match your needs

**Multi-Zone API Token:** A single API token can manage multiple zones. You don't need separate tokens for each domain.

### Record Pattern Examples

- `*.example.com` - Updates all subdomains
- `service*.example.com` - Updates service1, service2, etc.
- `specific.example.com` - Updates single record
- `*.test.example.com` - Updates all subdomains under test

## Unifi Multi-WAN Configuration

If you're using Unifi's Multi-WAN setup, you'll need to ensure the DDNS updater uses the correct WAN interface for IP lookup.

### SNAT Rule Setup

1. Navigate to Unifi Settings > Security > Firewall & NAT
2. Create a new SNAT rule:
   ```
   Source: Docker network subnet (e.g., 172.17.0.0/16)
   Translation: Use WAN interface IP
   Interface: WAN interface you want to use for DDNS
   ```
3. Place this rule at the top of your SNAT rules

This ensures the IP lookup request goes through your preferred WAN interface, correctly detecting the public IP you want to use for DNS records.

## Development

```bash
# Clone repository
git clone https://github.com/mayask/cloudflare-ddns-local.git

# Install dependencies
npm install

# Run locally (single zone)
CF_API_TOKEN=xxx CF_ZONE_ID=xxx CF_RECORD_NAME=xxx node server.js

# Run locally (multiple zones)
CF_API_TOKEN=xxx CF_ZONES='[{"zone_id":"zone1","record_name":"*.domain1.com"},{"zone_id":"zone2","record_name":"*.domain2.com"}]' node server.js
```

## License

MIT 