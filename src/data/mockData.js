import { getThreatColor } from '../utils/threatColor'

// ── Hourly threat events for the Overview timeline ──
export const hourlyThreatEvents = [
  { hour: '00:00', events: 12, blocked: 8 },
  { hour: '01:00', events: 8, blocked: 5 },
  { hour: '02:00', events: 15, blocked: 11 },
  { hour: '03:00', events: 22, blocked: 18 },
  { hour: '04:00', events: 18, blocked: 14 },
  { hour: '05:00', events: 25, blocked: 20 },
  { hour: '06:00', events: 30, blocked: 24 },
  { hour: '07:00', events: 45, blocked: 38 },
  { hour: '08:00', events: 52, blocked: 44 },
  { hour: '09:00', events: 38, blocked: 31 },
  { hour: '10:00', events: 42, blocked: 35 },
  { hour: '11:00', events: 55, blocked: 47 },
  { hour: '12:00', events: 48, blocked: 40 },
  { hour: '13:00', events: 35, blocked: 28 },
  { hour: '14:00', events: 60, blocked: 52 },
  { hour: '15:00', events: 72, blocked: 63 },
  { hour: '16:00', events: 58, blocked: 49 },
  { hour: '17:00', events: 44, blocked: 37 },
  { hour: '18:00', events: 32, blocked: 26 },
  { hour: '19:00', events: 28, blocked: 22 },
  { hour: '20:00', events: 36, blocked: 30 },
  { hour: '21:00', events: 41, blocked: 34 },
  { hour: '22:00', events: 50, blocked: 42 },
  { hour: '23:00', events: 20, blocked: 15 },
]

// ── Overview stat cards ──
export const overviewStats = {
  totalAlerts: 1247,
  highSeverity: 38,
  activeAgents: 256,
  meanTimeToDetect: '4m 32s',
}

// ── Recent high-severity alerts ──
export const recentAlerts = [
  {
    id: 'ALT-9821',
    title: 'Suspicious PowerShell Execution',
    severity: 18,
    status: 'active',
    source: 'WIN-AGENT-07',
    timestamp: '2026-09-11T14:32:10Z',
    ruleId: '5716',
  },
  {
    id: 'ALT-9820',
    title: 'Brute Force SSH Login Attempt',
    severity: 16,
    status: 'investigating',
    source: '185.220.101.42',
    timestamp: '2026-09-11T14:28:55Z',
    ruleId: '5712',
  },
  {
    id: 'ALT-9819',
    title: 'Ransomware File Encryption Detected',
    severity: 20,
    status: 'active',
    source: 'WIN-AGENT-12',
    timestamp: '2026-09-11T14:15:33Z',
    ruleId: '5500',
  },
  {
    id: 'ALT-9818',
    title: 'Outbound Connection to C2 Server',
    severity: 17,
    status: 'mitigated',
    source: '10.0.0.55',
    timestamp: '2026-09-11T13:52:07Z',
    ruleId: '20019',
  },
  {
    id: 'ALT-9817',
    title: 'Privilege Escalation Attempt',
    severity: 15,
    status: 'investigating',
    source: 'WIN-AGENT-03',
    timestamp: '2026-09-11T13:40:21Z',
    ruleId: '5103',
  },
  {
    id: 'ALT-9816',
    title: 'Malware Executable Downloaded',
    severity: 19,
    status: 'active',
    source: '198.51.100.23',
    timestamp: '2026-09-11T13:22:48Z',
    ruleId: '7100',
  },
]

// ── Incident feed ──
export const categories = [
  'Malware',
  'Intrusion Attempt',
  'Data Exfiltration',
  'Policy Violation',
  'Authentication',
  'Network Anomaly',
]

export const incidentStatuses = ['open', 'active', 'investigating', 'mitigated', 'resolved']

