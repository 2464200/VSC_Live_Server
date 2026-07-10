const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const src = path.resolve('C:/VSC_Live_Server');
    const ts = new Date().toISOString().replace(/[:.]/g,'-').replace('T','_').split('Z')[0];
    const dest = `C:/VSC_Live_Server_backup_${ts}`;

    // Use fs.cp if available (Node 16+), otherwise fallback to recursive copy
    if (fs.cp) {
      await fs.promises.mkdir(dest, { recursive: true });
      await fs.promises.cp(src, dest, { recursive: true });
    } else {
      // Fallback: simple recursive copy
      const copyDir = async (s, d) => {
        await fs.promises.mkdir(d, { recursive: true });
        const entries = await fs.promises.readdir(s, { withFileTypes: true });
        for (let entry of entries) {
          const srcPath = path.join(s, entry.name);
          const destPath = path.join(d, entry.name);
          if (entry.isDirectory()) await copyDir(srcPath, destPath);
          else await fs.promises.copyFile(srcPath, destPath);
        }
      };
      await copyDir(src, dest);
    }

    console.log('BACKUP_PATH=' + dest);
    process.exit(0);
  } catch (e) {
    console.error('BACKUP_ERROR', e);
    process.exit(2);
  }
})();
