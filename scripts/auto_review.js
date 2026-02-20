const { execSync } = require('child_process');
const fs = require('fs');

try {
    const baseRef = process.env.GITHUB_BASE_REF || 'main';
    
    // Ensure we have the base ref available for comparison
    console.log(`Fetching origin/${baseRef}...`);
    try {
        execSync(`git fetch origin ${baseRef} --depth=1`);
    } catch (e) {
        console.warn("Fetch failed, might already have history.");
    }

    // Get list of changed files
    console.log(`Comparing HEAD with origin/${baseRef}...`);
    const diffCmd = `git diff --name-status origin/${baseRef}...HEAD`;
    const diffOutput = execSync(diffCmd).toString();
    
    const lines = diffOutput.trim().split('\n');
    
    let shouldApprove = true;
    let hasModifications = false;

    for (const line of lines) {
        if (!line.trim()) continue;
        
        const [status, filePath] = line.split('\t');
        
        // Only allow changes in domains/reserved/*.json
        // If any other file is changed, manual review is required.
        if (!filePath.startsWith('domains/reserved/') || !filePath.endsWith('.json')) {
            console.log(`Non-domain file changed: ${filePath}`);
            shouldApprove = false;
            break;
        }

        if (status === 'A') {
            // New file detected -> Do nothing (Manual review required)
            console.log(`New file detected: ${filePath}`);
            shouldApprove = false;
            break; 
        } else if (status === 'M') {
            hasModifications = true;
            // Modified file -> Check content
            try {
                const oldContentCmd = `git show origin/${baseRef}:${filePath}`;
                const newContentCmd = `git show HEAD:${filePath}`; // Or just read file system
                
                const oldJson = JSON.parse(execSync(oldContentCmd).toString());
                const newJson = JSON.parse(fs.readFileSync(filePath, 'utf8')); // Read local file

                // Check github_username and subdomain
                if (oldJson.github_username !== newJson.github_username) {
                    console.log(`github_username changed in ${filePath}`);
                    shouldApprove = false;
                    break;
                }
                if (oldJson.subdomain !== newJson.subdomain) {
                    console.log(`subdomain changed in ${filePath}`);
                    shouldApprove = false;
                    break;
                }
            } catch (e) {
                console.error(`Error processing ${filePath}: ${e.message}`);
                shouldApprove = false;
                break;
            }
        } else {
            // Any other status (D, R, etc.) -> Manual review
            console.log(`File status '${status}' detected for ${filePath} -> Manual review required.`);
            shouldApprove = false;
            break;
        }
    }

    // Output result for GitHub Actions
    const outputValue = (shouldApprove && hasModifications) ? 'true' : 'false';
    console.log(`Approve: ${outputValue}`);
    
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `approve=${outputValue}\n`);
    }

} catch (error) {
    console.error(`Script failed: ${error.message}`);
    process.exit(1);
}
