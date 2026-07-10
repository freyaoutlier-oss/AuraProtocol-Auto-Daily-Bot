import { getIncentives, verifyTask } from './api.js';

// Sync tasks: for each incomplete task, call verify with
// index = 0-based position in the tasks array. Server validates on-chain state.
export async function syncTasks(cookie, dryRun) {
  const { json } = await getIncentives(cookie);
  const tasks = json.tasks || [];
  let done = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t.completed) continue;
    console.log(`  task ${t.task_id} (index ${i}) ...`);
    if (dryRun) { console.log(`  [DRY_RUN] verify ${t.task_id} index ${i}`); continue; }
    const r = await verifyTask(cookie, t.task_id, i);
    console.log(`    -> ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`);
    if (r.json && r.json.status === 'success') done++;
  }
  console.log(`  sync done, ${done} task(s) verified.`);
}
