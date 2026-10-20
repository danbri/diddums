// Labs example pieces, grouped. A piece can appear in more than one group; every piece is in at least one.
import {SHOWCASE} from './showcase.js';
import {KIDS,ARTY,GENRES} from './songbook.js';
export const PIECES=[...SHOWCASE,...KIDS,...ARTY,...GENRES];
const T=titles=>titles.map(t=>{const i=PIECES.findIndex(p=>p.title===t);if(i<0)throw new Error('No piece '+t);return i;});
export const GROUPS=[
 {name:'Featured',open:true,about:'Full arrangements with a tune, harmony and parts that change, most of them on the generated instrument families.',
  items:T(['Glass Harbour','Folk · Over the Hill','House · Warehouse Sunrise','Seven Steps Up',"Brahms' Lullaby",'Bluegrass · Mountain Switchback','Tea Dance','Eurovision · Douze Points Forever','Copper Leaves','Sodium Lights'])},
 {name:'Kids',about:'Nursery rhymes and lullabies.',items:T(['Nursery Rhyme Medley',"Brahms' Lullaby",'Twinkle, Slowly','Little Boat','Moon over the Cot','Chiptune · Pixel Picnic'])},
 {name:'Arty',about:'Slow, atmospheric pieces that keep a melody.',items:T(['Glass Harbour','Paper Lanterns','Fog Choir','Copper Leaves','Lighthouse Night','Tintinnabuli','Whole-tone Weather','Phase Garden'])},
 {name:'Genres',about:'One original piece per style.',items:T([...GENRES.map(s=>s.title),'Tea Dance','Seven Steps Up','Sodium Lights'])},
 {name:'Techniques',about:'Process music: phasing, isorhythm, tintinnabuli, Euclidean rhythm, unusual scales.',items:T(['Phase Garden','Isorhythm','Tintinnabuli','Euclid Market','Whole-tone Weather','Octatonic Pursuit'])},
 {name:'Themes and sketches',about:'The Diddums theme, timed sound design and short ambient sketches.',items:T(['Diddums theme · Ta-dum','Diddums theme · Spoken','Diddums theme · Riddim','First Contact','Submerged Siren','Midnight Cathedral','Radio Horizon','Eclipse Resonance','Static Lullaby','Ceremonial Grid'])}];
const listed=new Set(GROUPS.flatMap(g=>g.items));
for(let i=0;i<PIECES.length;i++)if(!listed.has(i))GROUPS[GROUPS.length-1].items.push(i);
