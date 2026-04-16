const fs = require('fs');
const path = require('path');

const moduleDir = path.join(__dirname, '..', 'node_modules', 'expo-module-scripts');
const sourcePath = path.join(moduleDir, 'tsconfig.base.json');
const targetPath = path.join(moduleDir, 'tsconfig.base');
const expoModulesCoreTsconfigPath = path.join(__dirname, '..', 'node_modules', 'expo-modules-core', 'tsconfig.json');

const patchExpoModulesCoreTsconfig = () => {
  if (!fs.existsSync(expoModulesCoreTsconfigPath)) {
    console.log('[fix-expo-tsconfig-compat] expo-modules-core tsconfig not found. Skipping rootDir patch.');
    return;
  }

  const raw = fs.readFileSync(expoModulesCoreTsconfigPath, 'utf8');
  const json = JSON.parse(raw);

  json.compilerOptions = json.compilerOptions || {};
  const hasRootDir = json.compilerOptions.rootDir === './src';
  const hasIgnoreDeprecations = json.compilerOptions.ignoreDeprecations === '6.0';

  if (hasRootDir && hasIgnoreDeprecations) {
    console.log('[fix-expo-tsconfig-compat] expo-modules-core rootDir patch already applied.');
    return;
  }

  json.compilerOptions.rootDir = './src';
  json.compilerOptions.ignoreDeprecations = '6.0';
  fs.writeFileSync(expoModulesCoreTsconfigPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  console.log('[fix-expo-tsconfig-compat] Patched expo-modules-core tsconfig rootDir and ignoreDeprecations for TS 5.6+ compatibility.');
};

try {
  if (!fs.existsSync(moduleDir)) {
    console.log('[fix-expo-tsconfig-compat] expo-module-scripts not found. Skipping.');
    process.exit(0);
  }

  if (!fs.existsSync(sourcePath)) {
    console.log('[fix-expo-tsconfig-compat] tsconfig.base.json not found. Skipping.');
    process.exit(0);
  }

  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log('[fix-expo-tsconfig-compat] Created tsconfig.base compatibility file.');
  } else {
    console.log('[fix-expo-tsconfig-compat] Compatibility file already exists.');
  }

  patchExpoModulesCoreTsconfig();
} catch (error) {
  console.error('[fix-expo-tsconfig-compat] Failed:', error?.message || error);
  process.exit(1);
}
