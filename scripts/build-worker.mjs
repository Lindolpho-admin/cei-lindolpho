import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve("dist");
for(const old of ["cei-google-drive.gs.txt","drive-ui.js","server/drive.js","server/primary-store.js"])fs.rmSync(path.join(root,old),{force:true});
const types = {
  ".html": "text/html; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png",
  ".svg": "image/svg+xml", ".jpeg": "image/jpeg", ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const map = {};
for (const dirname of [root, path.join(root, "public-app-files")].filter(d => fs.existsSync(d))) {
  for (const filename of fs.readdirSync(dirname)) {
    const full = path.join(dirname, filename);
    if (!fs.statSync(full).isFile()) continue;
    const type = types[path.extname(filename)];
    if (!type) continue;
    const key = "/" + path.relative(root, full).replaceAll(path.sep, "/");
    const bytes=fs.readFileSync(full);
    map[key] = { type, base64: bytes.toString("base64"), md5:createHash('md5').update(bytes).digest('hex') };
  }
}
fs.mkdirSync(path.join(root, "server"), { recursive: true });
const initialBooks=JSON.parse(fs.readFileSync(path.join(root,'app.js'),'utf8').match(/const DEFAULT_LIBRARY_BOOKS=(\[.*?\]);/)[1]);
fs.writeFileSync(path.join(root,'server','bootstrap.js'),'export const initialBooks='+JSON.stringify(initialBooks)+';\n');
fs.writeFileSync(path.join(root, "server", "assets.js"), "export const assets = " + JSON.stringify(map) + ";\n");
fs.copyFileSync("server/worker.js", path.join(root, "server", "index.js"));
fs.copyFileSync("server/host-storage.js", path.join(root, "server", "host-storage.js"));
fs.rmSync(path.join(root, "public-app-files"), { recursive: true, force: true });
console.log("Built APP archive Worker with " + Object.keys(map).length + " site assets.");

fs.copyFileSync('server/access.js',path.join(root,'server','access.js'));
fs.copyFileSync('server/auth.js',path.join(root,'server','auth.js'));
