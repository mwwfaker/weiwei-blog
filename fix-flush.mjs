import fs from 'node:fs'
const f = 'backend/src/main/java/com/weiwei/blog/api/PerfWorkspaceController.java'
let s = fs.readFileSync(f, 'utf8')
const old = `        entries.deleteAllByOwnerId(owner);
        members.deleteAllByOwnerId(owner);
        queues.deleteAllByOwnerId(owner);`
const neu = `        entries.deleteAllByOwnerId(owner);
        members.deleteAllByOwnerId(owner);
        queues.deleteAllByOwnerId(owner);
        // 必须先 flush：否则随后的 INSERT 可能排在同 key 的 DELETE 之前，
        // 撞上 (owner_id, client_id) 唯一键，整笔事务回滚，看起来就像「保存没生效」。
        entries.flush();
        members.flush();
        queues.flush();`
if (!s.includes(old)) { console.log('ANCHOR MISSING'); process.exit(1) }
fs.writeFileSync(f, s.replace(old, neu), 'utf8')
console.log('controller 已加 flush')
