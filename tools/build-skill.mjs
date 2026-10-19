#!/usr/bin/env node
// Writes public/skill/SKILL.md and public/llms.txt: a provider-neutral description of the Diddums Song
// format for any LLM or agent, built from the same sound/instrument lists and guide the app uses.
// Run after changing sounds.js, patterns.js, song.js or the First Contact example: node tools/build-skill.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','public');
const {songGuide,exampleSong}=await import(path.join(root,'ai.js'));
const {compositionById}=await import(path.join(root,'collection.js'));
const SITE='https://danbri.github.io/diddums/';
const guide=songGuide(exampleSong(compositionById.firstcontact)).replace(/\n\nReturn one Song JSON object\.$/,'');
const skill=`---
name: diddums-song
description: Compose music, soundscapes and sound-design pieces for Diddums, a browser synthesiser, and hand back a link that plays them. Use when someone asks for a piece, ambience or sound effect sequence they can listen to in a browser.
---

# Diddums songs

You write a **Song** (JSON, described below) and give the person a link. Opening the link plays the piece at ${SITE}, where it can also be edited and shared. No account, key or install is needed.

## Delivering the result

1. Write the Song JSON. Leave out every optional field you do not need; shorter is better.
2. Build the link: \`${SITE}?song=\` followed by the JSON percent-encoded exactly as JavaScript \`encodeURIComponent\` does it (letters, digits and \`- _ . ! ~ * ' ( )\` stay; everything else, including spaces, quotes, braces, \`#\`, \`+\`, \`@\`, \`:\` and \`,\`, becomes \`%XX\`).
3. The whole link must stay under **8000 characters** (the host rejects longer ones). If it would be longer, simplify the piece: fewer tracks, shorter \`seq\` patterns that loop, fewer automation points.
4. Give the link on its own line, as plain text.
5. If you cannot produce a correct link (no way to percent-encode reliably, or it is too long), give the Song JSON instead and tell the person: open ${SITE}, choose **Labs**, type any short description in the text box, tap **Copy prompt for any AI assistant**, then paste the JSON into the reply box that appears and tap **Use this song**.

Before answering, check: every track has a \`sound\` from the lists below; every \`seq\` uses only the tokens described; times in automation and \`from\`/\`to\` fall inside \`seconds\`.

${guide.replace(/^# Writing music for Diddums\n\n/,'')}
`;
fs.mkdirSync(path.join(root,'skill'),{recursive:true});
fs.writeFileSync(path.join(root,'skill','SKILL.md'),skill);
fs.writeFileSync(path.join(root,'llms.txt'),`# Diddums

> A browser music workstation. Every sound is synthesised live by small DSP programs. Pieces are JSON "Songs" that can be opened from a link.

- [Diddums song skill](${SITE}skill/SKILL.md): how to compose a Song and turn it into a playable ${SITE}?song=… link. Provider-neutral; usable by any LLM or agent.
- [Example piece](${SITE}?piece=firstcontact): First Contact, 70 seconds.
- [Source](https://github.com/danbri/diddums)
`);
console.log('wrote skill/SKILL.md ('+skill.length+' chars) and llms.txt');
