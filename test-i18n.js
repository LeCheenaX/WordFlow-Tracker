// Simple test to check i18n link processing
const fs = require('fs');

// Read the JSON files directly
const enData = JSON.parse(fs.readFileSync('./src/i18n/locales/en.json', 'utf8'));
const zhData = JSON.parse(fs.readFileSync('./src/i18n/locales/zh-CN.json', 'utf8'));

console.log('=== English ===');
console.log('periodicNote.format.desc:');
console.log(JSON.stringify(enData.settings.recorders.periodicNote.format.desc, null, 2));

console.log('\nrecordingContents.syntax.desc:');
console.log(JSON.stringify(enData.settings.recorders.recordingContents.syntax.desc, null, 2));

console.log('\n=== Chinese ===');
console.log('periodicNote.format.desc:');
console.log(JSON.stringify(zhData.settings.recorders.periodicNote.format.desc, null, 2));

console.log('\nrecordingContents.syntax.desc:');
console.log(JSON.stringify(zhData.settings.recorders.recordingContents.syntax.desc, null, 2));

// Check if both have the same structure
const enSyntax = enData.settings.recorders.recordingContents.syntax.desc;
const zhSyntax = zhData.settings.recorders.recordingContents.syntax.desc;

console.log('\n=== Structure Check ===');
console.log('EN syntax has segments:', Array.isArray(enSyntax.segments));
console.log('EN syntax has links:', Array.isArray(enSyntax.links));
console.log('ZH syntax has segments:', Array.isArray(zhSyntax.segments));
console.log('ZH syntax has links:', Array.isArray(zhSyntax.links));

if (enSyntax.links && enSyntax.links.length > 0) {
    console.log('EN link0 id:', enSyntax.links[0].id);
    console.log('EN link0 text:', enSyntax.links[0].text);
    console.log('EN link0 href:', enSyntax.links[0].href);
}

if (zhSyntax.links && zhSyntax.links.length > 0) {
    console.log('ZH link0 id:', zhSyntax.links[0].id);
    console.log('ZH link0 text:', zhSyntax.links[0].text);
    console.log('ZH link0 href:', zhSyntax.links[0].href);
}