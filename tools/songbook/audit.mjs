// Renders every songbook piece offline and reports level balance per part.
import {renderSong} from '../adaptive/offline.mjs';
import {KIDS,ARTY,GENRES} from './songs.mjs';
const only=process.argv[2];
for(const s of [...KIDS,...ARTY,...GENRES].filter(s=>!only||s.title.includes(only))){
 const r=await renderSong(s);const parts=Object.entries(r.tracks).filter(([id])=>!['mix','echo','room','out','drums'].includes(id)&&!id.startsWith('d:'));
 const loud=Math.max(...parts.map(([,v])=>v.rms));
 console.log(`${s.title.padEnd(40)} out rms ${r.rms.toFixed(3)} peak ${r.peak.toFixed(2)} drums ${(r.tracks.drums?.rms||0).toFixed(3)}${r.errors.length?' ERR '+r.errors[0]:''}`);
 console.log('   '+parts.map(([id,v])=>`${id} ${v.rms.toFixed(3)}${v.rms<loud*.2?'(quiet)':''}`).join(' · '));
}
