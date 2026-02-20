const fs = require('fs');
const path = require('path');

function isValidEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
}

function verifySubdomainMatch(subdomain, filePath) {    
    const fileName = path.basename(filePath);
    const fileNameSubdomain = fileName.split('.')[0];

    const specialCases = ["purelymail1._domainkey", "purelymail2._domainkey", "purelymail3._domainkey"];

    if (specialCases.includes(subdomain.toLowerCase())) {
        return true;
    }

    if (fileNameSubdomain.toLowerCase() === subdomain.toLowerCase()) {
        return true;
    }

    return false;
}

function verifyFileFormat(fileName) {
    const pattern = /^(@|_dmarc|[a-zA-Z0-9\-]+|purelymail[1-3]\._domainkey)\.is-app\.top\.json$/; // Expression to validate file name.

    const specialCases = ["@", "_dmarc", "purelymail1._domainkey", "purelymail2._domainkey", "purelymail3._domainkey"];

    for (let i = 0; i < specialCases.length; i++) {
        if (fileName.startsWith(specialCases[i] + ".is-app.top.json")) {
            return pattern.test(fileName);
        }
    }

    const fileNameParts = fileName.split('.');
    if (fileNameParts.length !== 4 || !pattern.test(fileName)) {
        return false;
    }

    return true;
}

function isValidIP(ip) {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}$/;
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

function isValidDomain(domain) {
    const pattern = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/;
    return pattern.test(domain);
}

function validateJson(jsonData, filePath) {
    const errors = [];

    const fileName = path.basename(filePath);
    if (!verifyFileFormat(fileName)) {
        console.log(fileName)
        errors.push(`:ERROR: Only third-level domains are supported. Rename your JSON to this format: 'SUBDOMAIN.is-app.top.json'.`);
    }

    const subdomain = jsonData.subdomain || '';
    if (!subdomain) {
        errors.push(':ERROR: Subdomain is empty.'); 
    } else if (subdomain.includes('*')) {
        errors.push(':ERROR: Subdomain cannot contain wildcards.');
    } else {
        if (!verifySubdomainMatch(subdomain, filePath)) {
            errors.push(':ERROR: Ensure the subdomain specified in the JSON file matches the subdomain present in the file name.');
        }
    }

    const domain = jsonData.domain || '';
    if (!domain || domain !== "is-app.top") {
        errors.push(':ERROR: Domain is invalid.');
    }

    const publicEmail = jsonData.public_email || '';
    const contactInfo = jsonData.email_or_discord || '';
    if (publicEmail) {
        if (!isValidEmail(publicEmail)) {
            errors.push(':ERROR: Invalid email in the JSON.');
        }
    }
    else if (!contactInfo) {
        errors.push(':ERROR: Please provide your contact info in the JSON.');
    }

    const github_username = jsonData.github_username || '';
    if (!github_username ) {
        errors.push(':ERROR: Please provide your GitHub username in the JSON.');
    }

    const description = jsonData.description || '';
    if (!description) {
        errors.push(':ERROR: Description is empty.');
    } else if (description.length < 15) {
        errors.push(':ERROR: Description is too short. Please provide a description of your website.');
    }

    const records = jsonData.records || {};
    if (typeof records !== 'object') {
        errors.push(':ERROR: Records must be an object.');
    } else {
        const validRecordTypes = ['A', 'AAAA', 'CNAME', 'NS', 'MX', 'TXT'];

        for (const [type, values] of Object.entries(records)) {
            if (!validRecordTypes.includes(type)) {
                errors.push(`:ERROR: Invalid record type: ${type}`);
                continue;
            }
            // Verify that the values in records are arrays
            if (!Array.isArray(values)) {
                errors.push(`:ERROR: ${type} record must be an array. Check your JSON syntax.`);
                continue;
            }

            values.forEach((value) => {
                switch (type) {
                    // A check
                    case 'A':
                        if (!isValidIP(value) || value.includes(':')) {
                            errors.push(`:ERROR: Invalid A record (IPv4 expected): ${value}`);
                        }
                        break;
                    // AAAA check
                    case 'AAAA':
                        if (!isValidIP(value) || !value.includes(':')) {
                            errors.push(`:ERROR: Invalid AAAA record (IPv6 expected): ${value}`);
                        }
                        break;
                    // CNAME, NS, and MX check
                    case 'CNAME':
                    case 'NS':
                    case 'MX':
                        if (!isValidDomain(value)) {
                            errors.push(`:ERROR: Invalid ${type} record: ${value}. Must be a valid domain. Remove 'http://' or 'https://', do not trail with '/'`);
                        }
                        break;
                    // TXT check
                    case 'TXT':
                        if (typeof value !== 'string') {
                            errors.push(`:ERROR: Invalid TXT record: ${value}`);
                        }
                        break;
                }
            });
        }
    }

    // Validate proxied field (optional)
    if (jsonData.proxied !== undefined && typeof jsonData.proxied !== 'boolean') {
        errors.push(':ERROR: Proxied field must be a boolean (true or false).');
    }

    return errors;
}

