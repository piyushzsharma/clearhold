const fs = require('fs');
const path = require('path');

function replaceJsExtensions(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceJsExtensions(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const newContent = content.replace(/from\s+['"](@\/[^'"]+)\.js['"]/g, 'from \'$1\'');
            if (content !== newContent) {
                fs.writeFileSync(fullPath, newContent);
                console.log('Updated', fullPath);
            }
        }
    }
}

replaceJsExtensions(path.join(process.cwd(), 'apps', 'backend', 'src'));