export const incidents = [
  {
    id: 'INC-201',
    title: 'SQL Injection Attack on Web Server',
    severity: 19,
    category: 'Intrusion Attempt',
    status: 'investigating',
    agent: 'SRV-WEB-01',
    ruleId: '950006',
    description: 'Detected SQL injection pattern in POST request to /api/login endpoint. Attacker attempted to extract database credentials using UNION-based injection.',
    mitigation: 'Block source IP at firewall, patch web application parameter sanitization, review database access logs for credential exposure.',
    sourceIp: '45.33.32.156',
    timestamp: '2026-09-11T14:35:00Z',
  },
  {
    id: 'INC-200',
    title: 'Banking Trojan Detected on Endpoint',
    severity: 20,
    category: 'Malware',
    status: 'active',
    agent: 'WIN-FINANCE-04',
    ruleId: '7100',
    description: 'Emotet banking Trojan identified via signature match. Process injection observed into legitimate browser processes.',
    mitigation: 'Isolate host immediately, perform full disk forensics, rotate all financial credentials, review recent banking transactions.',
    sourceIp: '185.220.101.42',
    timestamp: '2026-09-11T14:20:15Z',
  },
  {
    id: 'INC-199',
    title: 'Large Data Exfiltration via DNS Tunneling',
    severity: 17,
    category: 'Data Exfiltration',
    status: 'investigating',
    agent: 'SRV-DC-01',
    ruleId: '20019',
    description: 'Unusual DNS query volumes detected with high-entropy subdomain strings consistent with DNS tunneling exfiltration technique.',
    mitigation: 'Throttle DNS queries from affected host, deploy DNS security policy, inspect data stores accessed prior to exfiltration window.',
    sourceIp: '10.0.0.55',
    timestamp: '2026-09-11T13:55:30Z',
  },
  {
    id: 'INC-198',
    title: 'Multiple Failed Login Attempts - Brute Force',
    severity: 12,
    category: 'Authentication',
    status: 'mitigated',
    agent: 'WIN-HR-02',
    ruleId: '5712',
    description: 'Over 500 failed SSH login attempts from a single IP address targeting multiple user accounts within 10 minutes.',
    mitigation: 'Source IP blocked at perimeter firewall, account lockout policy reviewed, MFA enforcement verified.',
    sourceIp: '198.51.100.23',
    timestamp: '2026-09-11T13:10:45Z',
  },
  {
    id: 'INC-197',
    title: 'Unauthorized Software Installation',
    severity: 10,
    category: 'Policy Violation',
    status: 'resolved',
    agent: 'WIN-MKT-05',
    ruleId: '5305',
    description: 'Non-approved software installation detected via Windows Installer event. Application was installed outside of change management window.',
    mitigation: 'Software uninstalled, endpoint policy tightened to require admin approval for installations, user reprimanded.',
    sourceIp: '10.0.0.78',
    timestamp: '2026-09-11T12:30:00Z',
  },
  {
    id: 'INC-196',
    title: 'Port Scan Detection from External IP',
    severity: 8,
    category: 'Network Anomaly',
    status: 'mitigated',
    agent: 'SRV-EDGE-01',
    ruleId: '8526',
    description: 'Sequential port scan detected targeting 1000+ ports across the external-facing firewall.',
    mitigation: 'Source IP added to threat intelligence blocklist, firewall logging enhanced for similar patterns.',
    sourceIp: '203.0.113.45',
    timestamp: '2026-09-11T11:45:22Z',
  },
  {
    id: 'INC-195',
    title: 'Insider Threat - After-hours Data Access',
    severity: 14,
    category: 'Policy Violation',
    status: 'open',
    agent: 'WIN-DEV-09',
    ruleId: '5305',
    description: 'User accessed 2.3GB of sensitive R&D files at 3:00 AM local time, outside normal working hours and access pattern.',
    mitigation: 'Access to sensitive files temporarily revoked, user interview scheduled, SIEM alert rules expanded for similar patterns.',
    sourceIp: '10.0.0.122',
    timestamp: '2026-09-11T10:15:00Z',
  },
  {
    id: 'INC-194',
    title: 'C2 Beacon Communication Detected',
    severity: 18,
    category: 'Intrusion Attempt',
    status: 'active',
    agent: 'WIN-OPS-02',
    ruleId: '20019',
    description: 'Periodic outbound HTTPS connections to known command-and-control infrastructure detected via JA3 fingerprint match.',
    mitigation: 'Host isolated from network, EDR process tree analysis initiated, IOCs shared with threat intel team for broader hunt.',
    sourceIp: '192.168.1.109',
    timestamp: '2026-09-11T09:40:18Z',
  },
]

