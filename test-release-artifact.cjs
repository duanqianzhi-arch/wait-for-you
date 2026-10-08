// Verifies the shipped artifact, rather than trusting manually typed metadata.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const dist=path.join(__dirname,'dist'),metadata=JSON.parse(fs.readFileSync(path.join(dist,'downloads/android-release.json'),'utf8'));
assert.equal(metadata.version,'1.1.2');assert.equal(metadata.versionCode,5);assert.equal(metadata.runtimeStatus,'phone-testing-pending');
assert.equal(metadata.file,'dengni-xiake-v1.1.2.apk');assert.deepEqual(metadata.permissions,['android.permission.INTERNET']);
const apk=fs.readFileSync(path.join(dist,'downloads',metadata.file));
assert.equal(apk.length,metadata.size);assert.equal(crypto.createHash('sha256').update(apk).digest('hex'),metadata.sha256);
let end=apk.length-22;while(end>=Math.max(0,apk.length-65557)&&apk.readUInt32LE(end)!==0x06054b50)end--;
assert(end>=0,'ZIP directory missing');const entries=new Map();let cursor=apk.readUInt32LE(end+16);
for(let n=0;n<apk.readUInt16LE(end+10);n++){
  assert.equal(apk.readUInt32LE(cursor),0x02014b50);const method=apk.readUInt16LE(cursor+10),size=apk.readUInt32LE(cursor+20),nameSize=apk.readUInt16LE(cursor+28),extraSize=apk.readUInt16LE(cursor+30),commentSize=apk.readUInt16LE(cursor+32),offset=apk.readUInt32LE(cursor+42);
  const name=apk.subarray(cursor+46,cursor+46+nameSize).toString();entries.set(name,{method,size,offset});cursor+=46+nameSize+extraSize+commentSize;
}
function read(name){const e=entries.get(name);assert(e,'missing APK asset '+name);const start=e.offset+30+apk.readUInt16LE(e.offset+26)+apk.readUInt16LE(e.offset+28),bytes=apk.subarray(start,start+e.size);return e.method===8?zlib.inflateRawSync(bytes):bytes;}
const assets=[...entries.keys()].filter(n=>n.startsWith('assets/www/')&&!n.endsWith('/'));assert.equal(assets.length,metadata.bundledFiles);
for(const name of ['personal-timetable.js','timetable-ui.js','henu-schedule-adapter.js','app.js','core.js','data.js','styles.css'])assert(read('assets/www/'+name).equals(fs.readFileSync(path.join(dist,name))),name+' is stale in APK');
const html=read('assets/www/index.html').toString();assert(html.includes('data-native-app="1.1.2"'));assert(html.includes('data-nav="timetable"'));assert(html.includes('timetable-ui.js'));
assert.equal(metadata.certificateSha256,'b75e65f5f1a72f333b206189c449ac8d2a1a1405235f48babfbe6ff67e45c1c1');
console.log('PASS: release APK hash, size, actual bundled scripts, nav, version and metadata');
