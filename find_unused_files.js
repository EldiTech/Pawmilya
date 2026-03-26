const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const directoriesToScan = [
    path.join(projectRoot, 'src'),
    path.join(projectRoot, 'backend')
];

function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;
    const files = fs.readdirSync(dirPath);

    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
            }
        } else {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

let allFiles = [];
directoriesToScan.forEach(dir => {
    allFiles = allFiles.concat(getAllFiles(dir));
});

// Also grab root level important files: App.js
if (fs.existsSync(path.join(projectRoot, 'App.js'))) {
    allFiles.push(path.join(projectRoot, 'App.js'));
}

const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md'];
const assetExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.gif'];

const isTextFile = (file) => textExtensions.includes(path.extname(file).toLowerCase());
const isAssetFile = (file) => assetExtensions.includes(path.extname(file).toLowerCase());

const textFiles = allFiles.filter(isTextFile);
const assetFiles = allFiles.filter(isAssetFile);

const allProjectFiles = [...textFiles, ...assetFiles];

console.log(`Analyzing ${textFiles.length} text files and ${assetFiles.length} asset files...`);

const fileContents = textFiles.map(file => {
    try {
        return { path: file, content: fs.readFileSync(file, 'utf8') };
    } catch(e) {
        return { path: file, content: '' };
    }
});

const unreferencedFiles = [];

allProjectFiles.forEach(file => {
    const ext = path.extname(file);
    const baseName = path.basename(file, ext);
    
    let isReferenced = false;
    
    // Check if imported anywhere in other files
    if (baseName === 'index' && textExtensions.includes(ext)) {
        // 'index.js' is often imported by its folder name
        const dirName = path.basename(path.dirname(file));
        isReferenced = fileContents.some(f => 
            f.path !== file && 
            f.content.includes(dirName)
        );
    } else {
        // Normal check for file base name
        isReferenced = fileContents.some(f => 
            f.path !== file && 
            f.content.includes(baseName)
        );
    }
    
    if (!isReferenced) {
        unreferencedFiles.push(file.replace(projectRoot + '\\', ''));
    }
});

fs.writeFileSync(path.join(projectRoot, 'unused_report.json'), JSON.stringify({
    unusedFiles: unreferencedFiles
}, null, 2));
console.log(`Analysis complete. Found ${unreferencedFiles.length} potentially unused files.`);