// ── Attack Map data ──
export const attackSources = [
  { ip: '185.220.101.42', country: 'DE', lat: 51.1657, lng: 10.4515, intensity: 0.95, count: 1247 },
  { ip: '45.33.32.156', country: 'US', lat: 37.0902, lng: -95.7129, intensity: 0.78, count: 892 },
  { ip: '198.51.100.23', country: 'RU', lat: 61.5240, lng: 105.3188, intensity: 0.88, count: 1103 },
  { ip: '203.0.113.45', country: 'CN', lat: 35.8617, lng: 104.1954, intensity: 0.72, count: 654 },
  { ip: '8.8.8.8', country: 'US', lat: 37.0902, lng: -95.7129, intensity: 0.35, count: 210 },
  { ip: '1.1.1.1', country: 'AU', lat: -25.2744, lng: 133.7751, intensity: 0.42, count: 340 },
  { ip: '193.27.228.140', country: 'FR', lat: 46.2276, lng: 2.2137, intensity: 0.65, count: 567 },
  { ip: '104.248.50.87', country: 'BR', lat: -14.2350, lng: -51.9253, intensity: 0.55, count: 423 },
  { ip: '195.154.172.140', country: 'JP', lat: 36.2048, lng: 138.2529, intensity: 0.61, count: 489 },
  { ip: '81.171.20.90', country: 'SE', lat: 60.1282, lng: 18.6435, intensity: 0.48, count: 301 },
]

export const TARGET_IP = '192.168.1.109'
export const TARGET_COORDS = { lat: 39.8283, lng: -98.5795 } // Geographic center of US

// ── Logs data ──
export const logLevels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
export const logSources = ['Wazuh Manager', 'Agent-01', 'Agent-02', 'Agent-03', 'Firewall', 'IDS', 'SIEM Core']

export const logEntries = Array.from({ length: 200 }, (_, i) => {
  const level = logLevels[Math.floor(Math.random() * logLevels.length)]
  const source = logSources[Math.floor(Math.random() * logSources.length)]
  const messages = {
    DEBUG: ['Connection pool status check', 'Cache hit ratio calculation', 'Thread pool metrics dump', 'Memory allocation trace'],
    INFO: ['Agent connected successfully', 'Rule loaded: 5716', 'Firewall sync complete', 'Log rotation performed', 'Heartbeat received from Agent-03'],
    WARNING: ['High memory usage detected', 'Slow query warning', 'Certificate expiring in 7 days', 'Unusual traffic pattern flagged'],
    ERROR: ['Connection timeout to manager', 'Failed to authenticate agent', 'Rule parsing error in /etc/ossec.conf', 'Database connection lost'],
    CRITICAL: ['Data breach detected', 'Ransomware signature matched', 'Unauthorized root access', 'Full filesystem encryption detected'],
  }
  const msgs = messages[level]
  return {
    id: i + 1,
    timestamp: new Date(Date.now() - i * 60000).toISOString(),
    level,
    source,
    message: msgs[Math.floor(Math.random() * msgs.length)],
    ruleId: level === 'CRITICAL' || level === 'ERROR' ? `R${Math.floor(1000 + Math.random() * 9000)}` : null,
  }
}).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