// Attempt to auto-correct minor structural issues and return whether a change was made
function autoFix(jsonData, filePath) {
    let modified = false;
    const fileName = path.basename(filePath);
    const subFromName = fileName.split('.')[0];

    // Keep proxied field if provided (no deletion)
    if (Object.prototype.hasOwnProperty.call(jsonData, 'proxied')) {
        // No operation needed, just ensuring we don't delete it
    }

    // Ensure required top-level fields exist with defaults
    if (!jsonData.subdomain || typeof jsonData.subdomain !== 'string') {
        jsonData.subdomain = subFromName || '';
        modified = true;
    }
    if (!jsonData.domain || jsonData.domain !== 'is-app.top') {
        jsonData.domain = 'is-app.top';
        modified = true;
    }
    if (!jsonData.public_email) {
        jsonData.public_email = 'contact@is-app.top';
        modified = true;
    }
    if (!jsonData.description) {
        jsonData.description = 'Reserved subdomain';
        modified = true;
    }
    if (!jsonData.records || typeof jsonData.records !== 'object') {
        jsonData.records = {};
        modified = true;
    }

    // Normalize record shapes
    const normalizeArray = (v) => Array.isArray(v) ? v : (v === undefined || v === null ? [] : [v]);
    const rec = jsonData.records;
    if (rec.CNAME !== undefined && !Array.isArray(rec.CNAME)) {
        rec.CNAME = normalizeArray(rec.CNAME);
        modified = true;
    }
    if (rec.A !== undefined && !Array.isArray(rec.A)) {
        rec.A = normalizeArray(rec.A); modified = true;
    }
    if (rec.AAAA !== undefined && !Array.isArray(rec.AAAA)) {
        rec.AAAA = normalizeArray(rec.AAAA); modified = true;
    }
    if (rec.NS !== undefined && !Array.isArray(rec.NS)) {
        rec.NS = normalizeArray(rec.NS); modified = true;
    }
    if (rec.MX !== undefined && !Array.isArray(rec.MX)) {
        rec.MX = normalizeArray(rec.MX); modified = true;
    }
    if (rec.TXT !== undefined && !Array.isArray(rec.TXT)) {
        rec.TXT = normalizeArray(rec.TXT); modified = true;
    }

    return modified;
}

function main() {
    // An absolute path to the 'domains' directory for portability
    const domainsPath = path.join(__dirname, '..', 'domains');

    // Function to get all files in '../domains' and '../domains/reserved'
    function getAllFiles(dirPath) {
        let allFiles = [];

        // Read files in the main directory
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                allFiles.push(filePath); // Include files directly in the main directory
            }
        });

        // Check for and read 'reserved' subdirectory
        const reservedPath = path.join(dirPath, 'reserved');
        if (fs.existsSync(reservedPath) && fs.statSync(reservedPath).isDirectory()) {
            const reservedFiles = fs.readdirSync(reservedPath);
            reservedFiles.forEach(file => {
                const filePath = path.join(reservedPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    allFiles.push(filePath); // Include files in 'reserved' subdirectory
                }
            });
        }

        return allFiles;
    }  

    const allFiles = getAllFiles(domainsPath);    
    let allErrors = [];

    // Validate each JSON file
    allFiles.forEach(filePath => {
        const raw = fs.readFileSync(filePath, 'utf-8');
        let jsonData;
        try {
            // Use JSON5 for tolerant parsing (comments, trailing commas, etc.)
            jsonData = JSON5.parse(raw);
        } catch (e) {
            allErrors.push(`File: ${filePath} - :ERROR: Unable to parse file with JSON5: ${e.message}`);
            return;
        }

        // Try auto-fix, then write back normalized JSON if modified or if the JSON5 parse differs from JSON.stringify
        const wasModified = autoFix(jsonData, filePath);
        const normalized = JSON.stringify(jsonData, null, 4) + '\n';
        if (wasModified || normalized.trim() !== raw.trim()) {
            fs.writeFileSync(filePath, normalized, 'utf-8');
            console.log(`Auto-fixed ${filePath}`);
        }

        const errors = validateJson(jsonData, filePath);

        if (errors.length > 0) {
            allErrors = allErrors.concat(errors.map(error => `File: ${filePath} - ${error}`));
        }
    });

    // Print all errors and exit with an error code
    if (allErrors.length > 0) {
        console.error('Validation errors found:');
        allErrors.forEach(error => console.error(`- ${error}`));
        process.exit(1); // Exit with an error code
    } else {
        console.log('JSON files content is valid.');
    }
}

// Run the main function
main();
