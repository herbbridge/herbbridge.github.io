import { readFile, writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root = new URL('../', import.meta.url);
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const rows = [];
for (const [kind, file, key] of [['herb', 'herbs.json', 'herbs'], ['drug', 'drugs.json', 'drugs']]) {
  const data = JSON.parse(await readFile(new URL(`../03_App_Code/data/${file}`, root), 'utf8'));
  for (const item of data[key]) rows.push([kind, item.id, item.name_en, item.name_zh]);
}
const sql = '-- Generated from the existing public catalogue. Contains no patient data or risk ratings.\n' +
  'begin;\ninsert into public.medicine_catalog (kind,id,name_en,name_zh) values\n' +
  rows.map(row => '(' + row.map(quote).join(',') + ')').join(',\n') +
  '\non conflict (kind,id) do update set name_en=excluded.name_en, name_zh=excluded.name_zh;\ncommit;\n';
const destination = new URL('supabase/migrations/20261107010100_public_catalog.sql', root);
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8') !== sql) throw new Error('Backend catalogue differs from the public app. Regenerate and review.');
} else {
  let deployment;try {deployment=JSON.parse(await readFile(new URL('deployments/development.json',root),'utf8'));} catch(error){if(error.code!=='ENOENT')throw error;}
  const applied=deployment?.migrations?.find(x=>x.name==='public_catalog');
  if(deployment?.migration_history_verified && applied?.sha256!==createHash('sha256').update(sql).digest('hex'))throw new Error('Catalogue migration is already applied. Add a new migration instead of changing its history.');
  await writeFile(destination, sql);
}
console.log(`Public catalogue: ${rows.length} identifiers; ${process.argv.includes('--check') ? 'matches app' : 'generated'}.`);
